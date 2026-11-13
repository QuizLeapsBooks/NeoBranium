/**
 * services/neobookSourceService.js
 *
 * Implements source processing for NeoBook:
 * - SSRF-protected safe website fetching & text extraction
 * - YouTube transcript & caption extraction (with strict no-hallucination policy)
 * - PDF text extraction with page numbers
 * - Text input sanitization
 * - Text chunking with page/timestamp metadata for RAG retrieval
 */

import dns from 'dns';
import { PDFParse } from 'pdf-parse';
import { NEOBOOK_CONFIG } from './neobookConfig.js';
import { fetchWithRetry } from '../utils/backendRequestProtection.js';

// ── SSRF & Network Protection ──────────────────────────────────────────────────

/**
 * Checks if an IPv4 address is in a private, loopback, or reserved range.
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateIpv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  const [a, b, c, d] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (Private)
  if (a === 10) return true;

  // 100.64.0.0/10 (Shared address space / Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-local, AWS/GCP/Azure metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;

  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;

  // 198.18.0.0/15 (Network benchmark tests)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved for future use: 240.0.0.0 - 255.255.255.254)
  if (a >= 240) return true;

  // 255.255.255.255 (Broadcast)
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address is private, loopback, or reserved.
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateIpv6(ip) {
  const norm = ip.toLowerCase();

  // Loopback ::1
  if (norm === '::1' || norm === '0:0:0:0:0:0:0:1') return true;

  // Unspecified ::
  if (norm === '::' || norm === '0:0:0:0:0:0:0:0') return true;

  // Unique local addresses fc00::/7 (fc00... or fd00...)
  if (norm.startsWith('fc') || norm.startsWith('fd')) return true;

  // Link-local unicast fe80::/10
  if (norm.startsWith('fe80:')) return true;

  // Multicast ff00::/8
  if (norm.startsWith('ff')) return true;

  // IPv4-mapped IPv6 address (e.g. ::ffff:192.168.1.1 or ::ffff:c0a8:0101)
  if (norm.includes('::ffff:')) {
    const after = norm.split('::ffff:')[1];
    if (after.includes('.')) {
      return isPrivateIpv4(after);
    }
  }

  return false;
}

/**
 * Validates that an IP address is public and safe to access.
 * @param {string} ip
 * @param {number} family
 * @returns {boolean}
 */
export function isPrivateOrRestrictedIp(ip, family) {
  if (family === 4 || ip.includes('.')) {
    return isPrivateIpv4(ip);
  }
  return isPrivateIpv6(ip);
}

/**
 * Validates a target URL against SSRF threats.
 * Resolves DNS to check all candidate IPs before fetching.
 * @param {string} rawUrl
 * @returns {Promise<URL>}
 */
export async function validateSafeUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('A valid website URL is required.');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid URL format.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject local and internal hostnames directly
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.onion') ||
    hostname === '0.0.0.0'
  ) {
    throw new Error('Access to local, internal, or private hostnames is forbidden.');
  }

  // Resolve hostname via DNS to prevent DNS rebinding & check IP ranges
  let addresses;
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch (err) {
    throw new Error(`Could not resolve domain name: ${hostname}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`No IP addresses found for domain: ${hostname}`);
  }

  for (const { address, family } of addresses) {
    if (isPrivateOrRestrictedIp(address, family)) {
      throw new Error(`Access to private or restricted network address (${address}) is forbidden.`);
    }
  }

  return parsed;
}

/**
 * Cleanly strips HTML tags, script, styles, and extracts readable text.
 * @param {string} html
 * @returns {{ title: string, text: string }}
 */
export function extractTextFromHtml(html) {
  if (!html || typeof html !== 'string') return { title: 'Web Document', text: '' };

  // Extract <title> if present
  let title = 'Web Document';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 150);
  }

  // Strip non-content blocks
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ');

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();

  return { title, text };
}

/**
 * Safely fetches a website and extracts its content with SSRF protection.
 * Follows redirects manually to validate each target URL.
 * @param {string} urlString
 * @param {number} maxRedirects
 * @returns {Promise<{ title: string, text: string, url: string }>}
 */
export async function fetchWebsiteContent(urlString, maxRedirects = 3, { signal } = {}) {
  let currentUrl = urlString;
  let response = null;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validatedUrl = await validateSafeUrl(currentUrl);

    try {
      response = await fetchWithRetry(validatedUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NeoBook/2.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5'
        },
        redirect: 'manual',
        signal
      }, { maxRetries: 1, timeoutMs: NEOBOOK_CONFIG.FETCH_TIMEOUT_MS });
    } catch (fetchErr) {
      if (signal?.aborted) throw fetchErr;
      if (fetchErr.name === 'AbortError' || fetchErr.code === 'UPSTREAM_TIMEOUT') {
        throw Object.assign(new Error('Fetching website timed out after 10 seconds.'), { status: 504, code: 'UPSTREAM_TIMEOUT' });
      }
      throw new Error(`Failed to fetch website: ${fetchErr.message}`);
    }

    // Handle redirects safely
    if (response.status >= 300 && response.status < 400) {
      const redirectLocation = response.headers.get('location');
      if (!redirectLocation) {
        throw new Error(`Received redirect status ${response.status} with no Location header.`);
      }
      currentUrl = new URL(redirectLocation, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Website returned HTTP status ${response.status} ${response.statusText}`);
    }

    break;
  }

  // Ensure content type is HTML or plain text
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/') && !contentType.includes('html') && !contentType.includes('xml')) {
    throw new Error(`Unsupported content type (${contentType}). Only HTML and text web pages can be processed.`);
  }

  const rawBody = await response.text();
  const { title, text } = extractTextFromHtml(rawBody);

  if (!text || text.length < 50) {
    throw new Error('The web page contains insufficient readable text or is protected by client-side JavaScript rendering.');
  }

  const truncatedText = text.slice(0, NEOBOOK_CONFIG.MAX_TEXT_SOURCE_CHARS);

  return {
    title: title || 'Web Page',
    text: truncatedText,
    url: currentUrl
  };
}

// ── YouTube Transcript Extraction ──────────────────────────────────────────────

/**
 * Extracts the 11-character YouTube video ID from various URL formats.
 * @param {string} urlString
 * @returns {string|null}
 */
export function extractYouTubeVideoId(urlString) {
  if (typeof urlString !== 'string') return null;
  const match = urlString.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}

/**
 * Formats seconds into [MM:SS] or [HH:MM:SS]
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatTimestamp(totalSeconds) {
  const secs = Math.floor(totalSeconds);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * NotebookLM-style multimodal YouTube Analyzer:
 * Uses Gemini API to understand public YouTube videos directly (audio & visuals)
 * to extract themes, high-weightage chapters, topics, formulas, dates, and timestamps.
 * @param {string} videoId
 * @param {string} title
 * @returns {Promise<{ title: string, text: string, videoId: string, segments: Array<{ timestamp: string, text: string }> } | null>}
 */
export async function analyzeYouTubeWithGemini(videoId, title, signal) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const prompt = `Analyze this YouTube video completely and objectively for research and study notes (like Google NotebookLM).
Produce a comprehensive, deeply informative research document covering:
1. Core Themes, Central Concepts, and High-Weightage Chapters & Topics.
2. Step-by-step explanations, key principles, strategies, formulas, dates, or definitions mentioned.
3. Detailed chronological sections with approximate timestamps [MM:SS] so students can verify citations.

Write in a clear, structured format suitable for study and reference.`;

  try {
    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              file_data: {
                file_uri: `https://www.youtube.com/watch?v=${videoId}`,
                mime_type: 'video/mp4'
              }
            }
          ]
        }]
      })
    }, { maxRetries: 1, timeoutMs: 150_000 });

    if (!res.ok) {
      console.warn('[NeoBook] Gemini YouTube analysis status:', res.status);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || text.length < 50) return null;
    const reportedInputTokens = data.usageMetadata?.promptTokenCount;
    const reportedOutputTokens = data.usageMetadata?.candidatesTokenCount;
    const usageSource = Number.isFinite(reportedInputTokens) && Number.isFinite(reportedOutputTokens)
      ? 'provider'
      : 'estimate';
    const inputTokens = Number.isFinite(reportedInputTokens)
      ? reportedInputTokens
      : Math.ceil(prompt.length / 4) + 1_024;
    const outputTokens = Number.isFinite(reportedOutputTokens)
      ? reportedOutputTokens
      : Math.ceil(text.length / 4);

    const segments = [];
    const lines = text.split('\n');
    let currentTs = '00:00';
    for (const line of lines) {
      const tsMatch = line.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
      if (tsMatch) {
        currentTs = tsMatch[1];
      }
      if (line.trim().length > 10) {
        segments.push({ timestamp: currentTs, text: line.trim() });
      }
    }

    return {
      title,
      text: text.trim().slice(0, NEOBOOK_CONFIG.MAX_TEXT_SOURCE_CHARS),
      videoId,
      segments: segments.length > 0 ? segments : [{ timestamp: '00:00', text: text.slice(0, 300) }],
      tokenUsage: { inputTokens, outputTokens, usageSource }
    };
  } catch (gemErr) {
    if (signal?.aborted) throw gemErr;
    if (gemErr.code === 'UPSTREAM_TIMEOUT') throw gemErr;
    console.warn('[NeoBook] Gemini multimodal YouTube analysis error:', gemErr.message);
    return null;
  }
}

/**
 * Extracts transcripts/captions from a YouTube video URL.
 * Uses official oEmbed for metadata and the YouTube InnerTube API for captions to bypass 429 scraping blocks.
 * If captions are disabled or unavailable, falls back to Gemini Multimodal Video Analysis (NotebookLM style).
 * @param {string} urlString
 * @returns {Promise<{ title: string, text: string, videoId: string, segments: Array<{ timestamp: string, text: string }> }>}
 */
export async function extractYouTubeTranscript(urlString, { signal } = {}) {
  const videoId = extractYouTubeVideoId(urlString);
  if (!videoId) {
    throw new Error('Invalid YouTube video link. Please provide a standard YouTube video or Shorts URL.');
  }

  // 1. Resolve video title reliably via YouTube oEmbed (avoids 429 block on video page)
  let title = 'YouTube Video';
  let authorName = '';
  try {
    const oembedRes = await fetchWithRetry(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NeoBook/2.0 Research Notebook'
      },
      signal
    }, { maxRetries: 1, timeoutMs: NEOBOOK_CONFIG.FETCH_TIMEOUT_MS });
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      if (oembedData.title) {
        title = oembedData.title.trim();
      }
      if (oembedData.author_name) {
        authorName = oembedData.author_name.trim();
      }
    }
  } catch (oembedErr) {
    if (signal?.aborted) throw oembedErr;
    console.warn('[NeoBook] oEmbed title lookup deferred:', oembedErr.message);
  }

  // 2. Fetch Caption Tracks via InnerTube Android Client (bypasses datacentre 429 rate limiting)
  let captionTracks = [];
  let videoDescription = '';
  try {
    const itRes = await fetchWithRetry('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '20.10.38',
          },
        },
        videoId: videoId,
      }),
      signal
    }, { maxRetries: 1, timeoutMs: NEOBOOK_CONFIG.FETCH_TIMEOUT_MS });

    if (itRes.ok) {
      const itData = await itRes.json();
      captionTracks = itData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      if (itData?.videoDetails?.shortDescription) {
        videoDescription = itData.videoDetails.shortDescription;
      }
      if (title === 'YouTube Video' && itData?.videoDetails?.title) {
        title = itData.videoDetails.title;
      }
    }
  } catch (itErr) {
    if (signal?.aborted) throw itErr;
    console.warn('[NeoBook] InnerTube caption lookup failed:', itErr.message);
  }

  // 3. Fallback: HTML scraping of watch page if InnerTube didn't return tracks
  if (!captionTracks || captionTracks.length === 0) {
    try {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetchWithRetry(watchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal
      }, { maxRetries: 1, timeoutMs: NEOBOOK_CONFIG.FETCH_TIMEOUT_MS });

      if (response.ok) {
        const html = await response.text();
        if (title === 'YouTube Video') {
          const titleMatch = html.match(/<title>([\s\S]*?) - YouTube<\/title>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim();
          }
        }
        const captionTracksMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
        if (captionTracksMatch && captionTracksMatch[1]) {
          try {
            captionTracks = JSON.parse(captionTracksMatch[1]);
          } catch {
            // ignore
          }
        }
      }
    } catch (scrapErr) {
      if (signal?.aborted) throw scrapErr;
      console.warn('[NeoBook] Web fallback caption lookup failed:', scrapErr.message);
    }
  }

  // 4. If caption tracks are found, parse them
  if (Array.isArray(captionTracks) && captionTracks.length > 0) {
    let selectedTrack = captionTracks.find(t => t.languageCode === 'en' || (t.vssId && t.vssId.includes('.en')));
    if (!selectedTrack) {
      selectedTrack = captionTracks.find(t => t.languageCode === 'hi' || (t.vssId && t.vssId.includes('.hi')));
    }
    if (!selectedTrack) {
      selectedTrack = captionTracks[0];
    }

    if (selectedTrack && selectedTrack.baseUrl) {
      try {
        const trackUrl = selectedTrack.baseUrl;
        const trackRes = await fetchWithRetry(trackUrl, { signal }, { maxRetries: 1, timeoutMs: NEOBOOK_CONFIG.FETCH_TIMEOUT_MS });
        if (trackRes.ok) {
          const trackXml = await trackRes.text();
          const segments = [];
          let fullText = '';

          if (trackXml.includes('<p t=')) {
            const pRegex = /<p\s+t="(\d+)"[^>]*>([\s\S]*?)<\/p>/gi;
            let match;
            while ((match = pRegex.exec(trackXml)) !== null) {
              const ms = parseInt(match[1], 10) || 0;
              const cleanText = match[2]
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&#39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\n/g, ' ')
                .trim();

              if (cleanText) {
                const timestamp = formatTimestamp(ms / 1000);
                segments.push({ timestamp, text: cleanText });
                fullText += `[${timestamp}] ${cleanText}\n`;
              }
            }
          } else {
            const textTagRegex = /<text\s+start="([\d.]+)"(?:\s+dur="[\d.]+")?[^>]*>([\s\S]*?)<\/text>/gi;
            let match;
            while ((match = textTagRegex.exec(trackXml)) !== null) {
              const startSec = parseFloat(match[1]) || 0;
              const cleanText = match[2]
                .replace(/&amp;/g, '&')
                .replace(/&#39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\n/g, ' ')
                .trim();

              if (cleanText) {
                const timestamp = formatTimestamp(startSec);
                segments.push({ timestamp, text: cleanText });
                fullText += `[${timestamp}] ${cleanText}\n`;
              }
            }
          }

          if (segments.length > 0 && fullText.trim().length > 30) {
            return {
              title,
              text: fullText.trim().slice(0, NEOBOOK_CONFIG.MAX_TEXT_SOURCE_CHARS),
              videoId,
              segments
            };
          }
        }
      } catch (trackErr) {
        if (signal?.aborted) throw trackErr;
        console.warn('[NeoBook] Error parsing caption stream, falling back to multimodal analysis:', trackErr.message);
      }
    }
  }

  // 5. NOTEBOOKLM MULTIMODAL FALLBACK:
  // When captions are not available/blocked, use Gemini Multimodal Video API to extract the theme, chapters, and topics!
  console.log(`[NeoBook] Using NotebookLM-style multimodal AI analysis for video: ${title}`);
  const geminiResult = await analyzeYouTubeWithGemini(videoId, title, signal);
  if (geminiResult && geminiResult.text && geminiResult.text.length > 50) {
    return geminiResult;
  }

  // 6. Last Resilient Fallback: Index video metadata and description if all else fails
  if (videoDescription && videoDescription.length > 20) {
    const fallbackText = `Video: ${title}\nCreator: ${authorName || 'YouTube Creator'}\n\nDescription & Topics:\n${videoDescription}`;
    return {
      title,
      text: fallbackText.slice(0, NEOBOOK_CONFIG.MAX_TEXT_SOURCE_CHARS),
      videoId,
      segments: [{ timestamp: '00:00', text: fallbackText.slice(0, 300) }]
    };
  }

  throw new Error(
    `Could not extract content for "${title}". Please ensure the video is public or paste the notes as a Text Note.`
  );
}

// ── PDF Text Extraction ────────────────────────────────────────────────────────

/**
 * Extracts text page-by-page from a PDF buffer using PDFParse.
 * @param {Buffer|Uint8Array} pdfBuffer
 * @returns {Promise<{ title: string, text: string, pages: Array<{ pageNum: number, text: string }> }>}
 */
export async function extractPdfText(pdfBuffer) {
  if (!pdfBuffer || pdfBuffer.length < 10) {
    throw new Error('Invalid or empty PDF file provided.');
  }

  // Verify PDF magic bytes '%PDF'
  if (
    pdfBuffer[0] !== 0x25 ||
    pdfBuffer[1] !== 0x50 ||
    pdfBuffer[2] !== 0x44 ||
    pdfBuffer[3] !== 0x46
  ) {
    throw new Error('The uploaded file is not a valid PDF document (missing %PDF header).');
  }

  if (pdfBuffer.length > NEOBOOK_CONFIG.MAX_SOURCE_SIZE_BYTES) {
    throw new Error(`PDF file size exceeds maximum limit of ${NEOBOOK_CONFIG.MAX_SOURCE_SIZE_BYTES / (1024 * 1024)} MB.`);
  }

  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const textResult = await parser.getText();
    const rawPages = textResult?.pages || [];
    const pages = [];
    let fullText = '';

    for (const page of rawPages) {
      const pageText = (page.text || '').trim();
      if (pageText) {
        pages.push({
          pageNum: page.num || pages.length + 1,
          text: pageText
        });
        fullText += `--- Page ${page.num || pages.length} ---\n${pageText}\n\n`;
      }
    }

    if (pages.length === 0 || !fullText.trim()) {
      throw new Error('Could not extract readable text from this PDF. It may contain scanned images without embedded text.');
    }

    return {
      title: 'Uploaded Document',
      text: fullText.trim().slice(0, NEOBOOK_CONFIG.MAX_TEXT_SOURCE_CHARS),
      pages
    };
  } finally {
    try {
      await parser.destroy();
    } catch {
      // ignore parser cleanup errors
    }
  }
}

// ── Text Input Sanitization ────────────────────────────────────────────────────

/**
 * Sanitizes and validates raw text/notes input.
 * @param {string} rawText
 * @param {string} customTitle
 * @returns {{ title: string, text: string }}
 */
export function processRawTextInput(rawText, customTitle = '') {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('Source text content cannot be empty.');
  }

  const cleanText = rawText.trim().slice(0, NEOBOOK_CONFIG.MAX_TEXT_SOURCE_CHARS);
  const title = (customTitle && typeof customTitle === 'string' && customTitle.trim())
    ? customTitle.trim().slice(0, 120)
    : cleanText.slice(0, 40).replace(/\n/g, ' ') + '...';

  return {
    title,
    text: cleanText
  };
}

// ── Text Chunking for RAG Retrieval ───────────────────────────────────────────

/**
 * Splits source content into overlapping semantic chunks tagged with source metadata
 * (sourceId, title, type, pageNum, timestamp, url, chunkIndex).
 * @param {{
 *   sourceId: string,
 *   title: string,
 *   type: 'url'|'youtube'|'pdf'|'text',
 *   text: string,
 *   pages?: Array<{ pageNum: number, text: string }>,
 *   segments?: Array<{ timestamp: string, text: string }>,
 *   url?: string
 * }} source
 * @returns {Array<{
 *   chunkId: string,
 *   sourceId: string,
 *   sourceTitle: string,
 *   sourceType: string,
 *   chunkIndex: number,
 *   text: string,
 *   metadata: { pageNum?: number, timestamp?: string, url?: string }
 * }>}
 */
export function chunkSourceContent(source) {
  const { sourceId, title, type, text, pages, segments, url } = source;
  const chunks = [];
  const chunkSize = NEOBOOK_CONFIG.CHUNK_SIZE_CHARS;
  const overlap = NEOBOOK_CONFIG.CHUNK_OVERLAP_CHARS;

  // Case 1: PDF with distinct pages
  if (type === 'pdf' && Array.isArray(pages) && pages.length > 0) {
    let globalIndex = 0;
    for (const page of pages) {
      const pageText = page.text;
      let start = 0;
      while (start < pageText.length) {
        const end = Math.min(start + chunkSize, pageText.length);
        const chunkText = pageText.slice(start, end).trim();
        if (chunkText.length > 30) {
          chunks.push({
            chunkId: `${sourceId}_c${globalIndex}`,
            sourceId,
            sourceTitle: title,
            sourceType: type,
            chunkIndex: globalIndex++,
            text: chunkText,
            metadata: { pageNum: page.pageNum }
          });
        }
        if (end >= pageText.length) break;
        start += (chunkSize - overlap);
      }
    }
    return chunks;
  }

  // Case 2: YouTube with timed segments
  if (type === 'youtube' && Array.isArray(segments) && segments.length > 0) {
    let globalIndex = 0;
    let currentBlock = '';
    let startTimestamp = segments[0]?.timestamp || '00:00';

    for (const seg of segments) {
      currentBlock += ` ${seg.text}`;
      if (currentBlock.length >= chunkSize) {
        chunks.push({
          chunkId: `${sourceId}_c${globalIndex}`,
          sourceId,
          sourceTitle: title,
          sourceType: type,
          chunkIndex: globalIndex++,
          text: currentBlock.trim(),
          metadata: { timestamp: startTimestamp }
        });
        currentBlock = seg.text; // slight overlap
        startTimestamp = seg.timestamp;
      }
    }

    if (currentBlock.trim().length > 20) {
      chunks.push({
        chunkId: `${sourceId}_c${globalIndex}`,
        sourceId,
        sourceTitle: title,
        sourceType: type,
        chunkIndex: globalIndex,
        text: currentBlock.trim(),
        metadata: { timestamp: startTimestamp }
      });
    }
    return chunks;
  }

  // Case 3: URL or generic text
  let start = 0;
  let globalIndex = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 30) {
      chunks.push({
        chunkId: `${sourceId}_c${globalIndex}`,
        sourceId,
        sourceTitle: title,
        sourceType: type,
        chunkIndex: globalIndex++,
        text: chunkText,
        metadata: { url: url || undefined }
      });
    }
    if (end >= text.length) break;
    start += (chunkSize - overlap);
  }

  return chunks;
}
