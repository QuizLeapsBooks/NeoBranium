// spotlight.js — Centralized Firebase singleton import
import { db } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const spotlightGrid = document.getElementById("spotlightGrid");

function escapeHtml(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

async function loadRankingData() {
  if (!spotlightGrid) return;
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    spotlightGrid.innerHTML = "";
    querySnapshot.forEach((doc) => {
      const data = doc.data() || {};
      const name = escapeHtml(data.username || "Unknown");
      const rank = escapeHtml(data.rank || "Unranked");
      const score = escapeHtml(data.score || "N/A");
      const improve = escapeHtml(data.improvement || "Update your content quality.");

      spotlightGrid.innerHTML += `
        <div class="grid-container">
          <div class="grid-item_2">${name}</div>
          <div class="grid-item_2">${rank}</div>
          <div class="grid-item_2">${score}</div>
          <div class="grid-item_2">${improve}</div>
        </div>
      `;
    });
  } catch (err) {
    console.error("Failed to load ranking data:", err);
  }
}

if (spotlightGrid) {
  loadRankingData();
}
