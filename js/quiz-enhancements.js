/**
 * quiz-enhancements.js
 * Comprehensive quiz enhancement layer for NeoBranium.
 *
 * Features:
 *  1. Visual progress bar + question counter
 *  2. Per-question result review panel with correct answers highlighted
 *  3. Bookmark/save difficult questions (localStorage)
 *  4. Contextual "What's Next" suggestions after quiz completion
 *  5. Activity tracking integration (calls recordQuizCompletion from activity.js)
 *
 * Security: No external data sent; uses localStorage for bookmarks.
 * Compatibility: Works on all existing quiz HTML pages without HTML changes.
 */

(function () {
  "use strict";

  const BOOKMARKS_KEY = "neobranium_quiz_bookmarks";
  const MAX_BOOKMARKS = 100;

  // ─── Utility ────────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ─── Bookmark helpers ───────────────────────────────────────────────────────
  function getBookmarks() {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }

  function saveBookmarks(list) {
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list.slice(0, MAX_BOOKMARKS))); } catch {}
  }

  function isBookmarked(id) { return getBookmarks().some(b => b.id === id); }

  function toggleBookmark(item) {
    let list = getBookmarks();
    const idx = list.findIndex(b => b.id === item.id);
    if (idx >= 0) { list.splice(idx, 1); } else { list.unshift({ ...item, savedAt: new Date().toISOString() }); }
    saveBookmarks(list);
    return idx < 0;
  }

  // ─── Progress Bar ───────────────────────────────────────────────────────────
  function injectProgressBar() {
    if (document.getElementById("nbQuizProgressBar")) return;
    const bar = document.createElement("div");
    bar.id = "nbQuizProgressWrap";
    bar.innerHTML = '<div id="nbQuizProgressBar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Quiz progress"><div id="nbQuizProgressFill"></div></div><span id="nbQuizProgressLabel" class="nb-qprogress-label"></span>';
    const container = document.getElementById("quizContainer") || document.querySelector("main");
    if (container) container.parentElement?.insertBefore(bar, container);
    if (!document.getElementById("nbQuizEnhancementsStyle")) injectStyles();
  }

  function updateProgress(answered, total) {
    const fill = document.getElementById("nbQuizProgressFill");
    const label = document.getElementById("nbQuizProgressLabel");
    const bar = document.getElementById("nbQuizProgressBar");
    if (!fill || !label || !bar) return;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    fill.style.width = pct + "%";
    bar.setAttribute("aria-valuenow", pct);
    label.textContent = answered + " / " + total + " answered";
  }

  function watchAnswerSelection(quizContainer, totalQ) {
    if (!quizContainer) return;
    quizContainer.addEventListener("change", () => {
      const names = new Set();
      quizContainer.querySelectorAll("input[type='radio']").forEach(r => names.add(r.name));
      let answered = 0;
      names.forEach(name => { if (quizContainer.querySelector("input[name='" + name + "']:checked")) answered++; });
      updateProgress(answered, totalQ);
    });
  }

  function getDeterministicId(item, idx) {
    let hash = 0;
    const str = (window.location.pathname || "") + "_" + (item.question || "") + "_" + idx;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return "nbq_" + Math.abs(hash);
  }

  // ─── Review panel builder ───────────────────────────────────────────────────
  function buildReviewPanel(quizData, level, userAnswers) {
    const questions = quizData[level] || [];
    let correct = 0, incorrect = 0, unanswered = 0;

    const cards = questions.map((item, idx) => {
      const userAns = userAnswers["q" + idx];
      const isRight = userAns && userAns === item.answer;
      const isWrong = userAns && userAns !== item.answer;
      if (isRight) correct++;
      else if (isWrong) incorrect++;
      else unanswered++;

      const qId = getDeterministicId(item, idx);
      const bookmarked = isBookmarked(qId);

      const optionRows = item.options.map(opt => {
        const isCorrect = opt === item.answer;
        const isUserWrong = opt === userAns && !isRight;
        let cls = "nb-review-option";
        if (isCorrect) cls += " nb-review-option--correct";
        if (isUserWrong) cls += " nb-review-option--wrong";
        const icon = isCorrect ? "&#10003;" : isUserWrong ? "&#10007;" : "&bull;";
        return '<div class="' + cls + '"><span class="nb-review-opt-icon">' + icon + '</span> ' + esc(opt) + '</div>';
      }).join("");

      const statusBadge = isRight
        ? '<span class="nb-review-badge nb-review-badge--correct"><i class="bi bi-check-circle-fill"></i> Correct</span>'
        : isWrong
        ? '<span class="nb-review-badge nb-review-badge--wrong"><i class="bi bi-x-circle-fill"></i> Wrong</span>'
        : '<span class="nb-review-badge nb-review-badge--skip"><i class="bi bi-dash-circle"></i> Skipped</span>';

      const correctAnsLine = !isRight && userAns
        ? '<div class="nb-review-correct-ans"><strong>Correct answer:</strong> ' + esc(item.answer) + '</div>'
        : "";

      return '<div class="nb-review-card ' + (isRight ? "nb-review-card--correct" : isWrong ? "nb-review-card--wrong" : "nb-review-card--skip") + '">' +
        '<div class="nb-review-card-header">' +
          '<span class="nb-review-qnum">Q' + (idx + 1) + '</span>' +
          statusBadge +
          '<button class="nb-bookmark-btn ' + (bookmarked ? "nb-bookmark-btn--saved" : "") + '" data-qid="' + esc(qId) + '" data-question="' + esc(item.question) + '" data-answer="' + esc(item.answer) + '" data-level="' + esc(level) + '" title="' + (bookmarked ? "Remove bookmark" : "Bookmark this question") + '" aria-label="Bookmark question ' + (idx + 1) + '"><i class="bi ' + (bookmarked ? "bi-bookmark-fill" : "bi-bookmark") + '"></i></button>' +
        '</div>' +
        '<p class="nb-review-question">' + esc(item.question) + '</p>' +
        '<div class="nb-review-options">' + optionRows + '</div>' +
        correctAnsLine +
        '</div>';
    }).join("");

    return { html: cards, correct, incorrect, unanswered, total: questions.length };
  }

  // ─── What's Next suggestions ────────────────────────────────────────────────
  function getNextSuggestions(score, total) {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const path = window.location.pathname;
    const isMaths = path.includes("math");
    const isPhysics = path.includes("physics");
    const isChem = path.includes("chemistry") || path.includes("chem");
    const isBio = path.includes("biology") || path.includes("bio");
    const isClass10 = path.includes("class10");

    const suggestions = [];

    if (pct < 60) {
      const notesUrl = isMaths
        ? (isClass10 ? "/Notes/notes-math-class10.html" : "/Notes/notes-math-class9.html")
        : isPhysics ? (isClass10 ? "/Notes/10-PH1.html" : "/Notes/9-PH1.html")
        : isChem ? (isClass10 ? "/Notes/10-CH1.html" : "/Notes/9-CH1.html")
        : isBio ? (isClass10 ? "/Notes/10-BI1.html" : "/Notes/9-BI1.html")
        : "/htmls/notes.html";
      suggestions.push({ icon: "bi-book-half", color: "#f59e0b", label: "Revise Chapter Notes", desc: "You scored " + pct + "% — reviewing the notes will help you understand the concepts better.", url: notesUrl });
    } else if (pct < 85) {
      suggestions.push({ icon: "bi-arrow-up-right-circle-fill", color: "#6d28d9", label: "Try a Harder Level", desc: "Good effort! Challenge yourself with Level 2 or Level 3 questions.", url: null, action: "change-level" });
    } else {
      const match = path.match(/chapter[-_]?(\d+)/i);
      const nextUrl = match ? path.replace(/chapter[-_]?\d+/i, "chapter-" + (parseInt(match[1], 10) + 1)) : "/htmls/dashboard.html";
      suggestions.push({ icon: "bi-trophy-fill", color: "#059669", label: "Excellent! Try Next Chapter", desc: pct + "% — you have mastered this chapter. Move on to the next one!", url: nextUrl });
    }

    suggestions.push({ icon: "bi-robot", color: "#0891b2", label: "Ask AI Bot About Any Question", desc: "Confused about a specific question? Get a clear explanation from the AI assistant.", url: "/htmls/bot/bot.html" });
    suggestions.push({ icon: "bi-grid-1x2-fill", color: "#7c3aed", label: "Back to Dashboard", desc: "Track your overall progress and see what to study next.", url: "/htmls/dashboard.html" });
    return suggestions;
  }

  // ─── Render result panel ────────────────────────────────────────────────────
  function renderEnhancedResult(quizData, level, userAnswers) {
    const rv = buildReviewPanel(quizData, level, userAnswers);
    const pct = rv.total > 0 ? Math.round((rv.correct / rv.total) * 100) : 0;
    const scoreColor = pct >= 80 ? "#059669" : pct >= 60 ? "#d97706" : "#dc2626";
    const scoreMsg = pct >= 80 ? "Excellent performance! \uD83C\uDF89" : pct >= 60 ? "Good effort! Keep going \uD83D\uDCAA" : "Review the chapter and try again \uD83D\uDCDA";

    const circumference = 2 * Math.PI * 44;
    const offset = circumference * (1 - pct / 100);

    const suggestions = getNextSuggestions(rv.correct, rv.total);
    const suggHtml = suggestions.map(s => {
      if (s.action === "change-level") {
        return '<button class="nb-next-card nb-next-card--btn" onclick="document.getElementById(\'levelSelect\')?.scrollIntoView({behavior:\'smooth\'})">' +
          '<i class="bi ' + esc(s.icon) + '" style="color:' + esc(s.color) + '"></i>' +
          '<div><strong>' + esc(s.label) + '</strong><p>' + esc(s.desc) + '</p></div></button>';
      }
      return '<a class="nb-next-card" href="' + esc(s.url) + '">' +
        '<i class="bi ' + esc(s.icon) + '" style="color:' + esc(s.color) + '"></i>' +
        '<div><strong>' + esc(s.label) + '</strong><p>' + esc(s.desc) + '</p></div>' +
        '<i class="bi bi-arrow-right nb-next-arrow"></i></a>';
    }).join("");

    const panel = document.createElement("div");
    panel.id = "nbQuizResultPanel";
    panel.innerHTML =
      '<div class="nb-result-hero">' +
        '<div class="nb-result-score-ring">' +
          '<svg viewBox="0 0 100 100" aria-hidden="true">' +
            '<circle class="nb-ring-bg" cx="50" cy="50" r="44"/>' +
            '<circle class="nb-ring-fill" cx="50" cy="50" r="44" stroke="' + scoreColor + '" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '"/>' +
          '</svg>' +
          '<div class="nb-ring-label">' +
            '<span class="nb-ring-pct">' + pct + '%</span>' +
            '<span class="nb-ring-sub">' + rv.correct + '/' + rv.total + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="nb-result-hero-text">' +
          '<h3 class="nb-result-title">' + scoreMsg + '</h3>' +
          '<div class="nb-result-stats">' +
            '<span class="nb-result-stat nb-result-stat--correct"><i class="bi bi-check-circle-fill"></i> ' + rv.correct + ' Correct</span>' +
            '<span class="nb-result-stat nb-result-stat--wrong"><i class="bi bi-x-circle-fill"></i> ' + rv.incorrect + ' Wrong</span>' +
            '<span class="nb-result-stat nb-result-stat--skip"><i class="bi bi-dash-circle"></i> ' + rv.unanswered + ' Skipped</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="nb-result-section">' +
        '<h4 class="nb-result-section-title"><i class="bi bi-list-check"></i> Question Review</h4>' +
        '<p class="nb-result-section-sub">Review each answer. Bookmark difficult questions to review later.</p>' +
        '<div id="nbReviewCards" class="nb-review-cards">' + rv.html + '</div>' +
      '</div>' +
      '<div class="nb-result-section">' +
        '<h4 class="nb-result-section-title"><i class="bi bi-arrow-right-circle-fill"></i> What\'s Next?</h4>' +
        '<div class="nb-next-suggestions">' + suggHtml + '</div>' +
      '</div>' +
      '<button class="nb-retry-btn" id="nbRetryQuiz"><i class="bi bi-arrow-clockwise"></i> Retry This Quiz</button>';

    return panel;
  }

  // ─── Toast ──────────────────────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg) {
    let toast = document.getElementById("nbQuizToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "nbQuizToast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("nb-toast--visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("nb-toast--visible"), 3000);
  }

  // ─── Activity tracking ──────────────────────────────────────────────────────
  async function recordCompletion(score, total, level) {
    try {
      const actMod = await import("/js/activity.js");
      const authMod = await import("/js/auth.js");
      const user = authMod.auth.currentUser;
      if (!user) return;
      const quizId = window.location.pathname.split("/").pop().replace(/\.html$/, "");
      const title = document.querySelector(".quiz-title")?.textContent?.trim() || document.title;
      await actMod.recordQuizCompletion(user, { quizId, title, score: score + "/" + total, level, completedAt: new Date().toISOString() });
    } catch (err) { console.warn("Could not record quiz completion:", err); }
  }

  // ─── Main interceptor ──────────────────────────────────────────────────────
  function countQ() {
    const qc = document.getElementById("quizContainer");
    if (!qc) return 0;
    const names = new Set();
    qc.querySelectorAll("input[type='radio']").forEach(r => names.add(r.name));
    return names.size;
  }

  function interceptQuizSubmit() {
    const submitBtn = document.getElementById("submitQuiz");
    const quizContainer = document.getElementById("quizContainer");
    const levelSelect = document.getElementById("levelSelect");
    if (!submitBtn || !quizContainer) return;

    injectProgressBar();

    requestAnimationFrame(() => {
      setTimeout(() => {
        const total = countQ();
        updateProgress(0, total);
        watchAnswerSelection(quizContainer, total);
        const mo = new MutationObserver(() => {
          const newTotal = countQ();
          updateProgress(0, newTotal);
          watchAnswerSelection(quizContainer, newTotal);
        });
        mo.observe(quizContainer, { childList: true, subtree: false });
      }, 200);
    });

    let currentLevel = levelSelect?.value || "level1";
    levelSelect?.addEventListener("change", () => { currentLevel = levelSelect.value; });

    submitBtn.addEventListener("click", () => {
      requestAnimationFrame(() => { setTimeout(() => enhanceAfterSubmit(currentLevel), 150); });
    }, true);
  }

  function getGlobalQuizData() {
    if (typeof window.quizData !== "undefined" && window.quizData) return window.quizData;
    try {
      return (0, eval)("typeof quizData !== 'undefined' ? quizData : null");
    } catch (e) {
      try {
        return (new Function("return typeof quizData !== 'undefined' ? quizData : null;"))();
      } catch (e2) {
        return null;
      }
    }
  }

  function enhanceAfterSubmit(level) {
    const quizContainer = document.getElementById("quizContainer");
    const resultDiv = document.getElementById("result");
    if (!resultDiv || !resultDiv.textContent.trim()) return;

    const quizData = getGlobalQuizData();
    if (!quizData || !quizData[level]) return;

    const answers = {};
    quizContainer?.querySelectorAll("input[type='radio']:checked").forEach(inp => { answers[inp.name] = inp.value; });

    const match = resultDiv.textContent.match(/(\d+)\s*\/\s*(\d+)/);
    const correct = match ? parseInt(match[1], 10) : 0;
    const total = match ? parseInt(match[2], 10) : (quizData[level] || []).length;

    recordCompletion(correct, total, level);

    document.getElementById("nbQuizResultPanel")?.remove();
    const panel = renderEnhancedResult(quizData, level, answers);
    resultDiv.style.display = "none";
    resultDiv.insertAdjacentElement("afterend", panel);

    // Bookmark handlers
    panel.querySelectorAll(".nb-bookmark-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = { id: btn.dataset.qid, question: btn.dataset.question, answer: btn.dataset.answer, level: btn.dataset.level, quizPage: window.location.pathname, quizTitle: document.querySelector(".quiz-title")?.textContent?.trim() || document.title };
        const added = toggleBookmark(item);
        const icon = btn.querySelector("i");
        if (icon) icon.className = "bi " + (added ? "bi-bookmark-fill" : "bi-bookmark");
        btn.classList.toggle("nb-bookmark-btn--saved", added);
        btn.setAttribute("title", added ? "Remove bookmark" : "Bookmark this question");
        showToast(added ? "Question bookmarked! View in your profile." : "Bookmark removed.");
      });
    });

    // Retry
    document.getElementById("nbRetryQuiz")?.addEventListener("click", () => {
      document.getElementById("nbQuizResultPanel")?.remove();
      resultDiv.style.display = "";
      resultDiv.textContent = "";
      if (typeof window.renderQuiz === "function") window.renderQuiz(level);
      updateProgress(0, countQ());
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ─── Styles ─────────────────────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement("style");
    style.id = "nbQuizEnhancementsStyle";
    style.textContent = [
      "#nbQuizProgressWrap{display:flex;align-items:center;gap:.75rem;margin:1rem 0 1.5rem;padding:0 .5rem}",
      "#nbQuizProgressBar{flex:1;height:8px;background:rgba(255,255,255,.12);border-radius:99px;overflow:hidden}",
      "#nbQuizProgressFill{height:100%;background:linear-gradient(90deg,#7c3aed,#a78bfa);border-radius:99px;transition:width .4s cubic-bezier(.4,0,.2,1)}",
      ".nb-qprogress-label{font-size:.75rem;color:rgba(255,255,255,.65);white-space:nowrap;min-width:70px;text-align:right}",
      "#nbQuizResultPanel{max-width:860px;margin:2rem auto;font-family:Inter,sans-serif}",
      ".nb-result-hero{display:flex;align-items:center;gap:2rem;background:linear-gradient(135deg,#1e1b4b,#2d1b69);border-radius:16px;padding:2rem;margin-bottom:2rem;border:1px solid rgba(255,255,255,.08);box-shadow:0 8px 32px rgba(0,0,0,.28);flex-wrap:wrap}",
      ".nb-result-score-ring{width:120px;height:120px;position:relative;flex-shrink:0}",
      ".nb-result-score-ring svg{width:100%;height:100%;transform:rotate(-90deg)}",
      ".nb-ring-bg{fill:none;stroke:rgba(255,255,255,.1);stroke-width:8}",
      ".nb-ring-fill{fill:none;stroke-width:8;stroke-linecap:round;transition:stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)}",
      ".nb-ring-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}",
      ".nb-ring-pct{font-size:1.6rem;font-weight:800;color:#fff;line-height:1}",
      ".nb-ring-sub{font-size:.75rem;color:rgba(255,255,255,.65);margin-top:2px}",
      ".nb-result-hero-text{flex:1;min-width:0}",
      ".nb-result-title{color:#fff;font-size:1.25rem;font-weight:700;margin:0 0 .75rem}",
      ".nb-result-stats{display:flex;flex-wrap:wrap;gap:.5rem}",
      ".nb-result-stat{font-size:.82rem;padding:.3rem .75rem;border-radius:99px;display:flex;align-items:center;gap:.3rem;font-weight:600}",
      ".nb-result-stat--correct{background:rgba(16,185,129,.18);color:#6ee7b7}",
      ".nb-result-stat--wrong{background:rgba(239,68,68,.18);color:#fca5a5}",
      ".nb-result-stat--skip{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)}",
      ".nb-result-section{background:var(--card-bg,#1e293b);border:1px solid var(--card-border,rgba(255,255,255,.07));border-radius:14px;padding:1.5rem;margin-bottom:1.25rem}",
      ".nb-result-section-title{font-size:1rem;font-weight:700;margin:0 0 .25rem;color:var(--text-color,#e2e8f0);display:flex;align-items:center;gap:.45rem}",
      ".nb-result-section-sub{font-size:.79rem;color:var(--text-muted,#94a3b8);margin:0 0 1rem}",
      ".nb-review-cards{display:flex;flex-direction:column;gap:1rem}",
      ".nb-review-card{border-radius:12px;border:1px solid;padding:1rem 1.1rem}",
      ".nb-review-card--correct{border-color:rgba(16,185,129,.25);background:rgba(16,185,129,.06)}",
      ".nb-review-card--wrong{border-color:rgba(239,68,68,.25);background:rgba(239,68,68,.05)}",
      ".nb-review-card--skip{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.03)}",
      ".nb-review-card-header{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap}",
      ".nb-review-qnum{font-size:.72rem;font-weight:700;padding:.2rem .5rem;border-radius:6px;background:rgba(255,255,255,.08);color:var(--text-muted,#94a3b8);text-transform:uppercase;letter-spacing:.05em}",
      ".nb-review-badge{font-size:.72rem;font-weight:600;padding:.2rem .55rem;border-radius:99px;display:flex;align-items:center;gap:.3rem}",
      ".nb-review-badge--correct{background:rgba(16,185,129,.2);color:#6ee7b7}",
      ".nb-review-badge--wrong{background:rgba(239,68,68,.2);color:#fca5a5}",
      ".nb-review-badge--skip{background:rgba(255,255,255,.1);color:rgba(255,255,255,.6)}",
      ".nb-bookmark-btn{margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-muted,#94a3b8);font-size:1rem;padding:.2rem .4rem;border-radius:6px;transition:color .2s,background .2s}",
      ".nb-bookmark-btn:hover{color:#f59e0b;background:rgba(245,158,11,.1)}",
      ".nb-bookmark-btn--saved{color:#f59e0b}",
      ".nb-review-question{font-size:.93rem;font-weight:600;color:var(--text-color,#e2e8f0);margin:0 0 .6rem;line-height:1.5}",
      ".nb-review-options{display:flex;flex-direction:column;gap:.3rem}",
      ".nb-review-option{font-size:.85rem;padding:.35rem .6rem;border-radius:7px;display:flex;align-items:center;gap:.4rem;color:var(--text-color,#e2e8f0);background:rgba(255,255,255,.03)}",
      ".nb-review-option--correct{background:rgba(16,185,129,.15);color:#6ee7b7;font-weight:600}",
      ".nb-review-option--wrong{background:rgba(239,68,68,.15);color:#fca5a5}",
      ".nb-review-opt-icon{width:1em;text-align:center;font-size:.85em}",
      ".nb-review-correct-ans{margin-top:.5rem;font-size:.83rem;color:#6ee7b7}",
      ".nb-next-suggestions{display:flex;flex-direction:column;gap:.75rem}",
      ".nb-next-card{display:flex;align-items:center;gap:.9rem;padding:.85rem 1rem;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);text-decoration:none;color:var(--text-color,#e2e8f0);transition:background .2s,border-color .2s;cursor:pointer}",
      ".nb-next-card--btn{width:100%;text-align:left}",
      ".nb-next-card:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.15)}",
      ".nb-next-card i:first-child{font-size:1.3rem;flex-shrink:0}",
      ".nb-next-card div{flex:1;min-width:0}",
      ".nb-next-card strong{font-size:.93rem;display:block}",
      ".nb-next-card p{font-size:.8rem;color:var(--text-muted,#94a3b8);margin:.15rem 0 0}",
      ".nb-next-arrow{font-size:1.1rem;color:var(--text-muted,#94a3b8)}",
      ".nb-retry-btn{display:flex;align-items:center;gap:.5rem;margin:1.5rem auto 2rem;padding:.65rem 2rem;border:none;border-radius:10px;background:linear-gradient(135deg,#6d28d9,#9333ea);color:#fff;font-weight:600;font-size:.95rem;cursor:pointer;transition:opacity .2s,transform .2s;box-shadow:0 4px 14px rgba(109,40,217,.4)}",
      ".nb-retry-btn:hover{opacity:.9;transform:translateY(-1px)}",
      "#nbQuizToast{position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(100px);background:rgba(15,23,42,.9);color:#e2e8f0;backdrop-filter:blur(10px);border:1px solid rgba(109,40,217,.35);border-radius:24px;padding:.65rem 1.5rem;font-size:.87rem;white-space:nowrap;z-index:9999;transition:transform .3s cubic-bezier(.4,0,.2,1),opacity .3s;opacity:0;pointer-events:none}",
      "#nbQuizToast.nb-toast--visible{transform:translateX(-50%) translateY(0);opacity:1}",
      "@media(max-width:640px){.nb-result-hero{flex-direction:column;text-align:center}.nb-result-stats{justify-content:center}#nbQuizProgressWrap{flex-direction:column;align-items:stretch}.nb-qprogress-label{text-align:left}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  // ─── Init ───────────────────────────────────────────────────────────────────
  function init() {
    if (!window.location.pathname.includes("/quiz_htmls/")) return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(interceptQuizSubmit, 350));
    } else {
      setTimeout(interceptQuizSubmit, 350);
    }
  }

  init();
})();
