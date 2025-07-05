import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc,
  collection, query, where, getCountFromServer
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

// 🔧 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyA1iWJdGtmrox9RAHgWBxaK4p8KGf7ji_Y",
  authDomain: "neobranium.firebaseapp.com",
  projectId: "neobranium",
  storageBucket: "neobranium.appspot.com",
  messagingSenderId: "59188872045",
  appId: "1:59188872045:web:450a70b28e4be5db335064"
};

// 🔥 Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 👤 Wait for user
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const buttons = document.querySelectorAll(".like-button");

  buttons.forEach(async (btn) => {
    const noteId = btn.dataset.noteId;
    const countSpan = btn.nextElementSibling;

    // Check if already liked
    const likeDoc = doc(db, "likes", `${user.uid}_${noteId}`);
    const likeSnap = await getDoc(likeDoc);
    if (likeSnap.exists()) btn.disabled = true;

    // Get like count
    const likeQuery = query(collection(db, "likes"), where("noteId", "==", noteId));
    const likeSnapCount = await getCountFromServer(likeQuery);
    countSpan.textContent = `${likeSnapCount.data().count} Likes`;

    // Like handler
    btn.addEventListener("click", async () => {
      await setDoc(likeDoc, {
        userId: user.uid,
        noteId,
        timestamp: Date.now()
      });
      btn.disabled = true;
      let currentCount = parseInt(countSpan.textContent) || 0;
      countSpan.textContent = `${currentCount + 1} Likes`;
    });
  });
});
