// like-button.js — Centralized Firebase singleton import
import { auth, db, onAuthStateChanged } from "./auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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
