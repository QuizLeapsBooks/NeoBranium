import { db, auth } from './auth.js';
import { collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const correctAnswers = {
  q1: "Paris",
  q2: "12",
  q3: "Mars",
  q4: "H2O",
  q5: "William Shakespeare"
};

async function submitQuiz() {
  const user = auth.currentUser;
  if (!user) {
    alert("Please log in to submit the quiz!");
    return;
  }

  const answers = {
    q1: document.querySelector('input[name="q1"]:checked')?.value,
    q2: document.querySelector('input[name="q2"]:checked')?.value,
    q3: document.querySelector('input[name="q3"]:checked')?.value,
    q4: document.querySelector('input[name="q4"]:checked')?.value,
    q5: document.querySelector('input[name="q5"]:checked')?.value
  };

  let score = 0;
  for (const [question, answer] of Object.entries(answers)) {
    if (answer === correctAnswers[question]) {
      score++;
    }
  }

  try {
    await addDoc(collection(db, "quiz_results"), {
      userId: user.uid,
      username: user.displayName || "Anonymous",
      score: score,
      timestamp: new Date()
    });
    alert(`Quiz submitted! Your score: ${score}/5`);
    loadLeaderboard();
  } catch (error) {
    console.error("Error submitting quiz:", error);
    alert("Error submitting quiz. Please try again.");
  }
}

async function loadLeaderboard() {
  const leaderboardList = document.getElementById('quizLeaderboard');
  leaderboardList.innerHTML = '<li>Loading...</li>';

  try {
    const q = query(collection(db, "quiz_results"), orderBy("score", "desc"), limit(3));
    const querySnapshot = await getDocs(q);
    leaderboardList.innerHTML = '';
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const li = document.createElement('li');
      li.textContent = `${data.username}: ${data.score}/5`;
      leaderboardList.appendChild(li);
    });
  } catch (error) {
    console.error("Error loading leaderboard:", error);
    leaderboardList.innerHTML = '<li>Error loading leaderboard</li>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const submitQuizBtn = document.getElementById('submitQuiz');
  if (submitQuizBtn) {
    submitQuizBtn.addEventListener('click', submitQuiz);
  }
  loadLeaderboard();
});