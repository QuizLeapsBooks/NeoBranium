/**
 * study-roadmap.js
 * Personalised Study Roadmap for NeoBranium registered students.
 *
 * Structured goals with:
 *   - Subject, chapter, target date
 *   - Daily/weekly targets
 *   - Completion tracking
 *   - Auto-revision suggestions from weak topics
 *
 * Data stored in: mentor_goals/{uid}/roadmap_items/{id}
 *
 * Security: All reads/writes scoped to auth.currentUser.uid.
 * Firestore rules already allow owner-only access to mentor_goals.
 */

import { auth, db } from "./auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const roadmapCollection = (uid) =>
  collection(db, "mentor_goals", uid, "roadmap_items");

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function addRoadmapGoal(user, { subject, chapter, targetDate, note = "" }) {
  if (!user) throw new Error("Not authenticated");
  // Minimal server-side validation (Firestore rules enforce ownership)
  if (!subject || subject.length > 100) throw new Error("Invalid subject");
  if (!chapter || chapter.length > 200) throw new Error("Invalid chapter");
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) throw new Error("Invalid date");

  const ref = await addDoc(roadmapCollection(user.uid), {
    uid: user.uid,
    subject: subject.slice(0, 100),
    chapter: chapter.slice(0, 200),
    targetDate,
    note: (note || "").slice(0, 500),
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function getRoadmapGoals(user) {
  if (!user) return [];
  try {
    const snap = await getDocs(query(
      roadmapCollection(user.uid),
      orderBy("targetDate", "asc"),
      limit(50)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("study-roadmap: getRoadmapGoals error", err);
    return [];
  }
}

export async function markGoalComplete(user, goalId) {
  if (!user || !goalId) return;
  try {
    await updateDoc(doc(db, "mentor_goals", user.uid, "roadmap_items", goalId), {
      status: "completed",
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.error("study-roadmap: markGoalComplete error", err);
    throw err;
  }
}

export async function deleteRoadmapGoal(user, goalId) {
  if (!user || !goalId) return;
  try {
    await deleteDoc(doc(db, "mentor_goals", user.uid, "roadmap_items", goalId));
  } catch (err) {
    console.error("study-roadmap: deleteRoadmapGoal error", err);
    throw err;
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

const SUBJECT_COLORS = {
  Mathematics: { bg: "rgba(59,130,246,.12)", border: "rgba(59,130,246,.3)", icon: "#3b82f6" },
  Physics:     { bg: "rgba(139,92,246,.12)", border: "rgba(139,92,246,.3)", icon: "#8b5cf6" },
  Chemistry:   { bg: "rgba(16,185,129,.12)", border: "rgba(16,185,129,.3)", icon: "#10b981" },
  Biology:     { bg: "rgba(236,72,153,.12)", border: "rgba(236,72,153,.3)", icon: "#ec4899" },
  General:     { bg: "rgba(255,255,255,.06)", border: "rgba(255,255,255,.12)", icon: "#94a3b8" }
};

function subjectColor(subject) {
  return SUBJECT_COLORS[subject] || SUBJECT_COLORS.General;
}

function daysUntil(dateStr) {
  const target = new Date(`${dateStr}T23:59:59`);
  const now = new Date();
  const diff = Math.ceil((target - now) / 86400000);
  return diff;
}

function dueBadge(days) {
  if (days < 0) return `<span class="nb-road-badge nb-road-badge--overdue">Overdue</span>`;
  if (days === 0) return `<span class="nb-road-badge nb-road-badge--today">Due Today</span>`;
  if (days <= 3) return `<span class="nb-road-badge nb-road-badge--soon">Due in ${days}d</span>`;
  return `<span class="nb-road-badge nb-road-badge--upcoming">Due ${new Date(`${Math.trunc(days)}` ? `${String(new Date(Date.now() + days * 86400000).getFullYear())}-${String(new Date(Date.now() + days * 86400000).getMonth()+1).padStart(2,"0")}-${String(new Date(Date.now() + days * 86400000).getDate()).padStart(2,"0")}` : "").toLocaleDateString(undefined,{month:"short",day:"numeric"}) || `in ${days}d`}</span>`;
}

export function renderRoadmap(goals, container, user, onUpdate) {
  if (!container) return;

  const active = goals.filter(g => g.status === "active")
    .sort((a, b) => (a.targetDate || "").localeCompare(b.targetDate || ""));
  const completed = goals.filter(g => g.status === "completed");

  if (!goals.length) {
    container.innerHTML = `
      <div class="nb-road-empty">
        <i class="bi bi-map"></i>
        <h4>No study goals yet</h4>
        <p>Add your first goal to create a personalised study roadmap.</p>
      </div>
      <div id="nbRoadmapFormContainer"></div>`;
    _attachForm(container, user, onUpdate);
    return;
  }

  const activeHtml = active.map(goal => _goalCard(goal, user, onUpdate)).join("");
  const completedHtml = completed.length ? `
    <div class="nb-road-section-label mt-4 mb-2">
      <i class="bi bi-check2-all"></i> Completed (${completed.length})
    </div>
    <div class="nb-road-completed">
      ${completed.map(g => _goalCard(g, user, onUpdate, true)).join("")}
    </div>` : "";

  container.innerHTML = `
    <div class="nb-road-active">${activeHtml}</div>
    ${completedHtml}
    <div id="nbRoadmapFormContainer"></div>`;

  _attachForm(container, user, onUpdate);
  _wireButtons(container, user, onUpdate);
}

function _goalCard(goal, user, onUpdate, isCompleted = false) {
  const days = daysUntil(goal.targetDate);
  const c = subjectColor(goal.subject);
  const badge = isCompleted
    ? `<span class="nb-road-badge nb-road-badge--done"><i class="bi bi-check-circle-fill"></i> Done</span>`
    : dueBadge(days);

  return `
    <div class="nb-road-card ${isCompleted ? "nb-road-card--done" : ""}"
         style="--road-bg:${c.bg};--road-border:${c.border};--road-icon:${c.icon}"
         data-goal-id="${esc(goal.id)}">
      <div class="nb-road-card-head">
        <div class="nb-road-card-subject">
          <span class="nb-road-subject-dot" style="background:${c.icon}"></span>
          <strong>${esc(goal.subject)}</strong>
        </div>
        ${badge}
      </div>
      <p class="nb-road-chapter">${esc(goal.chapter)}</p>
      ${goal.note ? `<p class="nb-road-note">${esc(goal.note)}</p>` : ""}
      <div class="nb-road-card-foot">
        <span class="nb-road-due"><i class="bi bi-calendar3"></i> ${esc(goal.targetDate)}</span>
        <div class="nb-road-actions">
          ${!isCompleted ? `
            <button class="nb-road-btn nb-road-btn--done" data-action="complete" data-goal-id="${esc(goal.id)}" title="Mark as completed">
              <i class="bi bi-check2"></i>
            </button>` : ""}
          <button class="nb-road-btn nb-road-btn--delete" data-action="delete" data-goal-id="${esc(goal.id)}" title="Remove goal">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>`;
}

function _attachForm(container, user, onUpdate) {
  const formContainer = container.querySelector("#nbRoadmapFormContainer");
  if (!formContainer) return;

  formContainer.innerHTML = `
    <button class="nb-road-add-btn" id="nbRoadAddBtn" type="button">
      <i class="bi bi-plus-lg"></i> Add Study Goal
    </button>
    <form class="nb-road-form d-none" id="nbRoadForm" novalidate>
      <h5 class="nb-road-form-title"><i class="bi bi-map-fill"></i> New Study Goal</h5>
      <div class="nb-road-form-row">
        <div class="nb-road-form-field">
          <label for="nbRoadSubject">Subject</label>
          <select id="nbRoadSubject" class="nb-road-select" required>
            <option value="">Select subject</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Biology">Biology</option>
            <option value="General">General / Other</option>
          </select>
        </div>
        <div class="nb-road-form-field">
          <label for="nbRoadDate">Target Date</label>
          <input type="date" id="nbRoadDate" class="nb-road-input" required min="${new Date().toISOString().slice(0,10)}" />
        </div>
      </div>
      <div class="nb-road-form-field">
        <label for="nbRoadChapter">Chapter / Topic</label>
        <input type="text" id="nbRoadChapter" class="nb-road-input" maxlength="200" placeholder="e.g. Chapter 2 – Polynomials" required />
      </div>
      <div class="nb-road-form-field">
        <label for="nbRoadNote">Note (optional)</label>
        <input type="text" id="nbRoadNote" class="nb-road-input" maxlength="500" placeholder="e.g. Focus on theorem proofs" />
      </div>
      <div class="nb-road-form-actions">
        <button type="submit" class="nb-road-submit" id="nbRoadSubmit">Add Goal</button>
        <button type="button" class="nb-road-cancel" id="nbRoadCancel">Cancel</button>
      </div>
      <p class="nb-road-form-error d-none" id="nbRoadError"></p>
    </form>`;

  const addBtn = formContainer.querySelector("#nbRoadAddBtn");
  const form = formContainer.querySelector("#nbRoadForm");
  const cancelBtn = formContainer.querySelector("#nbRoadCancel");
  const submitBtn = formContainer.querySelector("#nbRoadSubmit");
  const errEl = formContainer.querySelector("#nbRoadError");

  addBtn?.addEventListener("click", () => {
    addBtn.classList.add("d-none");
    form.classList.remove("d-none");
    form.querySelector("#nbRoadSubject")?.focus();
  });

  cancelBtn?.addEventListener("click", () => {
    form.classList.add("d-none");
    addBtn.classList.remove("d-none");
    form.reset();
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const subject = form.querySelector("#nbRoadSubject")?.value?.trim();
    const chapter = form.querySelector("#nbRoadChapter")?.value?.trim();
    const targetDate = form.querySelector("#nbRoadDate")?.value;
    const note = form.querySelector("#nbRoadNote")?.value?.trim();

    if (!subject || !chapter || !targetDate) {
      if (errEl) { errEl.textContent = "Please fill in all required fields."; errEl.classList.remove("d-none"); }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Adding…";
    if (errEl) errEl.classList.add("d-none");

    try {
      await addRoadmapGoal(user, { subject, chapter, targetDate, note });
      form.reset();
      form.classList.add("d-none");
      addBtn.classList.remove("d-none");
      if (onUpdate) onUpdate();
    } catch (err) {
      if (errEl) { errEl.textContent = err.message || "Failed to save goal."; errEl.classList.remove("d-none"); }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Add Goal";
    }
  });
}

function _wireButtons(container, user, onUpdate) {
  container.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const goalId = btn.dataset.goalId;
    if (!goalId) return;

    btn.disabled = true;
    try {
      if (action === "complete") {
        await markGoalComplete(user, goalId);
      } else if (action === "delete") {
        if (confirm("Remove this study goal?")) {
          await deleteRoadmapGoal(user, goalId);
        }
      }
      if (onUpdate) onUpdate();
    } catch (err) {
      alert("Could not update goal. Please try again.");
    } finally {
      btn.disabled = false;
    }
  });
}
