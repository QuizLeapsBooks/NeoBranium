// Quiz data for Number Systems (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is a natural number?", options: ["0, 1, 2, 3...", "..., -2, -1, 0", "-1, 0, 1", "All numbers"], answer: "0, 1, 2, 3..." },
    { question: "Which is the smallest whole number?", options: ["0", "1", "-1", "2"], answer: "0" },
    { question: "What is an integer?", options: ["Only positive numbers", "All whole numbers and their negatives", "Only fractions", "Only decimals"], answer: "All whole numbers and their negatives" },
    { question: "Which number is rational?", options: ["√2", "0.333...", "π", "1/2"], answer: "1/2" },
    { question: "What is the value of √1?", options: ["0", "1", "-1", "2"], answer: "1" },
    { question: "Which is an irrational number?", options: ["1/3", "0.75", "√3", "2/5"], answer: "√3" },
    { question: "What is the decimal form of 1/2?", options: ["0.2", "0.5", "0.25", "0.75"], answer: "0.5" },
    { question: "Which number system includes negative numbers?", options: ["Natural numbers", "Whole numbers", "Integers", "Rational numbers"], answer: "Integers" },
    { question: "What is the successor of 9?", options: ["8", "9", "10", "11"], answer: "10" },
    { question: "Which is a terminating decimal?", options: ["1/3", "0.333...", "0.25", "√5"], answer: "0.25" },
    { question: "What is the value of √4?", options: ["2", "1", "4", "-2"], answer: "2" },
    { question: "Which number is not a whole number?", options: ["0", "1", "-1", "2"], answer: "-1" },
    { question: "What is a rational number?", options: ["Can be written as a fraction", "Cannot be written as a fraction", "Only integers", "Only natural numbers"], answer: "Can be written as a fraction" },
    { question: "Which is the largest natural number?", options: ["0", "10", "100", "Infinite"], answer: "Infinite" },
    { question: "What is the decimal form of 1/4?", options: ["0.25", "0.5", "0.75", "0.1"], answer: "0.25" },
    { question: "Which number is an integer but not a natural number?", options: ["1", "0", "-1", "2"], answer: "-1" },
    { question: "What is the value of √9?", options: ["3", "2", "4", "-3"], answer: "3" },
    { question: "Which is a non-terminating, non-repeating decimal?", options: ["0.5", "0.333...", "π", "0.25"], answer: "π" },
    { question: "What is the predecessor of 0?", options: ["-1", "0", "1", "2"], answer: "-1" },
    { question: "Which number system does not include fractions?", options: ["Integers", "Rational numbers", "Real numbers", "Irrational numbers"], answer: "Integers" }
  ],
  level2: [
    { question: "What is the value of √0.25?", options: ["0.5", "0.25", "0.75", "1"], answer: "0.5" },
    { question: "Which number is irrational?", options: ["1/2", "0.6", "√2", "0.25"], answer: "√2" },
    { question: "What is 3/4 as a decimal?", options: ["0.75", "0.5", "0.25", "0.3"], answer: "0.75" },
    { question: "What is the square root of 16?", options: ["2", "4", "8", "16"], answer: "4" },
    { question: "Which is a rational number between 1 and 2?", options: ["1.5", "√2", "π", "1.8"], answer: "1.5" },
    { question: "What is the decimal expansion of 1/3?", options: ["0.3", "0.33", "0.333...", "0.4"], answer: "0.333..." },
    { question: "What is the value of (-2)²?", options: ["-4", "4", "2", "-2"], answer: "4" },
    { question: "Which number is not a perfect square?", options: ["9", "16", "15", "25"], answer: "15" },
    { question: "What is the square root of 0.01?", options: ["0.1", "0.01", "0.001", "1"], answer: "0.1" },
    { question: "Which is a terminating decimal expansion?", options: ["1/6", "1/9", "1/4", "1/11"], answer: "1/4" },
    { question: "What is the value of √50 (approximate)?", options: ["5", "7", "7.07", "10"], answer: "7.07" },
    { question: "Which number is a rational approximation of √3?", options: ["1.732", "1.5", "2", "1.4"], answer: "1.732" },
    { question: "What is 2/5 as a decimal?", options: ["0.2", "0.4", "0.6", "0.8"], answer: "0.4" },
    { question: "Which is the square of 5?", options: ["10", "15", "25", "50"], answer: "25" },
    { question: "What is the decimal expansion of 1/7 (approximate)?", options: ["0.142", "0.143", "0.14", "0.15"], answer: "0.142" },
    { question: "Which number is a perfect cube?", options: ["8", "10", "12", "15"], answer: "8" },
    { question: "What is the value of √0.16?", options: ["0.4", "0.04", "0.2", "0.6"], answer: "0.4" },
    { question: "Which is an irrational number between 2 and 3?", options: ["2.5", "√5", "2.7", "3"], answer: "√5" },
    { question: "What is the cube root of 27?", options: ["2", "3", "4", "5"], answer: "3" },
    { question: "Which decimal is non-terminating but repeating?", options: ["0.5", "0.333...", "0.25", "0.75"], answer: "0.333..." }
  ],
  level3: [
    { question: "What is the value of √72 (approximate)?", options: ["8", "8.48", "9", "10"], answer: "8.48" },
    { question: "Which is the rationalization of 1/√2?", options: ["√2", "√2/2", "2/√2", "1/2"], answer: "√2/2" },
    { question: "What is the decimal expansion of 1/11 (approximate)?", options: ["0.0909", "0.09", "0.1", "0.0818"], answer: "0.0909" },
    { question: "What is the square root of 200 (approximate)?", options: ["10", "14.14", "15", "20"], answer: "14.14" },
    { question: "Which number is irrational and its square is 5?", options: ["√5", "2", "2.5", "√10"], answer: "√5" },
    { question: "What is the value of (√3 + √2)²?", options: ["5 + 2√6", "5 - 2√6", "7", "10"], answer: "5 + 2√6" },
    { question: "What is the rational number between √2 and √3?", options: ["1.5", "1.7", "1.9", "2.1"], answer: "1.7" },
    { question: "What is the cube root of 125?", options: ["3", "4", "5", "6"], answer: "5" },
    { question: "What is the value of √0.0009?", options: ["0.03", "0.3", "0.003", "0.0003"], answer: "0.03" },
    { question: "Which is the rationalization of 1/(√5 - √2)?", options: ["(√5 + √2)/(3)", "(√5 - √2)/3", "(√5 + √2)/5", "(√5 - √2)/5"], answer: "(√5 + √2)/3" },
    { question: "What is the approximate value of √7?", options: ["2.6", "2.64", "2.7", "3"], answer: "2.64" },
    { question: "What is the decimal expansion of 1/13 (approximate)?", options: ["0.0769", "0.07", "0.08", "0.09"], answer: "0.0769" },
    { question: "What is the square root of 98 (approximate)?", options: ["9.8", "9.9", "10", "7"], answer: "9.9" },
    { question: "Which number’s square is 50 (approximate)?", options: ["7", "7.07", "8", "10"], answer: "7.07" },
    { question: "What is the value of (√3 - 1)/(√3 + 1)?", options: ["2 - √3", "√3 - 1", "2 + √3", "1"], answer: "2 - √3" },
    { question: "What is the cube root of 0.008?", options: ["0.2", "0.02", "0.002", "0.0002"], answer: "0.2" },
    { question: "What is the approximate value of √15?", options: ["3.8", "3.87", "4", "5"], answer: "3.87" },
    { question: "Which is the rationalization of 1/(√7 + √3)?", options: ["(√7 - √3)/4", "(√7 + √3)/4", "(√7 - √3)/10", "(√7 + √3)/10"], answer: "(√7 - √3)/4" },
    { question: "What is the square root of 0.09?", options: ["0.3", "0.03", "0.9", "0.09"], answer: "0.3" },
    { question: "What is the approximate value of √50 - √18?", options: ["4", "4.14", "5", "6"], answer: "4.14" }
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
    const sidebar = document.queryselector('.sidebar');
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