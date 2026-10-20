/**
 * utils/paperSecurity.js
 *
 * Security and validation helpers for NeoBranium Paper Generator:
 * - Image signature / magic byte inspection (JPEG, PNG, WebP)
 * - Strict size, page count, and format enforcement
 * - Anti-prompt injection filters for answer-sheet evaluation
 * - Paper structure and question validation
 * - Server-side marks recalculation and reconciliation
 */

export const MAX_PAGE_COUNT = Number(process.env.PAPER_MAX_PAGES) || 4;
export const MAX_FILE_SIZE_BYTES = Number(process.env.PAPER_MAX_IMAGE_BYTES) || 5 * 1024 * 1024;
export const MAX_TOTAL_SIZE_BYTES = Number(process.env.PAPER_MAX_TOTAL_BYTES) || 16 * 1024 * 1024;

/**
 * Validates a base64 encoded image against known file signatures (magic bytes).
 * Returns verified mimeType and clean base64 data, or throws an Error.
 *
 * @param {string} rawBase64
 * @param {string} [claimedMimeType]
 * @returns {{ verifiedMimeType: string, cleanBase64: string, sizeBytes: number }}
 */
export function validateImageSignature(rawBase64, claimedMimeType = '') {
  if (!rawBase64 || typeof rawBase64 !== 'string') {
    throw new Error('Image data must be a non-empty base64 string.');
  }

  // Strip data URI header if present
  let cleanBase64 = rawBase64;
  if (rawBase64.startsWith('data:')) {
    const commaIndex = rawBase64.indexOf(',');
    if (commaIndex === -1) {
      throw new Error('Malformed data URI in image payload.');
    }
    cleanBase64 = rawBase64.substring(commaIndex + 1);
  }

  // Sanitize whitespace / newlines
  cleanBase64 = cleanBase64.replace(/\s/g, '');

  // Calculate binary size
  const buffer = Buffer.from(cleanBase64, 'base64');
  const sizeBytes = buffer.length;

  if (sizeBytes === 0) {
    throw new Error('Empty image payload.');
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Image size (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed 5 MB per page.`);
  }

  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(cleanBase64)) {
    throw new Error('Malformed base64 image payload. Please select a valid image.');
  }

  // Verify magic bytes
  let verifiedMimeType = null;

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    verifiedMimeType = 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    verifiedMimeType = 'image/png';
  }
  // WebP: RIFF .... WEBP
  else if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // 'RIFF'
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50  // 'WEBP'
  ) {
    verifiedMimeType = 'image/webp';
  }

  if (!verifiedMimeType) {
    throw new Error('Invalid image format. Only authentic JPEG, PNG, and WebP images are accepted. SVG, executables, or corrupt files are rejected.');
  }

  if (claimedMimeType && claimedMimeType !== verifiedMimeType) {
    throw new Error('Image content does not match its declared file type. Please reselect the image.');
  }

  return {
    verifiedMimeType,
    cleanBase64,
    sizeBytes
  };
}

/**
 * Validates a batch of uploaded answer-sheet page images.
 *
 * @param {Array<{ base64: string, mimeType?: string, pageNumber?: number }>} pages
 * @returns {Array<{ verifiedMimeType: string, cleanBase64: string, pageNumber: number, sizeBytes: number }>}
 */
export function validateAnswerSheetPages(pages) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('Please upload at least one answer-sheet page image.');
  }

  if (pages.length > MAX_PAGE_COUNT) {
    throw new Error(`Too many pages uploaded. Maximum allowed is ${MAX_PAGE_COUNT} pages per submission.`);
  }

  if (pages.some(page => page && typeof page === 'object' && page.pageNumber !== undefined)) {
    const numberedPages = pages.map((page, index) => ({
      page,
      order: Number(page?.pageNumber ?? index + 1)
    }));
    if (numberedPages.some(item => !Number.isInteger(item.order) || item.order < 1 || item.order > MAX_PAGE_COUNT) ||
        new Set(numberedPages.map(item => item.order)).size !== numberedPages.length) {
      throw new Error('Page order is invalid. Remove and reselect the answer-sheet pages.');
    }
    numberedPages.sort((a, b) => a.order - b.order);
    pages = numberedPages.map(item => item.page);
  }

  let totalBytes = 0;
  const verifiedPages = [];

  for (let i = 0; i < pages.length; i++) {
    const pageItem = pages[i];
    const rawData = pageItem?.base64 || (typeof pageItem === 'string' ? pageItem : null);
    if (!rawData) {
      throw new Error(`Page ${i + 1} does not contain valid image data.`);
    }

    const { verifiedMimeType, cleanBase64, sizeBytes } = validateImageSignature(rawData, pageItem?.mimeType);
    totalBytes += sizeBytes;

    if (totalBytes > MAX_TOTAL_SIZE_BYTES) {
      throw new Error(`Total submission size (${(totalBytes / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed 16 MB.`);
    }

    verifiedPages.push({
      pageNumber: pageItem?.pageNumber || i + 1,
      verifiedMimeType,
      cleanBase64,
      sizeBytes
    });
  }

  return verifiedPages;
}

/**
 * Prompts injection sanitizer for untrusted text in paper generation / evaluation.
 */
export function sanitizePaperPromptInput(text) {
  if (!text || typeof text !== 'string') return '';
  // Strip control characters while keeping standard punctuation & unicode
  return text.slice(0, 500).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
}

/**
 * Server-side calculation and reconciliation of question-wise marks.
 * NEVER trust the model's reported total sum or unchecked individual scores.
 *
 * @param {Array<{ questionId: string, maxMarks: number }>} paperQuestions
 * @param {Array<{ questionId: string, awardedMarks: number, maxMarks: number, rationale?: string, reviewRequired?: boolean }>} rawEvaluations
 * @returns {{
 *   totalAwarded: number,
 *   totalMaxMarks: number,
 *   percentage: number,
 *   attemptedCount: number,
 *   unansweredCount: number,
 *   reviewRequiredCount: number,
 *   evaluations: Array<any>
 * }}
 */
export function reconcileEvaluationMarks(paperQuestions, rawEvaluations) {
  const evalMap = new Map();
  const knownIds = new Set(paperQuestions.map(q => String(q.id || q.questionId).trim()));
  for (const item of (rawEvaluations || [])) {
    if (item && item.questionId) {
      const id = String(item.questionId).trim();
      if (!knownIds.has(id)) {
        const error = new Error('AI evaluation included an unexpected question ID. Please retry evaluation.');
        error.status = 502;
        error.code = 'INVALID_AI_OUTPUT';
        throw error;
      }
      evalMap.set(id, item);
    }
  }

  let totalAwarded = 0;
  let totalMaxMarks = 0;
  let attemptedCount = 0;
  let unansweredCount = 0;
  let reviewRequiredCount = 0;

  const sanitizedEvaluations = [];

  for (const q of paperQuestions) {
    const qId = String(q.id || q.questionId).trim();
    const qMax = Number(q.maxMarks);
    if (!Number.isFinite(qMax) || qMax <= 0 || qMax > 100) {
      throw new Error(`Invalid maximum marks configured for ${qId}.`);
    }
    totalMaxMarks += qMax;

    const matchedEval = evalMap.get(qId) || null;

    let awarded = 0;
    let status = 'not_found';
    let reviewRequired = true;
    let rationale = 'No attempted answer detected in the uploaded pages.';
    let detectedAnswer = '';
    let whatWasCorrect = '';
    let whatWasMissing = 'This question was not found in the uploaded pages; its answer may be on a missing page.';
    let confidence = null;

    if (matchedEval) {
      // Numerical awarded marks clamped to [0, qMax]
      const rawAwarded = Number(matchedEval.awardedMarks);
      if (!isNaN(rawAwarded)) {
        awarded = Math.max(0, Math.min(qMax, Math.round(rawAwarded * 10) / 10)); // max 1 decimal point precision
      }

      const rawStatus = ['unanswered', 'not_found', 'review_required', 'attempted'].includes(matchedEval.status)
        ? matchedEval.status
        : null;
      reviewRequired = Boolean(matchedEval.reviewRequired || matchedEval.readabilityIssue || rawStatus === 'review_required' || rawStatus === 'not_found');
      detectedAnswer = String(matchedEval.detectedAnswer || '').slice(0, 800);
      rationale = String(matchedEval.rationale || 'Evaluated against marking rubric.').slice(0, 600);
      whatWasCorrect = String(matchedEval.whatWasCorrect || '').slice(0, 400);
      whatWasMissing = String(matchedEval.whatWasMissing || '').slice(0, 400);
      confidence = null;

      if (reviewRequired) {
        status = 'review_required';
        reviewRequiredCount++;
        attemptedCount++;
      } else if (awarded > 0) {
        status = awarded === qMax ? 'fully_correct' : 'partially_correct';
        attemptedCount++;
      } else if (rawStatus === 'not_found') {
        status = 'not_found';
        reviewRequiredCount++;
      } else if ((rawStatus === 'unanswered' || rawStatus === null) && !detectedAnswer.trim()) {
        status = 'unanswered';
        unansweredCount++;
      } else if (detectedAnswer && detectedAnswer.trim().length > 0) {
        status = 'incorrect';
        attemptedCount++;
      } else {
        status = 'unanswered';
        unansweredCount++;
      }
    } else {
      status = 'not_found';
      reviewRequired = true;
      reviewRequiredCount++;
    }

    totalAwarded += awarded;

    sanitizedEvaluations.push({
      questionId: qId,
      questionNumber: q.questionNumber || q.number || qId,
      subpart: q.subpart || null,
      maxMarks: qMax,
      awardedMarks: awarded,
      status,
      reviewRequired,
      detectedAnswer,
      rationale,
      whatWasCorrect,
      whatWasMissing,
      confidence
    });
  }

  // Round total to 1 decimal place
  totalAwarded = Math.round(totalAwarded * 10) / 10;
  const percentage = totalMaxMarks > 0 ? Math.round((totalAwarded / totalMaxMarks) * 1000) / 10 : 0;

  return {
    totalAwarded,
    totalMaxMarks,
    percentage,
    attemptedCount,
    unansweredCount,
    reviewRequiredCount,
    evaluations: sanitizedEvaluations
  };
}
