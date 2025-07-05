
 import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1iWJdGtmrox9RAHgWBxaK4p8KGf7ji_Y",
  authDomain: "neobranium.firebaseapp.com",
  projectId: "neobranium",
  storageBucket: "neobranium.appspot.com",
  messagingSenderId: "59188872045",
  appId: "1:59188872045:web:450a70b28e4be5db335064",
};

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const spotlightGrid = document.getElementById("spotlightGrid");

  async function loadRankingData() {
    const querySnapshot = await getDocs(collection(db, "users"));
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const name = data.username || "Unknown";
      const rank = data.rank || "Unranked";
      const score = data.score || "N/A";
      const improve = data.improvement || "Update your content quality.";

      spotlightGrid.innerHTML += `
        <div class="grid-container">
          <div class="grid-item_2">${name}</div>
          <div class="grid-item_2">${rank}</div>
          <div class="grid-item_2">${score}</div>
          <div class="grid-item_2">${improve}</div>
        </div>
      `;
    });
  }

  loadRankingData();
