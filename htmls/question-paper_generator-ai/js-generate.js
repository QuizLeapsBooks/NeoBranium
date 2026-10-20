/**
 * htmls/question-paper_generator-ai/js-generate.js
 *
 * Frontend controller for NeoBranium Paper Generator & Handwritten Answer-Sheet Evaluator:
 * - Dynamic NCERT curriculum and chapter selection
 * - Safe authenticated & guest API communication
 * - KaTeX math rendering
 * - Floating action button for answer-sheet upload
 * - Multi-page handwritten image capture, drag-and-drop & client-side validation
 * - AI answer evaluation with server-side marks reconciliation
 * - Question-wise marks breakdown modal
 * - On-demand model answers generation (STRICTLY hidden until requested)
 * - Accessible modals with keyboard navigation (Esc to close)
 */

import { CURRICULUM_DATA, SYLLABUS_VERSION, EXAM_MODES } from '/js/paper-syllabus-data.js';

// Firebase Auth resolution
let currentUser = null;
let getAuthToken = async () => null;

try {
  const authModule = await import('/js/auth.js');
  if (authModule && authModule.auth) {
    authModule.onAuthStateChanged(authModule.auth, (user) => {
      currentUser = user;
    });
    getAuthToken = async () => {
      if (authModule.auth.currentUser) {
        return await authModule.auth.currentUser.getIdToken();
      }
      return null;
    };
  }
} catch (authErr) {
  console.info('[PaperGenerator] Running in standalone/guest session mode');
}

// ─────────────────────────────────────────────────────────────────────────────
// State Management
// ─────────────────────────────────────────────────────────────────────────────
let currentPaper = null;
let currentEvaluation = null;
let currentModelAnswers = null;
let modelAnswersBtnBusy = false;
let uploadedPages = []; // Array of { file, base64, mimeType, dataUrl, pageNumber }
let pendingReads = 0;
let uploadBytesPending = 0;
let isCustomChapterActive = false;

// ─────────────────────────────────────────────────────────────────────────────
// DOM Elements
// ─────────────────────────────────────────────────────────────────────────────
const form = document.getElementById('paperForm');
const generateBtn = document.getElementById('generateBtn');
const loading = document.getElementById('loading');
const loadingTitle = document.getElementById('loadingTitle');
const loadingSubtext = document.getElementById('loadingSubtext');
const resultArea = document.getElementById('resultArea');
const resultText = document.getElementById('generated-paper');
const copyBtn = document.getElementById('copyBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const viewModelAnswersBtn = document.getElementById('viewModelAnswersBtn');
const errorBanner = document.getElementById('errorBanner');
const errorMessage = document.getElementById('errorMessage');

// Form inputs
const classSelect = document.getElementById('classSelect');
const subjectSelect = document.getElementById('subjectSelect');
const chapterSelect = document.getElementById('chapterSelect');
const customChapterInput = document.getElementById('customChapterInput');
const toggleCustomChapterBtn = document.getElementById('toggleCustomChapterBtn');
const examType = document.getElementById('examType');
const difficultyLevel = document.getElementById('difficultyLevel');
const totalMarksInput = document.getElementById('totalMarks');
const examTimeInput = document.getElementById('examTime');
const mcqCountInput = document.getElementById('mcqCount');
const shortCountInput = document.getElementById('shortCount');
const longCountInput = document.getElementById('longCount');
const summaryTotalQuestions = document.getElementById('summaryTotalQuestions');
const summaryCalculatedMarks = document.getElementById('summaryCalculatedMarks');

// Floating Action Button
const floatingUploadBtn = document.getElementById('floatingUploadBtn');

// Upload Modal Elements
const uploadModal = document.getElementById('uploadModal');
const closeUploadModalBtn = document.getElementById('closeUploadModalBtn');
const cancelUploadBtn = document.getElementById('cancelUploadBtn');
const uploadDropzone = document.getElementById('uploadDropzone');
const answerSheetInput = document.getElementById('answerSheetInput');
const uploadedPagesGrid = document.getElementById('uploadedPagesGrid');
const submitCheckAnswersBtn = document.getElementById('submitCheckAnswersBtn');
const uploadEvaluationProgress = document.getElementById('uploadEvaluationProgress');
const evalProgressText = document.getElementById('evalProgressText');

// Evaluation Card & Marks Modal
const evalSummaryCard = document.getElementById('evalSummaryCard');
const statTotalScore = document.getElementById('statTotalScore');
const statPercentage = document.getElementById('statPercentage');
const statAttempted = document.getElementById('statAttempted');
const statNeedsReview = document.getElementById('statNeedsReview');
const openMarksModalBtn = document.getElementById('openMarksModalBtn');
const summaryViewModelAnswersBtn = document.getElementById('summaryViewModelAnswersBtn');

const marksModal = document.getElementById('marksModal');
const closeMarksModalBtn = document.getElementById('closeMarksModalBtn');
const closeMarksModalFooterBtn = document.getElementById('closeMarksModalFooterBtn');
const modalTotalMarksText = document.getElementById('modalTotalMarksText');
const modalPercentageText = document.getElementById('modalPercentageText');
const evalQuestionsList = document.getElementById('evalQuestionsList');

// Model Answers Modal
const modelAnswersModal = document.getElementById('modelAnswersModal');
const closeModelAnswersModalBtn = document.getElementById('closeModelAnswersModalBtn');
const closeModelAnswersFooterBtn = document.getElementById('closeModelAnswersFooterBtn');
const modelAnswersContent = document.getElementById('modelAnswersContent');
const modelAnswersLoading = document.getElementById('modelAnswersLoading');
const copyModelAnswersBtn = document.getElementById('copyModelAnswersBtn');

// Theme toggle
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeToggleIcon = document.getElementById('themeToggleIcon');

// ─────────────────────────────────────────────────────────────────────────────
// API Configuration
// ─────────────────────────────────────────────────────────────────────────────
function getClientSessionId() {
  let sid = sessionStorage.getItem('nb_paper_session_id');
  if (!sid) {
    sid = 'cs_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem('nb_paper_session_id', sid);
  }
  return sid;
}

function getApiBaseUrl() {
  const configured = document.querySelector('meta[name="paper-api-base"]')?.content?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '3000') return `http://${window.location.hostname}:3000`;
  return window.location.origin;
}

async function makeApiRequest(endpoint, payload) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    'X-Client-Session-Id': getClientSessionId()
  };

  try {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (tErr) {
    console.warn('[PaperGenerator] Token retrieval skipped:', tErr);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    throw new Error(`Server returned HTTP ${response.status}: ${text.slice(0, 100)}`);
  }

  if (!response.ok) {
    const err = new Error(data.error || data.reply || `Request failed with status ${response.status}`);
    err.status = response.status;
    err.code = data.code;
    throw err;
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────────────────────────────────────
function showError(msg) {
  errorMessage.textContent = msg;
  errorBanner.hidden = false;
  errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearError() {
  errorBanner.hidden = true;
  errorMessage.textContent = '';
}

function setLoading(isBusy, title = 'Setting Your Question Paper...', subtext = 'Aligning questions with NCERT syllabus standards...') {
  loading.hidden = !isBusy;
  generateBtn.disabled = isBusy;
  loadingTitle.textContent = title;
  loadingSubtext.textContent = subtext;

  generateBtn.setAttribute('aria-busy', String(isBusy));
  generateBtn.querySelector('.btn-label').textContent = isBusy ? 'Generating…' : 'Generate Paper';
  generateBtn.querySelector('.btn-icon').textContent = isBusy ? '⏳' : '🚀';
}

// ─────────────────────────────────────────────────────────────────────────────
// Curriculum Dropdown Population
// ─────────────────────────────────────────────────────────────────────────────
function populateSubjects() {
  const selectedClass = classSelect.value;
  const classData = CURRICULUM_DATA[selectedClass];

  subjectSelect.innerHTML = '';

  if (classData && classData.subjects) {
    Object.keys(classData.subjects).forEach((subj, idx) => {
      const opt = document.createElement('option');
      opt.value = subj;
      opt.textContent = subj;
      if (idx === 0) opt.selected = true;
      subjectSelect.appendChild(opt);
    });
  } else {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'No cataloged subjects';
    subjectSelect.appendChild(emptyOption);
    subjectSelect.disabled = true;
    chapterSelect.innerHTML = '';
    chapterSelect.disabled = true;
    return;
  }
  subjectSelect.disabled = false;

  populateChapters();
}

function populateChapters() {
  const selectedClass = classSelect.value;
  const selectedSubject = subjectSelect.value;
  const classData = CURRICULUM_DATA[selectedClass];

  chapterSelect.innerHTML = '';

  if (!classData?.subjects?.[selectedSubject]) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'Select a cataloged class and subject first';
    chapterSelect.appendChild(emptyOption);
    chapterSelect.disabled = true;
    return;
  }

  chapterSelect.disabled = false;
  // Always offer full scope within the local topic catalog.
  const fullOpt = document.createElement('option');
  fullOpt.value = 'Full Syllabus';
  fullOpt.textContent = '🌟 Full Prescribed Syllabus';
  chapterSelect.appendChild(fullOpt);

  if (classData && classData.subjects && classData.subjects[selectedSubject]) {
    const chapters = classData.subjects[selectedSubject].chapters;
    chapters.forEach((ch, idx) => {
      const opt = document.createElement('option');
      opt.value = ch;
      opt.textContent = `Ch ${idx + 1}: ${ch}`;
      chapterSelect.appendChild(opt);
    });
  }
}

function toggleCustomChapter(e) {
  if (e) e.preventDefault();
  isCustomChapterActive = !isCustomChapterActive;

  if (isCustomChapterActive) {
    chapterSelect.style.display = 'none';
    customChapterInput.style.display = 'block';
    customChapterInput.focus();
    toggleCustomChapterBtn.textContent = 'Choose from catalog';
  } else {
    chapterSelect.style.display = 'block';
    customChapterInput.style.display = 'none';
    toggleCustomChapterBtn.textContent = '+ Enter custom topic';
  }
}

function updateQuestionStructureSummary() {
  const mcq = Number(mcqCountInput.value) || 0;
  const short = Number(shortCountInput.value) || 0;
  const long = Number(longCountInput.value) || 0;

  const totalQuestions = mcq + short + long;
  const calculatedMarks = (mcq * 1) + (short * 2) + (long * 5);

  summaryTotalQuestions.textContent = String(totalQuestions);
  summaryCalculatedMarks.textContent = String(calculatedMarks);
}

// ─────────────────────────────────────────────────────────────────────────────
// Paper Generation Handler
// ─────────────────────────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (generateBtn.disabled) return;
  clearError();

  const classVal = classSelect.value;
  const subject = subjectSelect.value;
  const chapter = isCustomChapterActive
    ? customChapterInput.value.trim()
    : chapterSelect.value;
  if (isCustomChapterActive && !chapter) {
    showError('Enter a topic before generating a paper.');
    return;
  }
  const examMode = examType.value;
  const difficulty = difficultyLevel.value;
  const totalMarks = Number(totalMarksInput.value) || 50;
  const duration = Number(examTimeInput.value) || 90;

  const mcqCount = Number(mcqCountInput.value) || 0;
  const shortCount = Number(shortCountInput.value) || 0;
  const longCount = Number(longCountInput.value) || 0;

  if (!subject || !chapter) {
    showError('Select a cataloged subject and chapter scope.');
    return;
  }

  if (mcqCount + shortCount + longCount === 0) {
    showError('Please configure at least one question in Section A, B, or C.');
    return;
  }

  const includeRepeated = document.getElementById('includeRepeated').checked;
  const includeNCERT = document.getElementById('includeNCERT').checked;
  const includeNumericals = document.getElementById('includeNumericals').checked;
  const includeCaseStudy = document.getElementById('includeCaseStudy').checked;

  setLoading(true);

  try {
    const data = await makeApiRequest('/api/paper/generate', {
      classVal,
      subject,
      chapter,
      examMode,
      difficulty,
      totalMarks,
      duration,
      mcqCount,
      shortCount,
      longCount,
      includeRepeated,
      includeNCERT,
      includeNumericals,
      includeCaseStudy
    });

    if (!data.success || !data.paper) {
      throw new Error(data.error || 'Failed to generate paper.');
    }

    currentPaper = data.paper;
    currentEvaluation = null;
    currentModelAnswers = null;
    uploadedPages = [];
    pendingReads = 0;
    uploadBytesPending = 0;
    modelAnswersBtnBusy = false;
    renderUploadedThumbnails();

    // Reset evaluation card
    evalSummaryCard.hidden = true;

    // Render formatted question paper
    renderExamPaper(currentPaper);
    resultArea.hidden = false;

    // Reveal floating upload button
    floatingUploadBtn.hidden = !Boolean(currentPaper.paperId && Array.isArray(currentPaper.questions) && currentPaper.questions.length);

    // Scroll smoothly to results
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    console.error('[PaperGenerator] Generation error:', err);
    showError(err.message || 'Unable to generate question paper. Please try again.');
  } finally {
    setLoading(false);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Question Paper Renderer (NO MODEL ANSWERS LEAKED!)
// ─────────────────────────────────────────────────────────────────────────────
function renderExamPaper(paper) {
  const meta = paper.metadata || {};
  let html = '';

  // 1. Exam Header
  html += `
  <div class="exam-header-premium">
    <div class="school-name">NeoBranium Practice Paper &bull; ${paper.syllabusVersion || SYLLABUS_VERSION}</div>
    <h1 class="exam-subject-title">${escapeHtml(meta.subject || 'Examination')}</h1>
    <div class="exam-meta-grid">
      <div>Class: <strong>${escapeHtml(meta.classVal || '')}</strong></div>
      <div>Topic: <strong>${escapeHtml(meta.chapter || 'Full Syllabus')}</strong></div>
      <div>Time: <strong>${escapeHtml(String(paper.duration || 90))} Mins</strong></div>
      <div>Max Marks: <strong>${escapeHtml(String(paper.totalMarks || 50))}</strong></div>
    </div>
  </div>`;

  // 2. Instructions
  if (Array.isArray(paper.instructions) && paper.instructions.length > 0) {
    html += `
    <div class="exam-instructions-box">
      <div class="exam-instructions-title">General Instructions:</div>
      <ul class="exam-instructions-list">
        ${paper.instructions.map(inst => `<li>${escapeHtml(inst)}</li>`).join('')}
      </ul>
    </div>`;
  }

  // 3. Sections & Questions
  const sections = paper.sections || [];
  if (sections.length > 0) {
    sections.forEach(sec => {
      html += `
      <div class="section-block">
        <div class="section-heading-bar">
          <h2 class="section-heading-text">${escapeHtml(sec.sectionTitle || 'Section')}</h2>
          <span class="section-marks-badge">Section Marks</span>
        </div>`;

      if (Array.isArray(sec.questions)) {
        sec.questions.forEach(q => {
          html += `
          <div class="question-item" id="q-card-${escapeHtml(q.id || '')}">
            <div class="question-top-row">
              <span class="question-badge">Q${escapeHtml(String(q.number || ''))}.</span>
              <span class="question-marks">[${escapeHtml(String(q.maxMarks || 1))} Mark${Number(q.maxMarks) === 1 ? '' : 's'}]</span>
            </div>
            <p class="question-content">${escapeHtml(q.text || '')}</p>`;

          if (Array.isArray(q.subparts)) {
            html += '<div class="question-subparts">';
            q.subparts.forEach(part => {
              html += `<p><strong>${escapeHtml(part.label || '')}</strong> ${escapeHtml(part.text || '')} <span class="question-marks">[${escapeHtml(String(part.maxMarks || 0))} marks]</span></p>`;
            });
            html += '</div>';
          }

          // MCQ Options
          if (q.type === 'mcq' && Array.isArray(q.options) && q.options.length > 0) {
            html += `<div class="mcq-options-container">`;
            q.options.forEach(opt => {
              const optStr = String(opt).trim();
              const letterMatch = optStr.match(/^([A-D])\)\s*(.*)/i);
              const letter = letterMatch ? letterMatch[1].toUpperCase() : '•';
              const text = letterMatch ? letterMatch[2] : optStr;

              html += `
              <div class="mcq-option-card">
                <span class="mcq-option-letter">${letter})</span>
                <span>${escapeHtml(text)}</span>
              </div>`;
            });
            html += `</div>`;
          }

          html += `</div>`;
        });
      }

      html += `</div>`;
    });
  }

  resultText.innerHTML = html;

  // Render KaTeX expressions inside the paper container
  renderMathIfAvailable(resultText);
}

function renderMathIfAvailable(container) {
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(container, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
      });
    } catch (e) {
      console.warn('[KaTeX] Auto-render error:', e);
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating Action Button & Upload Modal
// ─────────────────────────────────────────────────────────────────────────────
floatingUploadBtn.addEventListener('click', () => {
  if (!currentPaper) {
    showError('Please generate a question paper first.');
    return;
  }
  openUploadModal();
});

function openUploadModal() {
  uploadModal.hidden = false;
  uploadModal.classList.add('open');
  clearError();
  document.body.style.overflow = 'hidden';
  closeUploadModalBtn.focus();
  if (floatingUploadBtn.getBoundingClientRect().top > window.innerHeight - 80) {
    floatingUploadBtn.style.visibility = 'hidden';
  }
}

function closeUploadModal() {
  uploadModal.classList.remove('open');
  uploadModal.hidden = true;
  document.body.style.overflow = '';
  floatingUploadBtn.style.visibility = '';
  floatingUploadBtn.focus();
}

closeUploadModalBtn.addEventListener('click', closeUploadModal);
cancelUploadBtn.addEventListener('click', closeUploadModal);

// Dropzone interactions
uploadDropzone.addEventListener('click', () => answerSheetInput.click());
uploadDropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    answerSheetInput.click();
  }
});

uploadDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadDropzone.classList.add('drag-over');
});

uploadDropzone.addEventListener('dragleave', () => {
  uploadDropzone.classList.remove('drag-over');
});

uploadDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadDropzone.classList.remove('drag-over');
  if (e.dataTransfer && e.dataTransfer.files) {
    handleSelectedFiles(Array.from(e.dataTransfer.files));
  }
});

answerSheetInput.addEventListener('change', () => {
  if (answerSheetInput.files) {
    handleSelectedFiles(Array.from(answerSheetInput.files));
  }
});

function handleSelectedFiles(files) {
  clearError();
  const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxPerImage = 5 * 1024 * 1024; // 5MB
  const maxTotalPages = 4;
  let selectedBytes = uploadedPages.reduce((sum, item) => sum + item.file.size, 0) + uploadBytesPending;

  for (const file of files) {
    if (uploadedPages.length >= maxTotalPages) {
      showError(`Maximum of ${maxTotalPages} answer-sheet pages allowed.`);
      break;
    }

    if (!validMimes.includes(file.type)) {
      showError(`Unsupported file: "${file.name}". Please upload JPEG, PNG, or WebP images.`);
      continue;
    }

    if (file.size > maxPerImage) {
      showError(`File "${file.name}" is too large (${(file.size / (1024*1024)).toFixed(1)} MB). Max 5 MB per page.`);
      continue;
    }
    if (selectedBytes + file.size > 16 * 1024 * 1024) {
      showError('The combined upload must be 16 MB or smaller. Remove a page or choose smaller images.');
      continue;
    }
    selectedBytes += file.size;
    uploadBytesPending += file.size;
    pendingReads++;

    // Read base64 & data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(',')[1];
      uploadedPages.push({
        file,
        dataUrl,
        base64,
        mimeType: file.type,
        pageNumber: uploadedPages.length + 1
      });

      renderUploadedThumbnails();
      pendingReads--;
      uploadBytesPending -= file.size;
    };
    reader.onerror = () => {
      pendingReads--;
      uploadBytesPending -= file.size;
      showError(`Could not read "${file.name}". Please try another image.`);
    };
    reader.readAsDataURL(file);
  }
}

function renderUploadedThumbnails() {
  uploadedPagesGrid.innerHTML = '';

  uploadedPages.forEach((page, index) => {
    page.pageNumber = index + 1;
    const card = document.createElement('div');
    card.className = 'page-thumb-card';
    card.innerHTML = `
      <img src="${page.dataUrl}" alt="Page ${page.pageNumber}" class="page-thumb-img" />
      <span class="page-number-tag">Page ${page.pageNumber}</span>
      <button type="button" class="page-remove-btn" data-index="${index}" aria-label="Remove page ${page.pageNumber}" title="Remove page">✕</button>
    `;

    card.querySelector('.page-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      uploadedPages.splice(index, 1);
      renderUploadedThumbnails();
    });

    uploadedPagesGrid.appendChild(card);
  });

  submitCheckAnswersBtn.disabled = uploadedPages.length === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Check My Answers — Submit for AI Evaluation
// ─────────────────────────────────────────────────────────────────────────────
submitCheckAnswersBtn.addEventListener('click', async () => {
  if (!currentPaper || !currentPaper.paperId) {
    showError('Please generate a question paper first.');
    return;
  }

  if (uploadedPages.length === 0) {
    showError('Please upload at least one photograph of your answer sheet.');
    return;
  }
  if (pendingReads > 0) {
    showError('Please wait for the selected images to finish loading.');
    return;
  }

  submitCheckAnswersBtn.disabled = true;
  cancelUploadBtn.disabled = true;
  uploadEvaluationProgress.style.display = 'block';
  evalProgressText.textContent = 'Transmitting answer-sheet pages securely...';

  try {
    const payload = {
      paperId: currentPaper.paperId,
      pages: uploadedPages.map(p => ({
        base64: p.base64,
        mimeType: p.mimeType,
        pageNumber: p.pageNumber
      }))
    };

    evalProgressText.textContent = 'Scanning handwriting and checking answers against this paper…';

    const data = await makeApiRequest('/api/paper/upload-evaluate', payload);

    if (!data.success || !data.result) {
      throw new Error(data.error || 'Evaluation failed.');
    }

    currentEvaluation = data.result;

    // Close upload modal
    closeUploadModal();

    // Render scorecard summary
    renderEvaluationSummary(currentEvaluation);

    // Keep the detailed breakdown available on demand from the scorecard.

  } catch (err) {
    console.error('[PaperGenerator] Evaluation error:', err);
    showError(`Evaluation failed: ${err.message || 'Please retry.'}`);
  } finally {
    submitCheckAnswersBtn.disabled = false;
    cancelUploadBtn.disabled = false;
    uploadEvaluationProgress.style.display = 'none';
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Summary & Question-Wise Marks
// ─────────────────────────────────────────────────────────────────────────────
function renderEvaluationSummary(result) {
  evalSummaryCard.hidden = false;
  statTotalScore.textContent = `${result.totalAwarded} / ${result.totalMaxMarks}`;
  statPercentage.textContent = `${result.percentage}%`;
  statAttempted.textContent = `${result.attemptedCount} / ${result.evaluations.length}`;
  statAttempted.setAttribute('aria-label', `${result.attemptedCount} attempted, ${result.unansweredCount} explicitly unanswered, ${result.reviewRequiredCount} need review`);
  statNeedsReview.textContent = `${result.reviewRequiredCount}`;

  // Color code
  if (result.percentage >= 75) {
    statPercentage.className = 'stat-val success';
  } else if (result.percentage >= 40) {
    statPercentage.className = 'stat-val warning';
  } else {
    statPercentage.className = 'stat-val error';
  }

  evalSummaryCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

openMarksModalBtn.addEventListener('click', openMarksModal);

function openMarksModal() {
  if (!currentEvaluation) return;

  modalTotalMarksText.textContent = `${currentEvaluation.totalAwarded} / ${currentEvaluation.totalMaxMarks} Marks`;
  modalPercentageText.textContent = `${currentEvaluation.percentage}% Score`;

  evalQuestionsList.innerHTML = '';

  currentEvaluation.evaluations.forEach(ev => {
    const card = document.createElement('div');
    const statusClass = ev.reviewRequired
      ? 'status-review'
        : ev.awardedMarks === ev.maxMarks
        ? 'status-correct'
        : ev.awardedMarks > 0
          ? 'status-partial'
          : 'status-incorrect';

    const pillClass = ev.reviewRequired
      ? 'review'
        : ev.awardedMarks === ev.maxMarks
        ? 'correct'
        : ev.awardedMarks > 0
          ? 'partial'
          : 'incorrect';

    card.className = `eval-q-card ${statusClass}`;
    card.innerHTML = `
      <div class="eval-q-top">
        <span class="eval-q-num">Q${escapeHtml(String(ev.questionNumber || ''))}${ev.subpart ? escapeHtml(String(ev.subpart)) : ''}</span>
        <div>
          ${ev.reviewRequired ? '<span class="review-badge">⚠️ Needs Review</span> ' : ''}
          <span class="eval-q-marks-pill ${pillClass}">
            ${ev.awardedMarks} / ${ev.maxMarks} Marks
          </span>
        </div>
      </div>
      
      <p class="eval-q-feedback"><strong>${escapeHtml(String(ev.status || '').replaceAll('_', ' '))}:</strong> ${escapeHtml(ev.rationale || '')}</p>

      ${ev.detectedAnswer ? `<div style="font-size: 0.85rem; color: var(--text-muted); margin: 0.35rem 0;"><em>Detected handwriting:</em> "${escapeHtml(ev.detectedAnswer)}"</div>` : ''}

      <div class="eval-q-detail">
        ${ev.whatWasCorrect ? `<div class="eval-q-correct-part">✓ <strong>Correct:</strong> ${escapeHtml(ev.whatWasCorrect)}</div>` : ''}
        ${ev.whatWasMissing ? `<div class="eval-q-missing-part">✗ <strong>Missing / Needed:</strong> ${escapeHtml(ev.whatWasMissing)}</div>` : ''}
      </div>
    `;

    evalQuestionsList.appendChild(card);
  });

  const footer = document.createElement('p');
  footer.className = 'marks-total-footer';
  footer.textContent = `Total: ${currentEvaluation.totalAwarded} / ${currentEvaluation.totalMaxMarks} marks`;
  evalQuestionsList.appendChild(footer);

  renderMathIfAvailable(evalQuestionsList);

  marksModal.hidden = false;
  marksModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  closeMarksModalBtn.focus();
  floatingUploadBtn.style.visibility = 'hidden';
}

function closeMarksModal() {
  marksModal.classList.remove('open');
  marksModal.hidden = true;
  document.body.style.overflow = '';
  floatingUploadBtn.style.visibility = '';
  openMarksModalBtn.focus();
}

closeMarksModalBtn.addEventListener('click', closeMarksModal);
closeMarksModalFooterBtn.addEventListener('click', closeMarksModal);

// ─────────────────────────────────────────────────────────────────────────────
// On-Demand Model Answers (MANDATORY: Hidden until requested)
// ─────────────────────────────────────────────────────────────────────────────
viewModelAnswersBtn.addEventListener('click', handleViewModelAnswers);
summaryViewModelAnswersBtn.addEventListener('click', handleViewModelAnswers);

async function handleViewModelAnswers() {
  if (!currentPaper || !currentPaper.paperId) {
    showError('Please generate a question paper first.');
    return;
  }

  modelAnswersModal.hidden = false;
  modelAnswersModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  closeModelAnswersModalBtn.focus();
  floatingUploadBtn.style.visibility = 'hidden';

  if (modelAnswersBtnBusy) return;

  // If already generated & cached locally:
  if (currentModelAnswers) {
    renderModelAnswers(currentModelAnswers);
    return;
  }

  modelAnswersLoading.style.display = 'block';
  viewModelAnswersBtn.disabled = true;
  summaryViewModelAnswersBtn.disabled = true;
  modelAnswersContent.innerHTML = '';

  modelAnswersBtnBusy = true;
  try {
    const data = await makeApiRequest('/api/paper/model-answers', {
      paperId: currentPaper.paperId
    });

    if (!data.success || !data.modelAnswers) {
      throw new Error(data.error || 'Failed to fetch model answers.');
    }

    currentModelAnswers = data.modelAnswers;
    renderModelAnswers(currentModelAnswers);

  } catch (err) {
    console.error('[PaperGenerator] Model answers error:', err);
    modelAnswersContent.innerHTML = `
      <div class="error-banner">
        <span>⚠️</span>
        <div>Unable to generate model answers: ${escapeHtml(err.message)}</div>
      </div>`;
  } finally {
    modelAnswersLoading.style.display = 'none';
    viewModelAnswersBtn.disabled = false;
    summaryViewModelAnswersBtn.disabled = false;
    modelAnswersBtnBusy = false;
  }
}

function renderModelAnswers(answers) {
  modelAnswersContent.innerHTML = '';

  if (!Array.isArray(answers) || answers.length === 0) {
    modelAnswersContent.innerHTML = '<p>No model answers available.</p>';
    return;
  }

  answers.forEach(ans => {
    const card = document.createElement('div');
    card.className = 'model-ans-card';

    let rubricHtml = '';
    if (Array.isArray(ans.stepWiseRubric) && ans.stepWiseRubric.length > 0) {
      rubricHtml = `
      <div class="model-step-rubric">
        <strong>Marking Rubric:</strong>
        <ul style="margin: 0.35rem 0 0 1.25rem; padding: 0;">
          ${ans.stepWiseRubric.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
        </ul>
      </div>`;
    }

    card.innerHTML = `
      <div class="model-ans-header">
        <span>Question ${escapeHtml(String(ans.questionNumber || ''))}</span>
        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">[${escapeHtml(String(ans.maxMarks || ''))} Marks]</span>
      </div>
      <div class="model-ans-body">
        <strong>Solution:</strong> ${escapeHtml(ans.correctAnswer || ans.solution || '')}
        ${ans.explanation ? `<div style="margin-top: 0.4rem;">${escapeHtml(ans.explanation)}</div>` : ''}
        ${rubricHtml}
      </div>
    `;

    modelAnswersContent.appendChild(card);
  });

  renderMathIfAvailable(modelAnswersContent);
}

function closeModelAnswersModal() {
  modelAnswersModal.classList.remove('open');
  modelAnswersModal.hidden = true;
  document.body.style.overflow = '';
  floatingUploadBtn.style.visibility = '';
  viewModelAnswersBtn.focus();
}

closeModelAnswersModalBtn.addEventListener('click', closeModelAnswersModal);
closeModelAnswersFooterBtn.addEventListener('click', closeModelAnswersModal);

copyModelAnswersBtn.addEventListener('click', async () => {
  try {
    const text = modelAnswersContent.innerText || modelAnswersContent.textContent;
    await navigator.clipboard.writeText(text);
    copyModelAnswersBtn.innerHTML = '<span>✅</span> Copied!';
    setTimeout(() => {
      copyModelAnswersBtn.innerHTML = '<span>📋</span> Copy Answers';
    }, 2000);
  } catch (err) {
    alert('Failed to copy to clipboard.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Copy & PDF Download
// ─────────────────────────────────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  try {
    const text = resultText.innerText || resultText.textContent;
    await navigator.clipboard.writeText(text);
    copyBtn.innerHTML = '<span class="btn-icon">✅</span> Copied!';
    setTimeout(() => {
      copyBtn.innerHTML = '<span class="btn-icon">📋</span> Copy Paper';
    }, 2000);
  } catch (err) {
    alert('Failed to copy to clipboard.');
  }
});

downloadPdfBtn.addEventListener('click', () => {
  const element = document.getElementById('generated-paper');
  if (typeof html2pdf !== 'undefined') {
    const options = {
      margin: 0.5,
      filename: `neobranium-${(currentPaper?.metadata?.subject || 'exam').toLowerCase()}-class${currentPaper?.metadata?.classVal || '10'}-${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(options).from(element).save();
  } else {
    // Native print fallback
    window.print();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard & Accessibility (Esc to close open modals)
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!uploadModal.hidden) closeUploadModal();
    if (!marksModal.hidden) closeMarksModal();
    if (!modelAnswersModal.hidden) closeModelAnswersModal();
  }
});

// Close modals when clicking backdrop
[uploadModal, marksModal, modelAnswersModal].forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      if (backdrop === uploadModal) closeUploadModal();
      if (backdrop === marksModal) closeMarksModal();
      if (backdrop === modelAnswersModal) closeModelAnswersModal();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dark Mode Toggle
// ─────────────────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved === 'dark' || (!saved && prefersDark);

  if (isDark) {
    document.body.classList.add('dark');
    document.body.setAttribute('data-theme', 'dark');
    themeToggleIcon.textContent = '☀️';
  } else {
    document.body.classList.remove('dark');
    document.body.setAttribute('data-theme', 'light');
    themeToggleIcon.textContent = '🌙';
  }
}

themeToggleBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  themeToggleIcon.textContent = isDark ? '☀️' : '🌙';
});

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────
classSelect.addEventListener('change', populateSubjects);
subjectSelect.addEventListener('change', populateChapters);
toggleCustomChapterBtn.addEventListener('click', toggleCustomChapter);

[mcqCountInput, shortCountInput, longCountInput].forEach(inp => {
  inp.addEventListener('input', updateQuestionStructureSummary);
});

initTheme();
populateSubjects();
updateQuestionStructureSummary();
