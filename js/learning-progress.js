import { auth, db } from "./auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const progressElement = document.getElementById("learningProgress");

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  }[character]));
}

function parseScore(score) {
  if (typeof score === "number") return { correct: score, total: null };
  const match = String(score || "").match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { correct: Number(match[1]), total: Number(match[2]) };
}

function getSubject(quiz) {
  const identity = `${quiz.quizId || ""} ${quiz.title || ""}`.toLowerCase();
  if (/math/.test(identity)) return "Mathematics";
  if (/biology|life processes|tissues|organisms|heredity|environment|food resources|fall ill/.test(identity)) return "Biology";
  if (/chemistry|matter|atom|reaction|acid|metal|carbon/.test(identity)) return "Chemistry";
  if (/physics|motion|force|gravitation|work and energy|electricity|magnetic|light|eye and colourful/.test(identity)) return "Physics";
  return "Other";
}

function getChapter(quiz) {
  const title = String(quiz.title || "");
  const chapter = title
    .replace(/\s+Quiz\b.*$/i, "")
    .replace(/\s*\(Class\s*\d+\).*$/i, "")
    .trim();
  return chapter || String(quiz.quizId || "Quiz").replace(/[-_]/g, " ");
}

function normaliseRecords(snapshot) {
  const records = [];
  snapshot.forEach((dayDocument) => {
    const day = dayDocument.data();
    (Array.isArray(day.quizDetails) ? day.quizDetails : []).forEach((quiz, index) => {
      const score = parseScore(quiz.score);
      const completedAt = quiz.completedAt || day.date || dayDocument.id;
      records.push({
        ...quiz,
        id: `${dayDocument.id}-${index}`,
        date: String(completedAt).slice(0, 10),
        subject: getSubject(quiz),
        chapter: getChapter(quiz),
        score
      });
    });
  });
  return records;
}

function metric(label, value) {
  return `<div class="nb-progress-metric"><span class="nb-progress-metric-label">${label}</span><strong class="nb-progress-metric-value">${value}</strong></div>`;
}

function metricLabel(metricName) {
  return { quizzes: "Quizzes completed", questions: "Questions attempted", score: "Average score (%)" }[metricName];
}

function getChartPoints(records, metricName) {
  const grouped = records.reduce((days, record) => {
    if (!record.date) return days;
    if (!days[record.date]) days[record.date] = { date: record.date, total: 0, count: 0, scores: [] };
    const day = days[record.date];
    day.count += 1;
    if (record.score && Number.isFinite(record.score.total) && record.score.total > 0) {
      day.total += record.score.total;
      day.scores.push((record.score.correct / record.score.total) * 100);
    }
    return days;
  }, {});

  return Object.values(grouped).map((day) => {
    const value = metricName === "questions" ? day.total : metricName === "score" ? (day.scores.length ? day.scores.reduce((sum, score) => sum + score, 0) / day.scores.length : null) : day.count;
    return value === null || !Number.isFinite(value) ? null : { date: day.date, value };
  }).filter(Boolean).sort((left, right) => left.date.localeCompare(right.date));
}

function formatChartDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(date.getTime()) ? dateKey : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderLineChart(records, metricName) {
  const points = getChartPoints(records, metricName);
  if (!points.length) return `<div class="nb-progress-chart-empty">${metricName === "score" ? "Score data is not available for these quiz attempts." : "There is not enough data to show this view."}</div>`;

  const width = 640;
  const height = 250;
  const left = 52;
  const right = 18;
  const top = 18;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maximum = metricName === "score" ? 100 : Math.max(...points.map((point) => point.value), 1);
  const axisMaximum = metricName === "score" ? 100 : Math.max(Math.ceil(maximum), 1);
  const xPosition = (index) => points.length === 1 ? left + (plotWidth / 2) : left + (index / (points.length - 1)) * plotWidth;
  const yPosition = (value) => top + plotHeight - (value / axisMaximum) * plotHeight;
  const line = points.map((point, index) => `${xPosition(index)},${yPosition(point.value)}`).join(" ");
  const gridLines = [0, 0.5, 1].map((ratio) => {
    const y = top + plotHeight - ratio * plotHeight;
    const label = Math.round(axisMaximum * ratio);
    return `<line class="nb-progress-grid-line" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line><text class="nb-progress-axis-label" x="${left - 9}" y="${y + 4}" text-anchor="end">${label}${metricName === "score" ? "%" : ""}</text>`;
  }).join("");
  const labelStep = Math.max(1, Math.ceil(points.length / 7));
  const labels = points.map((point, index) => {
    if (index % labelStep !== 0 && index !== points.length - 1) return "";
    return `<text class="nb-progress-date-label" x="${xPosition(index)}" y="${height - 17}" text-anchor="middle">${escapeHtml(formatChartDate(point.date))}</text>`;
  }).join("");
  const circles = points.map((point, index) => `<circle class="nb-progress-point" cx="${xPosition(index)}" cy="${yPosition(point.value)}" r="5" tabindex="0" data-tooltip="${escapeHtml(`${formatChartDate(point.date)}: ${metricName === "score" ? `${Math.round(point.value)}%` : Math.round(point.value)}`)}"><title>${escapeHtml(`${formatChartDate(point.date)}: ${metricName === "score" ? `${Math.round(point.value)}%` : Math.round(point.value)}`)}</title></circle>`).join("");

  return `<svg class="nb-progress-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(metricLabel(metricName))} by date" preserveAspectRatio="none"><text class="nb-progress-y-axis-title" transform="translate(12 ${top + (plotHeight / 2)}) rotate(-90)" text-anchor="middle">${escapeHtml(metricLabel(metricName))}</text>${gridLines}<polyline class="nb-progress-line" points="${line}"></polyline>${circles}${labels}<text class="nb-progress-x-axis-title" x="${left + (plotWidth / 2)}" y="${height - 2}" text-anchor="middle">Date</text></svg>`;
}

function attachChartTooltips() {
  const chart = progressElement.querySelector(".nb-progress-chart-shell");
  const tooltip = chart?.querySelector(".nb-progress-tooltip");
  if (!chart || !tooltip) return;
  chart.querySelectorAll(".nb-progress-point").forEach((point) => {
    const showTooltip = () => {
      tooltip.textContent = point.dataset.tooltip;
      tooltip.classList.add("is-visible");
    };
    point.addEventListener("mouseenter", showTooltip);
    point.addEventListener("focus", showTooltip);
    point.addEventListener("mouseleave", () => tooltip.classList.remove("is-visible"));
    point.addEventListener("blur", () => tooltip.classList.remove("is-visible"));
  });
}

function renderChartShell(records) {
  const metricName = "quizzes";
  return `<div class="nb-progress-chart-shell"><div class="nb-progress-chart-heading"><div><h3 class="nb-progress-panel-title">Practice Activity</h3><p class="nb-progress-chart-caption">${escapeHtml(metricLabel(metricName))} by day</p></div><label class="nb-progress-chart-select">Metric<select id="learningProgressMetric" aria-label="Practice activity metric"><option value="quizzes">Quizzes</option><option value="questions">Questions</option><option value="score">Score</option></select></label></div><div class="nb-progress-chart-body">${renderLineChart(records, metricName)}</div><div class="nb-progress-tooltip" role="status"></div></div>`;
}

function renderProgress(records) {
  if (!records.length) {
    progressElement.innerHTML = '<div class="nb-progress-empty"><i class="bi bi-compass me-1"></i> Start a quiz to see your learning progress here.</div>';
    return;
  }

  const parsedScores = records.filter((record) => record.score && Number.isFinite(record.score.correct) && Number.isFinite(record.score.total) && record.score.total > 0);
  const questionsAttempted = parsedScores.reduce((sum, record) => sum + record.score.total, 0);
  const averageScore = parsedScores.length ? Math.round(parsedScores.reduce((sum, record) => sum + (record.score.correct / record.score.total) * 100, 0) / parsedScores.length) : null;
  const activeDays = new Set(records.map((record) => record.date).filter(Boolean)).size;
  const metrics = [metric("Quizzes completed", records.length)];
  if (questionsAttempted) metrics.push(metric("Questions attempted", questionsAttempted));
  if (averageScore !== null) metrics.push(metric("Average score", `${averageScore}%`));
  if (activeDays) metrics.push(metric("Active practice days", activeDays));

  const subjects = [...new Set(records.map((record) => record.subject))].sort();
  const chapterCounts = records.reduce((counts, record) => {
    const key = `${record.subject}|${record.chapter}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const maximumChapterCount = Math.max(...Object.values(chapterCounts), 1);
  const chapters = subjects.map((subject) => {
    const chapterNames = [...new Set(records.filter((record) => record.subject === subject).map((record) => record.chapter))].sort((left, right) => {
      const rightCount = chapterCounts[`${subject}|${right}`] || 0;
      const leftCount = chapterCounts[`${subject}|${left}`] || 0;
      return rightCount - leftCount || left.localeCompare(right);
    });
    return `<div class="nb-progress-subject"><p class="nb-progress-subject-name">${escapeHtml(subject)}</p>${chapterNames.map((chapter) => {
      const count = records.filter((record) => record.subject === subject && record.chapter === chapter).length;
      return `<div class="nb-progress-chapter"><div class="nb-progress-chapter-line"><span class="nb-progress-chapter-name" title="${escapeHtml(chapter)}">${escapeHtml(chapter)}</span><span class="nb-progress-chapter-count">${count} ${count === 1 ? "quiz" : "quizzes"} practiced</span></div><div class="nb-progress-track" role="progressbar" aria-label="${escapeHtml(chapter)} practice" aria-valuenow="${count}" aria-valuemin="0"><div class="nb-progress-fill" style="width:${Math.max((count / maximumChapterCount) * 100, 5)}%"></div></div></div>`;
    }).join("")}</div>`;
  }).join("");

  const mostPracticed = records.reduce((counts, record) => {
    counts[record.chapter] = (counts[record.chapter] || 0) + 1;
    return counts;
  }, {});
  const mostPracticedChapter = Object.entries(mostPracticed).sort((left, right) => right[1] - left[1])[0];
  const subjectCounts = records.reduce((counts, record) => { counts[record.subject] = (counts[record.subject] || 0) + 1; return counts; }, {});
  const mostPracticedSubject = Object.entries(subjectCounts).sort((left, right) => right[1] - left[1])[0];
  const latestDate = records.map((record) => record.date).filter(Boolean).sort().pop();
  const summaryItems = [
    ["Total quizzes", records.length],
    ["Questions attempted", questionsAttempted || "Not available"],
    ["Average score", averageScore === null ? "Not available" : `${averageScore}%`],
    ["Most practiced subject", mostPracticedSubject ? mostPracticedSubject[0] : "Not available"],
    ["Most practiced chapter", mostPracticedChapter ? mostPracticedChapter[0] : "Not available"],
    ["Latest quiz", latestDate ? formatChartDate(latestDate) : "Not available"]
  ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

  progressElement.innerHTML = `<div class="nb-progress-metrics">${metrics.join("")}</div><div class="nb-progress-layout"><div class="nb-progress-panel"><h3 class="nb-progress-panel-title">Chapters practiced</h3><p class="nb-progress-chart-caption">Bar length shows relative practice activity.</p>${chapters}</div>${renderChartShell(records)}</div><div class="nb-progress-summary"><h3 class="nb-progress-panel-title">Practice Summary</h3><div class="nb-progress-summary-grid">${summaryItems}</div></div>`;
  const metricSelect = progressElement.querySelector("#learningProgressMetric");
  metricSelect?.addEventListener("change", () => {
    const body = progressElement.querySelector(".nb-progress-chart-body");
    const caption = progressElement.querySelector(".nb-progress-chart-caption");
    body.innerHTML = renderLineChart(records, metricSelect.value);
    caption.textContent = `${metricLabel(metricSelect.value)} by day`;
    attachChartTooltips();
  });
  attachChartTooltips();
}

async function loadProgress(user) {
  if (!progressElement) return;
  if (!user) {
    progressElement.innerHTML = '<div class="nb-progress-empty">Sign in to see your personal quiz progress.</div>';
    return;
  }
  try {
    const days = query(collection(db, "mentor_calendar", user.uid, "days"), where("quizCompleted", "==", true));
    const snapshot = await getDocs(days);
    renderProgress(normaliseRecords(snapshot));
  } catch (error) {
    console.error("Unable to load quiz learning progress:", error);
    progressElement.innerHTML = '<div class="nb-progress-empty">Your quiz progress is unavailable right now.</div>';
  }
}

if (progressElement) {
  onAuthStateChanged(auth, loadProgress);
}
