import { auth, db } from "./auth.js";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  getDoc,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const activityCollection = (uid) => collection(db, "mentor_calendar", uid, "days");
const taskCollection = (uid) => collection(db, "mentor_goals", uid, "items");

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function activityRef(uid, key) {
  return doc(db, "mentor_calendar", uid, "days", key);
}

export async function recordVisit(user) {
  if (!user) return;
  const key = dateKey();
  const storageKey = `neobranium-visit:${user.uid}:${key}`;
  if (localStorage.getItem(storageKey)) return;
  try {
    await setDoc(activityRef(user.uid, key), {
      date: key,
      visited: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
    localStorage.setItem(storageKey, "1");
  } catch (error) {
    console.error("Unable to record authenticated visit:", error);
  }
}

export async function recordQuizCompletion(user, result) {
  if (!user) return;
  const key = dateKey();
  try {
    await setDoc(activityRef(user.uid, key), {
      date: key,
      quizCompleted: true,
      quizCount: increment(1),
      quizIds: arrayUnion(result.quizId),
      quizDetails: arrayUnion({
        quizId: result.quizId,
        title: result.title,
        score: result.score,
        completedAt: new Date().toISOString()
      }),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Unable to record quiz completion:", error);
  }
}

function setupQuizTracking() {
  const submitButton = document.getElementById("submitQuiz");
  const resultElement = document.getElementById("result");
  if (!submitButton || !resultElement) return;

  submitButton.addEventListener("click", () => {
    window.setTimeout(() => {
      const scoreMatch = resultElement.textContent.match(/(\d+)\s*\/\s*(\d+)/);
      recordQuizCompletion(auth.currentUser, {
        quizId: window.location.pathname.split("/").pop().replace(/\.html$/, ""),
        title: document.querySelector(".quiz-title")?.textContent.trim() || document.title,
        score: scoreMatch ? `${scoreMatch[1]}/${scoreMatch[2]}` : null
      });
    }, 0);
  });
}

function renderCalendar(monthDate, records) {
  const calendar = document.getElementById("activityCalendar");
  const label = document.getElementById("activityMonthLabel");
  if (!calendar || !label) return;

  label.textContent = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  calendar.innerHTML = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((day) => `<span class="nb-calendar-weekday">${day}</span>`).join("");

  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  for (let index = 0; index < firstDay; index += 1) calendar.insertAdjacentHTML("beforeend", "<span></span>");
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dateKey(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
    const record = records.get(key) || {};
    const state = record.quizCompleted ? "quiz" : record.visited ? "visit" : "";
    const todayClass = key === dateKey() ? " nb-calendar-day--today" : "";
    const stateClass = state ? ` nb-calendar-day--${state}` : "";
    const title = record.quizCompleted ? "Quiz completed" : record.visited ? "Visited" : "";
    calendar.insertAdjacentHTML("beforeend", `<button type="button" class="nb-calendar-day${todayClass}${stateClass}" data-date="${key}" title="${title || "View activity"}" aria-label="View activity for ${key}">${day}</button>`);
  }
}

const dailyActivityCache = new Map();

function formatActivityDate(key) {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric"
  });
}

function showDailyState(state, key) {
  const title = document.getElementById("dailyActivityTitle");
  const body = document.getElementById("dailyActivityBody");
  if (!title || !body) return;
  title.textContent = formatActivityDate(key);
  body.innerHTML = state === "loading"
    ? '<div class="nb-daily-loading"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span>Loading your activity...</span></div>'
    : '<p class="nb-daily-empty">Couldn\'t load activity right now. Please try again.</p><button type="button" class="btn btn-sm btn-outline-primary" id="dailyActivityRetry">Retry</button>';
}

function quizScore(quiz) {
  if (typeof quiz.score === "number") return `${quiz.score}%`;
  return quiz.score || "Score unavailable";
}

function quizResult(quiz) {
  const match = String(quiz.score || "").match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  return { correct: Number(match[1]), attempted: Number(match[2]) };
}

function renderDailyActivity(key, activity, tasks) {
  const body = document.getElementById("dailyActivityBody");
  if (!body) return;
  const quizzes = Array.isArray(activity?.quizDetails) ? activity.quizDetails : [];
  const datedTasks = tasks.filter((task) => task.date === key || task.dueDate === key);
  const sections = [];
  if (activity?.visited) sections.push(`<section class="nb-daily-section"><h6>Website Activity</h6><p><i class="bi bi-check-circle-fill"></i> Visited NeoBranium</p><small>${formatActivityDate(key)}</small></section>`);
  if (quizzes.length) {
    const results = quizzes.map(quizResult).filter(Boolean);
    const attempted = results.reduce((sum, result) => sum + result.attempted, 0);
    const correct = results.reduce((sum, result) => sum + result.correct, 0);
    const average = results.length ? `${Math.round(results.reduce((sum, result) => sum + (result.correct / result.attempted) * 100, 0) / results.length)}%` : "Unavailable";
    const counts = results.length ? `<p>${attempted} questions attempted · ${correct} correct · ${attempted - correct} incorrect</p>` : "";
    sections.push(`<section class="nb-daily-section"><h6>Quiz Practice</h6><p><strong>${quizzes.length}</strong> quiz${quizzes.length === 1 ? "" : "zes"} completed</p>${counts}<p>Average score: ${average}</p><div class="nb-daily-quiz-list">${quizzes.map((quiz) => `<div class="nb-daily-quiz"><strong></strong><span>${quiz.subject || quiz.chapter ? `${quiz.subject || ""}${quiz.subject && quiz.chapter ? " · " : ""}${quiz.chapter || ""}` : ""}</span><em>${quizScore(quiz)}</em></div>`).join("")}</div></section>`);
    quizzes.forEach((quiz, index) => { body.querySelectorAll(".nb-daily-quiz strong")[index].textContent = quiz.title || "Untitled quiz"; });
  }
  if (datedTasks.length) sections.push(`<section class="nb-daily-section"><h6>Tasks</h6>${datedTasks.map((task) => `<div class="nb-daily-task"><i class="bi bi-${task.status === "completed" ? "check-circle-fill" : "circle"}"></i><span><strong></strong><small>${task.source === "neomentor" ? "From NeoMentor" : "From NeoBranium"}</small></span></div>`).join("")}</section>`);
  body.innerHTML = sections.length ? sections.join("") : '<p class="nb-daily-empty">No activity recorded for this date.</p>';
  datedTasks.forEach((task, index) => { body.querySelectorAll(".nb-daily-task strong")[index].textContent = task.title || "Untitled task"; });
}

async function loadDailyActivity(key) {
  const user = auth.currentUser;
  if (!user) {
    showDailyState("error", key);
    document.getElementById("dailyActivityRetry")?.addEventListener("click", () => loadDailyActivity(key), { once: true });
    return;
  }
  const cacheKey = `${user.uid}:${key}`;
  if (dailyActivityCache.has(cacheKey)) {
    const cached = dailyActivityCache.get(cacheKey);
    renderDailyActivity(key, cached.activity, cached.tasks);
    return;
  }
  showDailyState("loading", key);
  try {
    const activitySnapshot = await Promise.race([
      getDoc(activityRef(user.uid, key)),
      new Promise((resolve, reject) => window.setTimeout(() => reject(new Error("Activity request timed out")), 12000))
    ]);
    const result = { activity: activitySnapshot.exists() ? activitySnapshot.data() : {}, tasks: [] };
    dailyActivityCache.set(cacheKey, result);
    renderDailyActivity(key, result.activity, result.tasks);
    try {
      const taskSnapshot = await Promise.race([
        getDocs(query(taskCollection(user.uid), where("date", "==", key))),
        new Promise((resolve, reject) => window.setTimeout(() => reject(new Error("Task request timed out")), 5000))
      ]);
      result.tasks = taskSnapshot.docs.map((item) => item.data());
      dailyActivityCache.set(cacheKey, result);
      renderDailyActivity(key, result.activity, result.tasks);
    } catch (taskError) {
      console.warn("Unable to load dated tasks:", taskError);
    }
  } catch (error) {
    console.error("Unable to load daily activity:", error);
    showDailyState("error", key);
    document.getElementById("dailyActivityRetry")?.addEventListener("click", () => loadDailyActivity(key), { once: true });
  }
}

async function loadMonth(monthDate) {
  const user = auth.currentUser;
  if (!user) {
    renderCalendar(monthDate, new Map());
    return;
  }
  const first = dateKey(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  const last = dateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
  try {
    const snapshot = await getDocs(query(activityCollection(user.uid), where("date", ">=", first), where("date", "<=", last)));
    const records = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
    renderCalendar(monthDate, records);
  } catch (error) {
    console.error("Unable to load activity calendar:", error);
    renderCalendar(monthDate, new Map());
  }
}

function renderTasks(snapshot) {
  const list = document.getElementById("taskList");
  if (!list) return;
  list.innerHTML = "";
  if (snapshot.empty) {
    list.innerHTML = '<p class="nb-task-empty">No active tasks yet.</p>';
    return;
  }
  snapshot.forEach((item) => {
    const task = item.data();
    const source = task.source === "neomentor" ? "From NeoMentor" : "From NeoBranium";
    list.insertAdjacentHTML("beforeend", `<div class="nb-task-item"><i class="bi bi-check2-square"></i><div><div class="nb-task-title"></div><span class="nb-task-source">${source}</span></div></div>`);
    list.lastElementChild.querySelector(".nb-task-title").textContent = task.title || "Untitled task";
  });
}

async function loadTasks(user) {
  const list = document.getElementById("taskList");
  if (!list || !user) return;
  try {
    const snapshot = await getDocs(query(taskCollection(user.uid), where("status", "==", "active"), limit(8)));
    renderTasks(snapshot);
  } catch (error) {
    console.error("Unable to load student tasks:", error);
    list.innerHTML = '<p class="nb-task-empty">Tasks are unavailable right now.</p>';
  }
}

function setupDashboard(user) {
  const calendar = document.getElementById("activityCalendar");
  if (!calendar) return;
  let monthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const refresh = () => loadMonth(monthDate);
  calendar.addEventListener("click", (event) => {
    const day = event.target.closest("[data-date]");
    if (!day || !auth.currentUser) return;
    const key = day.dataset.date;
    const modalElement = document.getElementById("dailyActivityModal");
    if (!modalElement || !window.bootstrap?.Modal) return;
    showDailyState("loading", key);
    window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
    loadDailyActivity(key);
  });
  document.getElementById("activityPreviousMonth")?.addEventListener("click", () => { monthDate.setMonth(monthDate.getMonth() - 1); refresh(); });
  document.getElementById("activityNextMonth")?.addEventListener("click", () => { monthDate.setMonth(monthDate.getMonth() + 1); refresh(); });
  document.getElementById("addTaskButton")?.addEventListener("click", () => document.getElementById("taskForm")?.classList.toggle("d-none"));
  document.getElementById("taskForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("taskTitle");
    const title = input.value.trim();
    if (!title || !auth.currentUser) return;
    try {
      await addDoc(taskCollection(auth.currentUser.uid), { title, status: "active", source: "neobranium", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      input.value = "";
      document.getElementById("taskForm").classList.add("d-none");
      loadTasks(auth.currentUser);
    } catch (error) {
      console.error("Unable to add student task:", error);
    }
  });
  refresh();
  loadTasks(user);
}

if (window.location.pathname.includes("/quiz_htmls/")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupQuizTracking, { once: true });
  } else {
    setupQuizTracking();
  }
} else {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    recordVisit(user);
    setupDashboard(user);
  });
}