/**
 * NeoBook Quiz Feature
 * Handles all client-side quiz flow: config → generation → active session → results.
 * Imported and initialised by neobook-app.js via initQuizFeature().
 */

// ── Quiz State ────────────────────────────────────────────────────────────────
let quizState = {
  currentQuiz: null,       // full quiz object returned by backend
  currentIndex: 0,         // 0-based question pointer
  userAnswers: {},          // { questionIndex: selectedOptionIndex }
  submitted: {},            // { questionIndex: true } – submitted answers (locked)
  currentAttemptId: null,  // Firestore attempt doc id once recorded
  isGenerating: false       // guard against duplicate requests
};

// ── DOM helpers ───────────────────────────────────────────────────────────────
function qs(id) { return document.getElementById(id); }

function showQuizView(viewId) {
  ['quizConfigView', 'quizLoadingView', 'quizActiveView', 'quizResultsView']
    .forEach(id => {
      const el = qs(id);
      if (el) el.style.display = (id === viewId) ? 'flex' : 'none';
    });
}

// ── Exported init function ────────────────────────────────────────────────────
export function initQuizFeature(appState, apiFn, escapeHtmlFn, showToastFn) {

  // ── Open quiz modal from Studio card ──────────────────────────────────────
  const quizCard = qs('btnOpenQuizModal');
  if (quizCard) {
    quizCard.addEventListener('click', () => openQuizConfigModal(appState));
    quizCard.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openQuizConfigModal(appState);
    });
  }

  // ── Close buttons ─────────────────────────────────────────────────────────
  ['btnCloseQuizModal', 'btnCancelQuizConfig'].forEach(id => {
    const el = qs(id);
    if (el) el.addEventListener('click', closeQuizModal);
  });

  ['btnCloseActiveQuiz', 'btnCloseQuizResults'].forEach(id => {
    const el = qs(id);
    if (el) el.addEventListener('click', closeQuizModal);
  });

  // Click outside overlay
  const overlay = qs('quizModal');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeQuizModal();
    });
  }

  // ── Difficulty pills ──────────────────────────────────────────────────────
  const diffGroup = qs('quizDifficultyGroup');
  if (diffGroup) {
    diffGroup.querySelectorAll('.quiz-pill-btn[data-difficulty]').forEach(btn => {
      btn.addEventListener('click', () => {
        diffGroup.querySelectorAll('.quiz-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // ── Question count pills ──────────────────────────────────────────────────
  const countGroup = qs('quizCountGroup');
  if (countGroup) {
    countGroup.querySelectorAll('.quiz-pill-btn[data-count]').forEach(btn => {
      btn.addEventListener('click', () => {
        countGroup.querySelectorAll('.quiz-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // ── Generate quiz ─────────────────────────────────────────────────────────
  const btnGenerate = qs('btnStartGenerateQuiz');
  if (btnGenerate) {
    btnGenerate.addEventListener('click', () => handleGenerateQuiz(appState, apiFn, showToastFn));
  }

  // ── Active quiz navigation ────────────────────────────────────────────────
  const btnPrev = qs('btnQuizPrev');
  const btnNext = qs('btnQuizNext');
  const btnSubmit = qs('btnQuizSubmit');

  if (btnSubmit) {
    btnSubmit.addEventListener('click', () => handleSubmitAnswer(appState, apiFn, showToastFn, escapeHtmlFn));
  }
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (quizState.currentIndex > 0) {
        quizState.currentIndex--;
        renderCurrentQuestion(escapeHtmlFn);
      }
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const total = quizState.currentQuiz?.questions?.length || 0;
      if (quizState.currentIndex < total - 1) {
        quizState.currentIndex++;
        renderCurrentQuestion(escapeHtmlFn);
      } else {
        // Last question navigated – finish quiz
        finishQuiz(appState, apiFn, showToastFn, escapeHtmlFn);
      }
    });
  }

  // ── Results actions ───────────────────────────────────────────────────────
  const btnRetake = qs('btnRetakeQuiz');
  if (btnRetake) {
    btnRetake.addEventListener('click', () => {
      if (quizState.currentQuiz) {
        // reset state and replay the same quiz
        quizState.currentIndex = 0;
        quizState.userAnswers = {};
        quizState.submitted = {};
        quizState.currentAttemptId = null;
        showQuizView('quizActiveView');
        renderCurrentQuestion(escapeHtmlFn);
      }
    });
  }

  const btnNewQuiz = qs('btnNewQuizFromResults');
  if (btnNewQuiz) {
    btnNewQuiz.addEventListener('click', () => {
      quizState = { currentQuiz: null, currentIndex: 0, userAnswers: {}, submitted: {}, currentAttemptId: null, isGenerating: false };
      openQuizConfigModal(appState);
    });
  }

  // Load recent quizzes into studio on init
  loadNotebookQuizzes(appState, apiFn, showToastFn, escapeHtmlFn);
}

// ── Open config modal ─────────────────────────────────────────────────────────
function openQuizConfigModal(appState) {
  const modal = qs('quizModal');
  if (!modal) return;

  // Reset to config view
  showQuizView('quizConfigView');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  populateSourceSelector(appState);
}

function closeQuizModal() {
  const modal = qs('quizModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Populate source checkboxes ────────────────────────────────────────────────
function populateSourceSelector(appState) {
  const container = qs('quizSourceSelector');
  if (!container) return;

  const readySources = (appState.sources || []).filter(s => s.status === 'ready');

  if (readySources.length === 0) {
    container.innerHTML = `<div class="quiz-no-sources-msg">
      <i class="fas fa-circle-info"></i> No ready sources found. Add at least one source before generating a quiz.
    </div>`;
    return;
  }

  container.innerHTML = readySources.map(src => {
    const typeLabel = { url: 'Website', youtube: 'YouTube', pdf: 'PDF', text: 'Note' }[src.type] || src.type;
    const shortTitle = (src.title || 'Untitled').slice(0, 50);
    return `<label class="quiz-source-check-row">
      <input type="checkbox" class="quiz-source-check" value="${src.id}" checked>
      <span class="quiz-source-check-label">${escapeHtmlInline(shortTitle)}</span>
      <span class="quiz-source-check-type">${typeLabel}</span>
    </label>`;
  }).join('');
}

function escapeHtmlInline(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Handle generate quiz ──────────────────────────────────────────────────────
async function handleGenerateQuiz(appState, apiFn, showToastFn) {
  if (quizState.isGenerating) return;

  const notebookId = appState.activeNotebook?.id;
  if (!notebookId) {
    showToastFn('No active notebook found. Please start a chat session first.', 'error');
    return;
  }

  // Collect selected sources
  const checkedBoxes = document.querySelectorAll('.quiz-source-check:checked');
  const sourceIds = Array.from(checkedBoxes).map(cb => cb.value);

  if (sourceIds.length === 0) {
    showToastFn('Please select at least one source to generate questions from.', 'error');
    return;
  }

  // Collect difficulty
  const activeDiff = qs('quizDifficultyGroup')?.querySelector('.quiz-pill-btn.active');
  const difficulty = activeDiff?.dataset.difficulty || 'medium';

  // Collect count
  const activeCount = qs('quizCountGroup')?.querySelector('.quiz-pill-btn.active');
  const count = parseInt(activeCount?.dataset.count || '5', 10);

  quizState.isGenerating = true;

  // Switch to loading view
  showQuizView('quizLoadingView');

  try {
    const result = await apiFn(`/api/neobook/notebooks/${notebookId}/quizzes/generate`, {
      method: 'POST',
      body: JSON.stringify({ sourceIds, difficulty, count })
    });

    if (!result.success || !result.quiz) {
      throw new Error(result.error || 'Quiz generation failed. Please try again.');
    }

    quizState.currentQuiz = result.quiz;
    quizState.currentIndex = 0;
    quizState.userAnswers = {};
    quizState.submitted = {};
    quizState.currentAttemptId = null;
    quizState.isGenerating = false;

    showToastFn(`Quiz ready! ${result.quiz.questions.length} questions generated.`, 'success');
    showQuizView('quizActiveView');
    renderCurrentQuestion(escapeHtmlInline);

  } catch (err) {
    quizState.isGenerating = false;
    showToastFn(err.message || 'Failed to generate quiz.', 'error');
    showQuizView('quizConfigView');
  }
}

// ── Render current question ───────────────────────────────────────────────────
function renderCurrentQuestion(escapeHtmlFn) {
  const quiz = quizState.currentQuiz;
  if (!quiz || !quiz.questions || quiz.questions.length === 0) return;

  const idx = quizState.currentIndex;
  const q = quiz.questions[idx];
  const total = quiz.questions.length;

  // Header meta
  const diffTag = qs('activeQuizDifficultyTag');
  if (diffTag) {
    diffTag.textContent = capitalise(quiz.difficulty || 'Mixed');
  }
  const quizTitle = qs('activeQuizTitle');
  if (quizTitle) quizTitle.textContent = quiz.title || 'Knowledge Quiz';

  // Progress
  const progressText = qs('quizProgressText');
  if (progressText) progressText.textContent = `Question ${idx + 1} of ${total}`;

  const progressFill = qs('quizProgressBarFill');
  if (progressFill) progressFill.style.width = `${((idx + 1) / total) * 100}%`;

  // Topic tag
  const topicTag = qs('quizQuestionTopic');
  if (topicTag) topicTag.textContent = q.topic || 'General';

  // Question title
  const qTitle = qs('quizQuestionTitle');
  if (qTitle) qTitle.textContent = q.question || '';

  // Options
  const optionsList = qs('quizOptionsList');
  if (optionsList) {
    const keys = ['A', 'B', 'C', 'D'];
    const isSubmitted = quizState.submitted[idx] === true;
    const userAnswer = quizState.userAnswers[idx];
    const correctIndex = q.correctIndex ?? q.correct_index ?? 0;

    optionsList.innerHTML = (q.options || []).map((opt, i) => {
      let cls = 'quiz-option-btn';
      if (isSubmitted) {
        if (i === correctIndex) cls += ' correct';
        else if (i === userAnswer && i !== correctIndex) cls += ' incorrect';
        else cls += ' reveal-correct'; // removed - only add for the actual correct one
      } else if (i === userAnswer) {
        cls += ' selected';
      }

      const disabledAttr = isSubmitted ? 'disabled' : '';

      return `<button class="${cls}" data-index="${i}" ${disabledAttr}>
        <span class="quiz-option-key">${keys[i] || i + 1}</span>
        <span class="quiz-option-text">${escapeHtmlFn(opt)}</span>
      </button>`;
    }).join('');

    // Bind option clicks if not submitted
    if (!isSubmitted) {
      optionsList.querySelectorAll('.quiz-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const optIdx = parseInt(btn.dataset.index, 10);
          quizState.userAnswers[idx] = optIdx;

          // Update visual selection
          optionsList.querySelectorAll('.quiz-option-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');

          // Enable submit
          const submitBtn = qs('btnQuizSubmit');
          if (submitBtn) submitBtn.disabled = false;
        });
      });
    }

    // Disable submit if already submitted
    const submitBtn = qs('btnQuizSubmit');
    if (submitBtn) {
      submitBtn.disabled = isSubmitted || quizState.userAnswers[idx] === undefined;
    }
  }

  // Feedback
  const feedbackBox = qs('quizFeedbackBox');
  if (feedbackBox) {
    if (quizState.submitted[idx]) {
      showFeedback(idx, q);
    } else {
      feedbackBox.style.display = 'none';
      feedbackBox.className = 'quiz-feedback-box';
    }
  }

  // Nav buttons
  const btnPrev = qs('btnQuizPrev');
  const btnNext = qs('btnQuizNext');
  const btnSubmit = qs('btnQuizSubmit');

  if (btnPrev) btnPrev.disabled = idx === 0;

  if (quizState.submitted[idx]) {
    // Submitted: hide submit, show next
    if (btnSubmit) btnSubmit.style.display = 'none';
    if (btnNext) {
      btnNext.style.display = 'inline-flex';
      btnNext.innerHTML = idx === total - 1
        ? '<i class="fas fa-flag-checkered"></i> Finish'
        : 'Next <i class="fas fa-arrow-right"></i>';
    }
  } else {
    // Not submitted: show submit, hide next
    if (btnSubmit) btnSubmit.style.display = 'inline-flex';
    if (btnNext) btnNext.style.display = 'none';
  }
}

function showFeedback(idx, q) {
  const feedbackBox = qs('quizFeedbackBox');
  if (!feedbackBox) return;

  const correctIndex = q.correctIndex ?? q.correct_index ?? 0;
  const userAnswer = quizState.userAnswers[idx];
  const isCorrect = userAnswer === correctIndex;

  feedbackBox.className = `quiz-feedback-box ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`;
  feedbackBox.style.display = 'flex';

  const header = qs('quizFeedbackHeader');
  const result = qs('quizFeedbackResult');
  const explanation = qs('quizExplanationText');
  const citation = qs('quizCitationBadge');
  const citText = qs('quizCitationText');

  if (header) header.innerHTML = isCorrect
    ? '<i class="fas fa-check-circle"></i>'
    : '<i class="fas fa-times-circle"></i>';
  if (result) result.textContent = isCorrect ? 'Correct!' : 'Incorrect';
  if (explanation) explanation.textContent = q.explanation || 'No explanation provided.';

  if (citation && citText) {
    const srcRef = q.source_title || q.sourceTitle;
    if (srcRef) {
      citText.textContent = srcRef + (q.timestamp ? ` (${q.timestamp})` : q.pageNum ? ` (p. ${q.pageNum})` : '');
      citation.style.display = 'inline-flex';
    } else {
      citation.style.display = 'none';
    }
  }
}

// ── Handle answer submission ──────────────────────────────────────────────────
function handleSubmitAnswer(appState, apiFn, showToastFn, escapeHtmlFn) {
  const idx = quizState.currentIndex;
  if (quizState.submitted[idx]) return;
  if (quizState.userAnswers[idx] === undefined) {
    showToastFn('Please select an answer before submitting.', 'error');
    return;
  }

  quizState.submitted[idx] = true;
  renderCurrentQuestion(escapeHtmlInline);
}

// ── Finish quiz and show results ──────────────────────────────────────────────
async function finishQuiz(appState, apiFn, showToastFn, escapeHtmlFn) {
  const quiz = quizState.currentQuiz;
  if (!quiz) return;

  const notebookId = appState.activeNotebook?.id;

  // Build attempt answers array
  const answers = quiz.questions.map((q, i) => ({
    questionIndex: i,
    selectedIndex: quizState.userAnswers[i] ?? null
  }));

  // Record attempt on backend
  try {
    if (notebookId && quiz.id) {
      const attemptResult = await apiFn(
        `/api/neobook/notebooks/${notebookId}/quizzes/${quiz.id}/attempts`,
        {
          method: 'POST',
          body: JSON.stringify({ answers })
        }
      );
      if (attemptResult.success && attemptResult.attempt) {
        quizState.currentAttemptId = attemptResult.attempt.id;
      }
    }
  } catch (err) {
    console.warn('[NeoBook Quiz] Could not record attempt:', err.message);
  }

  // Compute results locally for display
  const total = quiz.questions.length;
  const correct = quiz.questions.filter((q, i) => {
    const correctIndex = q.correctIndex ?? q.correct_index ?? 0;
    return quizState.userAnswers[i] === correctIndex;
  }).length;

  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  renderResultsView(quiz, correct, total, pct, escapeHtmlInline);
  showQuizView('quizResultsView');

  // Reload quiz list in studio
  loadNotebookQuizzes(appState, apiFn, showToastFn, escapeHtmlInline);
}

// ── Render results ────────────────────────────────────────────────────────────
function renderResultsView(quiz, correct, total, pct, escapeHtmlFn) {
  // Score circle
  const circleEl = qs('scoreCircle');
  if (circleEl) {
    const deg = (pct / 100) * 360;
    const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#6366f1' : pct >= 40 ? '#f59e0b' : '#ef4444';
    circleEl.style.background = `conic-gradient(${color} ${deg}deg, var(--nb-panel-bg) ${deg}deg)`;
  }

  const pctEl = qs('scorePercentage');
  if (pctEl) pctEl.textContent = `${pct}%`;

  // Badge
  const badge = qs('scoreBadge');
  if (badge) {
    let label, cls;
    if (pct >= 80) { label = '🎖 Excellent'; cls = 'excellent'; }
    else if (pct >= 60) { label = '👍 Good'; cls = 'good'; }
    else if (pct >= 40) { label = '📝 Average'; cls = 'average'; }
    else { label = '📚 Needs Work'; cls = 'needs-work'; }
    badge.textContent = label;
    badge.className = `score-badge ${cls}`;
  }

  // Stats
  const statsText = qs('scoreStatsText');
  if (statsText) statsText.textContent = `You answered ${correct} out of ${total} questions correctly.`;

  const encouragement = qs('scoreEncouragement');
  if (encouragement) {
    if (pct === 100) encouragement.textContent = 'Perfect score! Outstanding mastery of your sources.';
    else if (pct >= 80) encouragement.textContent = 'Great job! Review the few missed answers below to reach mastery.';
    else if (pct >= 60) encouragement.textContent = 'Good effort! Reviewing the explanations below will strengthen your understanding.';
    else encouragement.textContent = 'Keep going — review each explanation below and try again to improve your score.';
  }

  // Subtitle
  const subtitle = qs('quizResultsSubtitle');
  if (subtitle) {
    subtitle.textContent = `${quiz.difficulty ? capitalise(quiz.difficulty) : 'Mixed'} • ${total} questions`;
  }

  // Topic breakdown
  const topicsCard = qs('quizTopicsCard');
  const topicsGrid = qs('quizTopicsGrid');
  if (topicsCard && topicsGrid) {
    const topicMap = {};
    quiz.questions.forEach((q, i) => {
      const topic = q.topic || 'General';
      if (!topicMap[topic]) topicMap[topic] = { correct: 0, total: 0 };
      topicMap[topic].total++;
      const correctIndex = q.correctIndex ?? q.correct_index ?? 0;
      if (quizState.userAnswers[i] === correctIndex) topicMap[topic].correct++;
    });

    const topics = Object.entries(topicMap);
    if (topics.length > 1) {
      topicsGrid.innerHTML = topics.map(([topic, { correct: c, total: t }]) => {
        const tPct = Math.round((c / t) * 100);
        return `<div class="topic-row">
          <span class="topic-row-label" title="${escapeHtmlFn(topic)}">${escapeHtmlFn(topic.slice(0, 18))}</span>
          <div class="topic-row-bar-wrap">
            <div class="topic-row-bar-fill" style="width:${tPct}%"></div>
          </div>
          <span class="topic-row-score">${c}/${t}</span>
        </div>`;
      }).join('');
      topicsCard.style.display = '';
    } else {
      topicsCard.style.display = 'none';
    }
  }

  // Question review
  const reviewList = qs('quizReviewList');
  const reviewCountBadge = qs('reviewCountBadge');
  if (reviewCountBadge) reviewCountBadge.textContent = `${total} Questions`;

  if (reviewList) {
    reviewList.innerHTML = quiz.questions.map((q, i) => {
      const correctIndex = q.correctIndex ?? q.correct_index ?? 0;
      const userAns = quizState.userAnswers[i];
      const isCorrect = userAns === correctIndex;
      const keys = ['A', 'B', 'C', 'D'];

      const userAnswerText = userAns !== undefined ? (q.options?.[userAns] || '—') : 'Not answered';
      const correctAnswerText = q.options?.[correctIndex] || '—';
      const srcRef = q.source_title || q.sourceTitle;

      return `<div class="quiz-review-item ${isCorrect ? 'review-correct' : 'review-incorrect'}" data-review-idx="${i}">
        <div class="quiz-review-item-header">
          <span class="review-result-icon"><i class="fas fa-${isCorrect ? 'check-circle' : 'times-circle'}"></i></span>
          <span class="review-question-text">Q${i + 1}. ${escapeHtmlFn(q.question || '')}</span>
          <i class="fas fa-chevron-down review-toggle-icon"></i>
        </div>
        <div class="quiz-review-item-body">
          ${!isCorrect ? `<div class="review-answer-row">
            <span class="review-answer-label">Your answer:</span>
            <span class="review-answer-value wrong">${keys[userAns] ? keys[userAns] + '. ' : ''}${escapeHtmlFn(userAnswerText)}</span>
          </div>` : ''}
          <div class="review-answer-row">
            <span class="review-answer-label">Correct:</span>
            <span class="review-answer-value correct">${keys[correctIndex]}. ${escapeHtmlFn(correctAnswerText)}</span>
          </div>
          <div class="review-explanation">${escapeHtmlFn(q.explanation || 'No explanation provided.')}</div>
          ${srcRef ? `<span class="review-citation"><i class="fas fa-quote-left"></i> ${escapeHtmlFn(srcRef)}${q.timestamp ? ' (' + q.timestamp + ')' : q.pageNum ? ' (p. ' + q.pageNum + ')' : ''}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    // Bind accordion
    reviewList.querySelectorAll('.quiz-review-item-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.quiz-review-item');
        if (item) item.classList.toggle('expanded');
      });
    });
  }
}

// ── Load recent quizzes into Studio panel ─────────────────────────────────────
async function loadNotebookQuizzes(appState, apiFn, showToastFn, escapeHtmlFn) {
  const notebookId = appState.activeNotebook?.id;
  if (!notebookId) return;

  const section = qs('studioQuizzesSection');
  const list = qs('studioQuizzesList');
  if (!section || !list) return;

  try {
    const result = await apiFn(`/api/neobook/notebooks/${notebookId}/quizzes`);
    if (!result.success || !result.quizzes || result.quizzes.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    list.innerHTML = result.quizzes.slice(0, 5).map(quiz => {
      const date = quiz.createdAt ? new Date(quiz.createdAt._seconds * 1000).toLocaleDateString() : '';
      const scoreLabel = quiz.lastScore !== undefined ? `${quiz.lastScore}%` : 'Not taken';
      const title = (quiz.title || `Quiz – ${capitalise(quiz.difficulty || 'mixed')}`).slice(0, 40);

      return `<div class="studio-quiz-item" data-quiz-id="${quiz.id}">
        <div class="studio-quiz-item-left">
          <div class="studio-quiz-item-title">${escapeHtmlFn(title)}</div>
          <div class="studio-quiz-item-meta">${quiz.questionCount || '?'} questions • ${capitalise(quiz.difficulty || 'mixed')}${date ? ' • ' + date : ''}</div>
        </div>
        <span class="studio-quiz-item-score">${scoreLabel}</span>
      </div>`;
    }).join('');

    // Bind click to reopen quiz
    list.querySelectorAll('.studio-quiz-item').forEach(item => {
      item.addEventListener('click', async () => {
        const quizId = item.dataset.quizId;
        await reopenQuiz(notebookId, quizId, apiFn, showToastFn, escapeHtmlFn);
      });
    });

  } catch (err) {
    console.warn('[NeoBook Quiz] Could not load quizzes:', err.message);
    section.style.display = 'none';
  }
}

// ── Reopen a saved quiz ───────────────────────────────────────────────────────
async function reopenQuiz(notebookId, quizId, apiFn, showToastFn, escapeHtmlFn) {
  try {
    const result = await apiFn(`/api/neobook/notebooks/${notebookId}/quizzes/${quizId}`);
    if (!result.success || !result.quiz) throw new Error('Quiz not found.');

    quizState.currentQuiz = result.quiz;
    quizState.currentIndex = 0;
    quizState.userAnswers = {};
    quizState.submitted = {};
    quizState.currentAttemptId = null;

    openQuizModal();
    showQuizView('quizActiveView');
    renderCurrentQuestion(escapeHtmlFn);
    showToastFn('Quiz loaded. Good luck!', 'success');
  } catch (err) {
    showToastFn('Could not load quiz: ' + err.message, 'error');
  }
}

function openQuizModal() {
  const modal = qs('quizModal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

