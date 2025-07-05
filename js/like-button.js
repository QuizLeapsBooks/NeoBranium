// like-button.js

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
const auth = getAuth(app);

const likeBtn = document.getElementById("likeBtn");
const likeCountText = document.getElementById("likeCount");

const noteId = "ihss301"; // change for other PDFs

async function loadLikes(user) {
  const noteRef = doc(db, "notesLikes", noteId);
  const docSnap = await getDoc(noteRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    const likes = data.likes || 0;
    const usersLiked = data.users || [];

    likeCountText.textContent = likes;

    // Disable button if user already liked
    if (user && usersLiked.includes(user.uid)) {
      likeBtn.disabled = true;
      likeBtn.innerHTML = `<i class="bi bi-hand-thumbs-up-fill"></i> Liked`;
    }
  } else {
    likeCountText.textContent = 0;
  }
}

async function handleLike(user) {
  const noteRef = doc(db, "notesLikes", noteId);
  const docSnap = await getDoc(noteRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    const users = data.users || [];

    if (!users.includes(user.uid)) {
      await updateDoc(noteRef, {
        likes: (data.likes || 0) + 1,
        users: arrayUnion(user.uid)
      });
      likeCountText.textContent = (data.likes || 0) + 1;
      likeBtn.disabled = true;
      likeBtn.innerHTML = `<i class="bi bi-hand-thumbs-up-fill"></i> Liked`;
    }
  } else {
    await setDoc(noteRef, {
      likes: 1,
      users: [user.uid]
    });
    likeCountText.textContent = 1;
    likeBtn.disabled = true;
    likeBtn.innerHTML = `<i class="bi bi-hand-thumbs-up-fill"></i> Liked`;
  }
}

// Authenticated user required to like
onAuthStateChanged(auth, (user) => {
  if (user) {
    loadLikes(user);
    likeBtn?.addEventListener("click", () => handleLike(user));
  } else {
    likeBtn?.addEventListener("click", () => {
      alert("Please login to like the note!");
    });
  }
});