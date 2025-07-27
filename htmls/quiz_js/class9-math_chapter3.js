// Quiz data for Coordinate Geometry (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is the coordinate plane also known as?", options: ["Graph paper", "Cartesian plane", "Number line", "Grid"], answer: "Cartesian plane" },
    { question: "What are the x and y axes?", options: ["Horizontal and vertical lines", "Diagonal lines", "Curved lines", "Parallel lines"], answer: "Horizontal and vertical lines" },
    { question: "What is the point (0, 0) called?", options: ["Origin", "Center", "Vertex", "Intersection"], answer: "Origin" },
    { question: "In which quadrant is the point (2, 3) located?", options: ["I", "II", "III", "IV"], answer: "I" },
    { question: "What is the x-coordinate of the point (-4, 5)?", options: ["-4", "5", "0", "1"], answer: "-4" },
    { question: "What is the y-coordinate of the point (3, -2)?", options: ["3", "-2", "0", "1"], answer: "-2" },
    { question: "Which quadrant has both x and y negative?", options: ["I", "II", "III", "IV"], answer: "III" },
    { question: "What is the distance of (2, 0) from the y-axis?", options: ["2 units", "0 units", "1 unit", "3 units"], answer: "2 units" },
    { question: "What is the distance of (0, 5) from the x-axis?", options: ["5 units", "0 units", "1 unit", "2 units"], answer: "5 units" },
    { question: "In which quadrant is the point (-1, -4) located?", options: ["I", "II", "III", "IV"], answer: "III" },
    { question: "What is the x-coordinate of the point (0, -3)?", options: ["0", "-3", "1", "2"], answer: "0" },
    { question: "What is the y-coordinate of the point (6, 0)?", options: ["6", "0", "-1", "2"], answer: "0" },
    { question: "Which quadrant has x positive and y negative?", options: ["I", "II", "III", "IV"], answer: "IV" },
    { question: "What is the distance of (-3, 0) from the y-axis?", options: ["3 units", "0 units", "1 unit", "2 units"], answer: "3 units" },
    { question: "What is the distance of (0, -2) from the x-axis?", options: ["2 units", "0 units", "1 unit", "3 units"], answer: "2 units" },
    { question: "In which quadrant is the point (5, -1) located?", options: ["I", "II", "III", "IV"], answer: "IV" },
    { question: "What is the point on the x-axis with x = 4?", options: ["(4, 0)", "(0, 4)", "(-4, 0)", "(4, 4)"], answer: "(4, 0)" },
    { question: "What is the point on the y-axis with y = -3?", options: ["(0, -3)", "(-3, 0)", "(3, 0)", "(0, 3)"], answer: "(0, -3)" },
    { question: "Which point lies on the x-axis?", options: ["(1, 1)", "(0, 2)", "(3, 0)", "(0, 0)"], answer: "(3, 0)" },
    { question: "Which point lies on the y-axis?", options: ["(1, 0)", "(0, 4)", "(2, 2)", "(-1, 0)"], answer: "(0, 4)" }
  ],
  level2: [
    { question: "What is the distance between (2, 3) and (5, 3)?", options: ["3 units", "4 units", "5 units", "2 units"], answer: "3 units" },
    { question: "What is the distance between (0, 0) and (4, 3)?", options: ["5 units", "4 units", "3 units", "7 units"], answer: "5 units" },
    { question: "What is the midpoint of (2, 4) and (6, 8)?", options: ["(4, 6)", "(5, 6)", "(4, 5)", "(3, 6)"], answer: "(4, 6)" },
    { question: "What is the distance between (-2, 1) and (1, 5)?", options: ["5 units", "4 units", "3 units", "6 units"], answer: "5 units" },
    { question: "What is the x-coordinate of the midpoint of (-3, 4) and (5, 4)?", options: ["1", "2", "3", "0"], answer: "1" },
    { question: "What is the y-coordinate of the midpoint of (2, -1) and (2, 5)?", options: ["2", "3", "1", "4"], answer: "2" },
    { question: "What is the distance between (0, -2) and (0, 6)?", options: ["8 units", "6 units", "4 units", "2 units"], answer: "8 units" },
    { question: "What is the midpoint of (-4, -2) and (2, 6)?", options: ["(-1, 2)", "(0, 2)", "(1, 2)", "(-2, 4)"], answer: "(-1, 2)" },
    { question: "What is the distance between (1, 2) and (-3, 2)?", options: ["4 units", "5 units", "6 units", "3 units"], answer: "4 units" },
    { question: "What is the x-coordinate of the midpoint of (-5, 3) and (1, 3)?", options: ["-2", "-1", "0", "1"], answer: "-2" },
    { question: "What is the y-coordinate of the midpoint of (-1, -4) and (-1, 2)?", options: ["-1", "0", "1", "-2"], answer: "-1" },
    { question: "What is the distance between (-2, -3) and (2, -3)?", options: ["4 units", "5 units", "6 units", "3 units"], answer: "4 units" },
    { question: "What is the midpoint of (0, 0) and (6, 8)?", options: ["(3, 4)", "(2, 4)", "(4, 3)", "(3, 2)"], answer: "(3, 4)" },
    { question: "What is the distance between (3, 4) and (3, -2)?", options: ["6 units", "5 units", "4 units", "7 units"], answer: "6 units" },
    { question: "What is the x-coordinate of the midpoint of (-2, -5) and (4, -5)?", options: ["1", "2", "0", "-1"], answer: "1" },
    { question: "What is the y-coordinate of the midpoint of (5, 1) and (5, 7)?", options: ["4", "3", "2", "5"], answer: "4" },
    { question: "What is the distance between (-1, 0) and (5, 0)?", options: ["6 units", "5 units", "4 units", "7 units"], answer: "6 units" },
    { question: "What is the midpoint of (-3, 0) and (3, 0)?", options: ["(0, 0)", "(1, 0)", "(-1, 0)", "(2, 0)"], answer: "(0, 0)" },
    { question: "What is the distance between (2, 5) and (-2, 5)?", options: ["4 units", "6 units", "5 units", "3 units"], answer: "4 units" },
    { question: "What is the y-coordinate of the midpoint of (0, -3) and (0, 9)?", options: ["3", "4", "5", "6"], answer: "3" }
  ],
  level3: [
    { question: "What is the distance between (1, 2) and (4, 6)?", options: ["5 units", "6 units", "4 units", "7 units"], answer: "5 units" },
    { question: "What is the midpoint of (-2, -3) and (6, 9)?", options: ["(2, 3)", "(1, 3)", "(2, 6)", "(3, 2)"], answer: "(2, 3)" },
    { question: "What is the distance between (-3, -4) and (3, 4)?", options: ["10 units", "8 units", "6 units", "12 units"], answer: "10 units" },
    { question: "What is the x-coordinate of the midpoint of (-5, -2) and (3, 8)?", options: ["-1", "0", "1", "-2"], answer: "-1" },
    { question: "What is the y-coordinate of the midpoint of (4, -1) and (-2, 5)?", options: ["2", "1", "3", "0"], answer: "2" },
    { question: "What is the distance between (0, 0) and (-5, 12)?", options: ["13 units", "12 units", "11 units", "14 units"], answer: "13 units" },
    { question: "What is the midpoint of (1, -5) and (-7, 3)?", options: ["(-3, -1)", "(-2, -1)", "(-3, 1)", "(-2, 1)"], answer: "(-3, -1)" },
    { question: "What is the distance between (-4, 3) and (2, -1)?", options: ["7 units", "6 units", "8 units", "5 units"], answer: "7 units" },
    { question: "What is the x-coordinate of the midpoint of (-6, 4) and (2, -2)?", options: ["-2", "-1", "0", "1"], answer: "-2" },
    { question: "What is the y-coordinate of the midpoint of (3, -6) and (-1, 2)?", options: ["-2", "-1", "0", "1"], answer: "-2" },
    { question: "What is the distance between (5, -2) and (-1, 6)?", options: ["10 units", "8 units", "9 units", "11 units"], answer: "10 units" },
    { question: "What is the midpoint of (-4, 6) and (8, -2)?", options: ["(2, 2)", "(1, 2)", "(2, 1)", "(3, 2)"], answer: "(2, 2)" },
    { question: "What is the distance between (-2, 7) and (3, -4)?", options: ["13 units", "12 units", "11 units", "14 units"], answer: "13 units" },
    { question: "What is the x-coordinate of the midpoint of (-8, -3) and (4, 7)?", options: ["-2", "-1", "0", "1"], answer: "-2" },
    { question: "What is the y-coordinate of the midpoint of (6, -5) and (-2, 3)?", options: ["-1", "0", "1", "-2"], answer: "-1" },
    { question: "What is the distance between (0, 5) and (-6, -1)?", options: ["8 units", "7 units", "9 units", "10 units"], answer: "10 units" },
    { question: "What is the midpoint of (3, -4) and (-5, 6)?", options: ["(-1, 1)", "(0, 1)", "(-1, 0)", "(1, -1)"], answer: "(-1, 1)" },
    { question: "What is the distance between (-3, 2) and (4, -5)?", options: ["10 units", "9 units", "8 units", "11 units"], answer: "10 units" },
    { question: "What is the x-coordinate of the midpoint of (-7, 1) and (3, -5)?", options: ["-2", "-1", "0", "1"], answer: "-2" },
    { question: "What is the y-coordinate of the midpoint of (2, -8) and (-4, 4)?", options: ["-2", "-1", "0", "1"], answer: "-2" }
  ]
};

// Render quiz
function renderQuiz(level) {
  const quizContainer = document.getElementById("quizContainer");
  quizContainer.innerHTML = ""; // Clear previous questions
  quizData[level].forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card animate__animated animate__fadeInUp";
    card.innerHTML = `
      <div class="card__content">
        <h5>Q${index + 1}: ${item.question}</h5>
        ${item.options.map(option => `
          <label>
            <input type="radio" name="q${index}" value="${option}"> ${option}
          </label>
        `).join("")}
      </div>
    `;
    quizContainer.appendChild(card);
  });
}

// Check answers
function checkAnswers(level) {
  let score = 0;
  quizData[level].forEach((item, index) => {
    const selected = document.querySelector(`input[name="q${index}"]:checked`);
    if (selected) {
      const userAnswer = selected.value;
      if (userAnswer === item.answer) {
        score++;
        selected.parentElement.style.color = "var(--correct-color)";
      } else {
        selected.parentElement.style.color = "var(--wrong-color)";
      }
    }
  });
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `Your Score: ${score}/${quizData[level].length} 🎉<br>${score === quizData[level].length ? "Full marks, bro! 😎" : "Keep grinding! 🚀"}`;
  resultDiv.className = "result animate__animated animate__bounceIn";
}

// Level selection
document.addEventListener("DOMContentLoaded", () => {
  renderQuiz("level1"); // Default to Level 1
  document.getElementById("levelSelect").addEventListener("change", function () {
    const selectedLevel = this.value;
    renderQuiz(selectedLevel);
    document.getElementById("submitQuiz").onclick = () => checkAnswers(selectedLevel);
  });

  document.getElementById("submitQuiz").onclick = () => checkAnswers("level1");

  // Toggle sidebar
  document.querySelector('.navbar-toggler').addEventListener('click', function () {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('main');
    sidebar.classList.toggle('active');
    main.classList.toggle('shifted');
  });

  // Responsive adjustment
  window.addEventListener('resize', function () {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('main');
    if (window.innerWidth >= 1024) {
      sidebar.classList.remove('active');
      main.classList.remove('shifted');
      main.style.marginLeft = '250px';
    } else if (window.innerWidth >= 768) {
      main.style.marginLeft = sidebar.classList.contains('active') ? '0' : '200px';
    } else {
      main.style.marginLeft = '0';
    }
  });

  // Initial load adjustment
  window.addEventListener('load', function () {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('main');
    if (window.innerWidth >= 1024) {
      main.style.marginLeft = '250px';
    } else if (window.innerWidth >= 768) {
      main.style.marginLeft = '200px';
    } else {
      main.style.marginLeft = '0';
    }
  });
});