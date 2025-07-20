// Quiz data for Polynomials (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is a polynomial?", options: ["An equation with one variable", "An expression with variables and exponents", "A fraction", "A constant"], answer: "An expression with variables and exponents" },
    { question: "What is the degree of a constant polynomial?", options: ["0", "1", "2", "3"], answer: "0" },
    { question: "Which is a monomial?", options: ["x + 2", "3x²", "x² + x", "x² + 2x + 1"], answer: "3x²" },
    { question: "What is the coefficient of x in 5x + 3?", options: ["5", "3", "8", "0"], answer: "5" },
    { question: "What is the degree of x² + 3x + 2?", options: ["1", "2", "3", "0"], answer: "2" },
    { question: "Which is a binomial?", options: ["x²", "x² + 3", "x³ + 2x + 1", "5"], answer: "x² + 3" },
    { question: "What is the value of x² when x = 2?", options: ["2", "4", "6", "8"], answer: "4" },
    { question: "Which is a polynomial of degree 1?", options: ["x² + 1", "2x + 3", "x³", "5"], answer: "2x + 3" },
    { question: "What is the constant term in 2x² + 3x + 4?", options: ["2", "3", "4", "0"], answer: "4" },
    { question: "Which is a trinomial?", options: ["x²", "x + 2", "x² + 2x + 1", "3x"], answer: "x² + 2x + 1" },
    { question: "What is the degree of 5x³ - 2x + 1?", options: ["1", "2", "3", "0"], answer: "3" },
    { question: "What is the value of 2x when x = 3?", options: ["2", "3", "6", "9"], answer: "6" },
    { question: "Which is not a polynomial?", options: ["x² + 1", "1/x", "2x + 3", "x³"], answer: "1/x" },
    { question: "What is the leading coefficient of 3x² + 2x + 1?", options: ["1", "2", "3", "0"], answer: "3" },
    { question: "What is the degree of 0?", options: ["0", "1", "undefined", "-1"], answer: "undefined" },
    { question: "Which is a linear polynomial?", options: ["x² + 1", "2x", "x³", "x² + x"], answer: "2x" },
    { question: "What is the value of x + 1 when x = 4?", options: ["3", "4", "5", "6"], answer: "5" },
    { question: "Which has a degree of 2?", options: ["x + 1", "x² + 1", "x³", "5x"], answer: "x² + 1" },
    { question: "What is the number of terms in 2x² + 3x - 1?", options: ["1", "2", "3", "4"], answer: "3" },
    { question: "Which is a zero polynomial?", options: ["x² + 1", "0", "2x", "x + 1"], answer: "0" }
  ],
  level2: [
    { question: "What is the sum of (x² + 2x + 1) and (x² - 3x + 2)?", options: ["2x² - x + 3", "2x² + 5x + 3", "x² - x + 3", "2x² - 5x + 3"], answer: "2x² - x + 3" },
    { question: "What is the product of (x + 2) and (x + 3)?", options: ["x² + 5x + 6", "x² + 6x + 5", "x² + 5x - 6", "x² - 5x + 6"], answer: "x² + 5x + 6" },
    { question: "What is the degree of (2x² + 3)(x - 1)?", options: ["1", "2", "3", "4"], answer: "3" },
    { question: "What is the value of x² - 4 at x = 2?", options: ["0", "2", "4", "8"], answer: "0" },
    { question: "Which is a factor of x² - 9?", options: ["(x - 3)", "(x + 3)", "(x - 9)", "(x + 9)"], answer: "(x - 3)" },
    { question: "What is the remainder when x² + 1 is divided by x - 1?", options: ["0", "1", "2", "3"], answer: "2" },
    { question: "What is the product of (2x + 1) and (x - 2)?", options: ["2x² - 3x - 2", "2x² - 3x + 2", "2x² + 3x - 2", "2x² + 3x + 2"], answer: "2x² - 3x - 2" },
    { question: "What is the degree of (x + 1)³?", options: ["1", "2", "3", "4"], answer: "3" },
    { question: "What is the value of 2x² + 3x - 5 at x = -1?", options: ["-10", "-6", "0", "6"], answer: "-6" },
    { question: "Which is a factor of x² + 5x + 6?", options: ["(x + 2)", "(x + 3)", "(x - 2)", "(x - 3)"], answer: "(x + 2)" },
    { question: "What is the sum of (2x² - 3x + 1) and (-x² + 4x - 2)?", options: ["x² + x - 1", "x² + x + 1", "x² - x - 1", "x² - x + 1"], answer: "x² + x - 1" },
    { question: "What is the quotient when x² - 1 is divided by (x - 1)?", options: ["x + 1", "x - 1", "x", "1"], answer: "x + 1" },
    { question: "What is the value of (x - 1)(x + 1) at x = 2?", options: ["0", "1", "3", "4"], answer: "3" },
    { question: "Which is a factor of x² - 4x + 4?", options: ["(x - 2)", "(x + 2)", "(x - 4)", "(x + 4)"], answer: "(x - 2)" },
    { question: "What is the degree of (x² + 1)(x² - 1)?", options: ["2", "3", "4", "5"], answer: "4" },
    { question: "What is the remainder when x³ - 1 is divided by (x - 1)?", options: ["0", "1", "-1", "2"], answer: "0" },
    { question: "What is the product of (x - 3) and (x + 3)?", options: ["x² - 9", "x² + 9", "x² - 6x + 9", "x² + 6x + 9"], answer: "x² - 9" },
    { question: "What is the value of x² + 2x + 1 at x = -1?", options: ["0", "1", "2", "4"], answer: "0" },
    { question: "Which is a factor of x³ - 8?", options: ["(x - 2)", "(x + 2)", "(x - 3)", "(x + 3)"], answer: "(x - 2)" },
    { question: "What is the sum of (x² + 3) and (2x² - 4)?", options: ["3x² - 1", "3x² + 7", "3x² - 7", "3x² + 1"], answer: "3x² - 1" }
  ],
  level3: [
    { question: "What is the quotient when x³ - 6x² + 11x - 6 is divided by (x - 2)?", options: ["x² - 4x + 3", "x² - 2x + 3", "x² + 4x - 3", "x² + 2x - 3"], answer: "x² - 4x + 3" },
    { question: "What is the remainder when x⁴ - 1 is divided by (x - 1)?", options: ["0", "1", "-1", "2"], answer: "0" },
    { question: "What is the value of (x - 1)³ at x = 2?", options: ["1", "8", "27", "0"], answer: "1" },
    { question: "Which is a factor of x³ + x² - 4x - 4?", options: ["(x + 2)", "(x - 2)", "(x + 1)", "(x - 1)"], answer: "(x + 2)" },
    { question: "What is the product of (x² + 2)(x² - 2)?", options: ["x⁴ - 4", "x⁴ + 4", "x⁴ - 2", "x⁴ + 2"], answer: "x⁴ - 4" },
    { question: "What is the degree of (x² + 1)²?", options: ["2", "3", "4", "5"], answer: "4" },
    { question: "What is the quotient when x³ + 8 is divided by (x + 2)?", options: ["x² - 2x + 4", "x² + 2x - 4", "x² - 4x + 2", "x² + 4x - 2"], answer: "x² - 2x + 4" },
    { question: "What is the value of x³ - 3x² + 2x - 1 at x = 1?", options: ["-1", "0", "1", "2"], answer: "-1" },
    { question: "Which is a factor of x³ - 3x² - 4x + 12?", options: ["(x - 2)", "(x + 2)", "(x - 3)", "(x + 3)"], answer: "(x - 2)" },
    { question: "What is the sum of (x³ - 2x² + x) and (2x² - x + 3)?", options: ["x³ + 3", "x³ - 3", "x³ + 4", "x³ - 4"], answer: "x³ + 3" },
    { question: "What is the remainder when x⁴ + x² + 1 is divided by (x - 1)?", options: ["1", "2", "3", "4"], answer: "3" },
    { question: "What is the product of (x - 1)(x + 1)(x - 2)?", options: ["x³ - 2x² - x + 2", "x³ - 2x² + x - 2", "x³ + 2x² - x + 2", "x³ + 2x² + x - 2"], answer: "x³ - 2x² - x + 2" },
    { question: "What is the degree of (x - 1)(x + 1)(x - 2)?", options: ["2", "3", "4", "5"], answer: "3" },
    { question: "What is the value of (x² + 3x + 2) at x = -2?", options: ["0", "2", "4", "-2"], answer: "0" },
    { question: "Which is a factor of x³ + 6x² + 11x + 6?", options: ["(x + 1)", "(x - 1)", "(x + 2)", "(x - 2)"], answer: "(x + 1)" },
    { question: "What is the quotient when x³ - 1 is divided by (x - 1)?", options: ["x² + x + 1", "x² - x + 1", "x² + 1", "x - 1"], answer: "x² + x + 1" },
    { question: "What is the value of x³ + 3x² - 4 at x = -1?", options: ["-2", "0", "2", "6"], answer: "-2" },
    { question: "What is the product of (2x + 3) and (x² - x + 1)?", options: ["2x³ + x² - x + 3", "2x³ - x² + x + 3", "2x³ + x² + x + 3", "2x³ - x² - x + 3"], answer: "2x³ + x² - x + 3" },
    { question: "What is the degree of (x² - 1)(x + 1)²?", options: ["2", "3", "4", "5"], answer: "4" },
    { question: "What is the remainder when x³ + 2x² - 5 is divided by (x + 1)?", options: ["-2", "0", "2", "-4"], answer: "-2" }
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