import os
import re

# 1. Update server.js
with open('server.js', 'r', encoding='utf-8') as f:
    server_code = f.read()

tts_route = """// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ElevenLabs TTS Route  (nb-tts — new addition)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Voice IDs for each mode. Change these to your preferred ElevenLabs voice IDs.
const NB_VOICE_MAP = {
    hinglish: process.env.EL_VOICE_HINGLISH || 'pNInz6obpgDQGcFmaJgB', // Adam — neutral, clear
    teacher:  process.env.EL_VOICE_TEACHER  || 'ErXwobaYiN019PkySvjV', // Antoni — authoritative
    english:  process.env.EL_VOICE_ENGLISH  || 'EXAVITQu4vr4xnSDxMaL', // Bella — professional
    hindi:    process.env.EL_VOICE_HINDI    || 'pNInz6obpgDQGcFmaJgB'  // Adam — works for Hindi
};

// Hinglish pronunciation corrections applied before sending to ElevenLabs
const applyHinglishPronunciationFixes = (text) => {
    return text
        // Common Hinglish words that get mispronounced
        .replace(/\\bkaro\\b/gi, 'kuh-ro')
        .replace(/\\bsuno\\b/gi, 'soo-no')
        .replace(/\\bdekho\\b/gi, 'dek-ho')
        .replace(/\\bsahi\\b/gi, 'saa-hi')
        .replace(/\\btheek\\b/gi, 'theek')
        .replace(/\\bwaala\\b/gi, 'waa-la')
        .replace(/\\bwaale\\b/gi, 'waa-le')
        .replace(/\\byaad\\b/gi, 'yaad')
        .replace(/\\bpadho\\b/gi, 'puh-dho')
        .replace(/\\blikho\\b/gi, 'lik-ho')
        .replace(/\\bsamjhe\\b/gi, 'sum-jheh')
        .replace(/\\bsamajh\\b/gi, 'sum-ujh')
        .replace(/\\bkya\\b/gi, 'kyaa')
        .replace(/\\bhaan\\b/gi, 'haan')
        .replace(/\\bnahi\\b/gi, 'nuh-hee')
        .replace(/\\bnahin\\b/gi, 'nuh-heen')
        .replace(/\\bacha\\b/gi, 'uh-chha')
        .replace(/\\bachha\\b/gi, 'uh-chha')
        .replace(/\\bthoda\\b/gi, 'tho-daa')
        .replace(/\\bbeta\\b/gi, 'bay-taa')
        .replace(/\\bgyaan\\b/gi, 'gyaan')
        // Math terms that sound unnatural when read as text
        .replace(/\\bsqrt\\b/gi, 'square root of')
        .replace(/\\^2\\b/g, ' squared')
        .replace(/\\^3\\b/g, ' cubed')
        // Strip markdown tokens that would be spoken aloud
        .replace(/\\*\\*(.*?)\\*\\*/g, '$1')
        .replace(/\\*(.*?)\\*/g, '$1')
        .replace(/#{1,6}\\s?/g, '')
        .replace(/`{1,3}[^`]*`{1,3}/g, '')
        .replace(/\\[([^\\]]+)\\]\\([^\\)]+\\)/g, '$1')
        // Strip LaTeX delimiters (leave the content readable)
        .replace(/\\$\\$(.*?)\\$\\$/gs, (_, eq) => eq.replace(/[\\\\{}^_]/g, ' '))
        .replace(/\\\\\\((.*?)\\\\\\)/g, (_, eq) => eq.replace(/[\\\\{}^_]/g, ' '))
        .trim();
};

app.post('/api/tts', async (req, res) => {
    try {
        const { text, mode = 'hinglish' } = req.body;

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({ error: 'Missing or invalid text' });
        }

        if (text.length > 5000) {
            return res.status(400).json({ error: 'Text too long for TTS' });
        }

        if (!ELEVENLABS_API_KEY) {
            return res.status(503).json({ error: 'ElevenLabs not configured' });
        }

        const voiceId = NB_VOICE_MAP[mode] || NB_VOICE_MAP['hinglish'];

        // Apply pronunciation fixes for Hinglish and Hindi modes
        let processedText = text;
        if (mode === 'hinglish' || mode === 'teacher' || mode === 'hindi') {
            processedText = applyHinglishPronunciationFixes(text);
        } else {
            // Strip markdown for all modes
            processedText = text
                .replace(/\\*\\*(.*?)\\*\\*/g, '$1')
                .replace(/\\*(.*?)\\*/g, '$1')
                .replace(/#{1,6}\\s?/g, '')
                .replace(/`{1,3}[^`]*`{1,3}/g, '')
                .replace(/\\[([^\\]]+)\\]\\([^\\)]+\\)/g, '$1')
                .replace(/\\$\\$(.*?)\\$\\$/gs, (_, eq) => eq.replace(/[\\\\{}^_]/g, ' '))
                .replace(/\\\\\\((.*?)\\\\\\)/g, (_, eq) => eq.replace(/[\\\\{}^_]/g, ' '))
                .trim();
        }

        // Voice settings tuned per mode
        const voiceSettings = {
            hinglish: { stability: 0.45, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
            teacher:  { stability: 0.60, similarity_boost: 0.80, style: 0.2, use_speaker_boost: true },
            english:  { stability: 0.55, similarity_boost: 0.78, style: 0.25, use_speaker_boost: false },
            hindi:    { stability: 0.50, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true }
        };

        const settings = voiceSettings[mode] || voiceSettings['hinglish'];

        const elResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text: processedText,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: settings
                })
            }
        );

        if (!elResponse.ok) {
            const errText = await elResponse.text();
            console.error('❌ ElevenLabs TTS error:', elResponse.status, errText);
            return res.status(elResponse.status).json({ error: 'ElevenLabs request failed' });
        }

        // Stream audio back to client
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Transfer-Encoding', 'chunked');

        const reader = elResponse.body.getReader();
        const pump = async () => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) { res.end(); break; }
                res.write(Buffer.from(value));
            }
        };
        await pump();

    } catch (error) {
        console.error('❌ /api/tts error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'TTS internal error' });
        }
    }
});
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// END ElevenLabs TTS Route
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Health check endpoint"""

if "ElevenLabs TTS Route" not in server_code:
    server_code = server_code.replace("// Health check endpoint", tts_route)
    with open('server.js', 'w', encoding='utf-8') as f:
        f.write(server_code)
    print("Updated server.js")
else:
    print("server.js already updated")


# 2. Update .env
with open('.env', 'r', encoding='utf-8') as f:
    env_code = f.read()

env_adds = """
EL_VOICE_HINGLISH=pNInz6obpgDQGcFmaJgB
EL_VOICE_TEACHER=ErXwobaYiN019PkySvjV
EL_VOICE_ENGLISH=EXAVITQu4vr4xnSDxMaL
EL_VOICE_HINDI=pNInz6obpgDQGcFmaJgB
"""
if "EL_VOICE_HINGLISH" not in env_code:
    with open('.env', 'a', encoding='utf-8') as f:
        f.write(env_adds)
    print("Updated .env")
else:
    print(".env already updated")

# 3. Update ai-board.css
with open('ai-board/ai-board.css', 'r', encoding='utf-8') as f:
    css_code = f.read()

css_adds = """
/* ── nb-tts-* scoped additions ─────────────────────────────── */
/* These selectors use nb-tts- / nb-voice- / nb-speaking- prefixes
   and do not override any existing rules.                       */

/* Speak button active state while ElevenLabs audio is playing */
.nb-speaking-active #speakBtn {
    display: none;
}
.nb-speaking-active #stopSpeakBtn {
    display: flex;
}
.nb-speaking-active #speakingIndicator {
    display: flex;
}

/* Visual pulse on the mic button while TTS is loading a chunk
   (gap between chunks in multi-sentence responses) */
.mic-btn.nb-tts-loading {
    background: rgba(255, 204, 0, 0.15);
    border-color: rgba(255, 204, 0, 0.5);
    color: #ffcc00;
}

/* Subtle indicator next to AI response when ElevenLabs is active */
.chat-message.assistant.nb-tts-speaking::before {
    content: '';
    position: absolute;
    left: -6px;
    top: 14px;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #00f2fe;
    box-shadow: 0 0 6px rgba(0, 242, 254, 0.8);
    animation: nb-dot-pulse 1.2s ease-in-out infinite;
}

.chat-message.assistant {
    position: relative; /* needed for the ::before pseudo-element above */
}

@keyframes nb-dot-pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50%       { opacity: 1;   transform: scale(1.2); }
}

/* ElevenLabs unavailable notice — shown only when API key missing */
.nb-tts-unavailable-notice {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.35);
    text-align: center;
    padding: 4px 0 0;
    letter-spacing: 0.02em;
}
/* ── end nb-tts-* additions ─────────────────────────────────── */
"""

if "nb-tts-* scoped additions" not in css_code:
    with open('ai-board/ai-board.css', 'a', encoding='utf-8') as f:
        f.write(css_adds)
    print("Updated ai-board.css")
else:
    print("ai-board.css already updated")


