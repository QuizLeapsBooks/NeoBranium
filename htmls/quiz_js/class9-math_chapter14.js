// Quiz data for Statistics (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is the mean of the numbers 2, 4, 6, 8, 10?", options: ["6", "5", "7", "8"], answer: "6" },
    { question: "What is the median of the numbers 3, 5, 7, 9, 11?", options: ["7", "6", "8", "5"], answer: "7" },
    { question: "What is the mode of the numbers 1, 2, 2, 3, 4?", options: ["2", "1", "3", "4"], answer: "2" },
    { question: "What is the range of the numbers 4, 7, 12, 15, 20?", options: ["16", "14", "12", "18"], answer: "16" },
    { question: "In a frequency distribution, what does the frequency represent?", options: ["Number of occurrences", "Sum of data", "Average of data", "Difference of data"], answer: "Number of occurrences" },
    { question: "What is the class mark of the class interval 10-20?", options: ["15", "10", "20", "12.5"], answer: "15" },
    { question: "What is the mean of the numbers 5, 5, 5, 5?", options: ["5", "4", "6", "0"], answer: "5" },
    { question: "What is the median of the numbers 2, 4, 6, 8?", options: ["5", "4", "6", "3"], answer: "5" },
    { question: "What is the mode of the numbers 3, 3, 4, 4, 4, 5?", options: ["4", "3", "5", "None"], answer: "4" },
    { question: "What is the range of the numbers 8, 10, 12, 14, 16?", options: ["8", "6", "10", "12"], answer: "8" },
    { question: "What is the class width of the class interval 20-30?", options: ["10", "20", "30", "5"], answer: "10" },
    { question: "What is the mean of the numbers 1, 3, 5, 7, 9?", options: ["5", "4", "6", "3"], answer: "5" },
    { question: "What is the median of the numbers 1, 2, 3, 4, 5, 6?", options: ["3.5", "3", "4", "2.5"], answer: "3.5" },
    { question: "What is the mode of the numbers 2, 2, 3, 4, 4?", options: ["2 and 4", "2", "4", "None"], answer: "2 and 4" },
    { question: "What is the range of the numbers 5, 10, 15, 20, 25?", options: ["20", "15", "25", "10"], answer: "20" },
    { question: "What is the class mark of the class interval 30-40?", options: ["35", "30", "40", "32.5"], answer: "35" },
    { question: "What is the mean of the numbers 4, 8, 12, 16?", options: ["10", "8", "12", "9"], answer: "10" },
    { question: "What is the median of the numbers 7, 9, 11, 13, 15?", options: ["11", "10", "12", "9"], answer: "11" },
    { question: "What is the mode of the numbers 5, 5, 6, 7, 7, 7?", options: ["7", "5", "6", "5 and 7"], answer: "7" },
    { question: "What is the range of the numbers 3, 6, 9, 12, 15?", options: ["12", "9", "15", "6"], answer: "12" }
  ],
  level2: [
    { question: "The marks of 5 students are 10, 20, 30, 40, 50. What is the mean?", options: ["30", "25", "35", "20"], answer: "30" },
    { question: "The numbers 4, 6, 8, 10, 12 are given. What is the median?", options: ["8", "7", "9", "6"], answer: "8" },
    { question: "In a frequency distribution with data 2, 2, 3, 3, 3, 4, what is the mode?", options: ["3", "2", "4", "2 and 3"], answer: "3" },
    { question: "The class intervals are 0-10, 10-20, 20-30. What is the class width?", options: ["10", "20", "5", "15"], answer: "10" },
    { question: "The marks 15, 25, 35, 45, 55 have frequencies 1, 2, 3, 2, 1. What is the mean?", options: ["35", "30", "40", "25"], answer: "35" },
    { question: "The numbers 1, 3, 5, 7, 9, 11 are given. What is the median?", options: ["6", "5", "7", "4"], answer: "6" },
    { question: "The data 5, 5, 6, 6, 7, 7, 7, 8 has a mode of:", options: ["7", "6", "5", "8"], answer: "7" },
    { question: "The class marks of a frequency distribution are 5, 15, 25, 35. What is the class width?", options: ["10", "5", "15", "20"], answer: "10" },
    { question: "The marks 10, 20, 30, 40 have frequencies 2, 3, 4, 1. What is the mean?", options: ["25", "27", "30", "22"], answer: "25" },
    { question: "The numbers 2, 4, 6, 8, 10, 12, 14 are given. What is the median?", options: ["8", "7", "6", "9"], answer: "8" },
    { question: "The data 1, 1, 2, 2, 3, 3, 3, 4 has a mode of:", options: ["3", "2", "1", "4"], answer: "3" },
    { question: "The class intervals are 5-15, 15-25, 25-35. What is the class mark of 15-25?", options: ["20", "15", "25", "17.5"], answer: "20" },
    { question: "The marks 5, 10, 15, 20 have frequencies 1, 2, 3, 4. What is the mean?", options: ["15", "14", "16", "13"], answer: "15" },
    { question: "The numbers 3, 5, 7, 9, 11, 13, 15 are given. What is the median?", options: ["9", "8", "10", "7"], answer: "9" },
    { question: "The data 4, 4, 4, 5, 5, 6, 6, 6 has a mode of:", options: ["4 and 6", "4", "6", "5"], answer: "4 and 6" },
    { question: "The class intervals are 10-20, 20-30, 30-40. What is the class width?", options: ["10", "20", "5", "15"], answer: "10" },
    { question: "The marks 20, 30, 40, 50 have frequencies 2, 3, 2, 1. What is the mean?", options: ["35", "32.5", "30", "37.5"], answer: "32.5" },
    { question: "The numbers 1, 2, 3, 4, 5, 6, 7, 8 are given. What is the median?", options: ["4.5", "4", "5", "3.5"], answer: "4.5" },
    { question: "The data 2, 2, 3, 3, 4, 4, 4, 5 has a mode of:", options: ["4", "3", "2", "5"], answer: "4" },
    { question: "The class marks are 10, 20, 30, 40. What is the class interval for class mark 20?", options: ["15-25", "10-30", "20-30", "10-20"], answer: "15-25" }
  ],
  level3: [
    { question: "A frequency distribution has class intervals 10-20, 20-30, 30-40, 40-50 with frequencies 4, 6, 8, 2. What is the mean using the step-deviation method (assume h = 10, A = 35)?", options: ["31", "32", "33", "34"], answer: "32" },
    { question: "The cumulative frequency table gives less than 20: 5, less than 30: 12, less than 40: 20, less than 50: 25. What is the median class?", options: ["20-30", "30-40", "40-50", "10-20"], answer: "20-30" },
    { question: "A histogram has class intervals 0-10, 10-20, 20-30 with frequencies 3, 5, 7. If the height of the rectangle for 10-20 is 5 units, what is the height for 20-30?", options: ["7", "6", "8", "5"], answer: "7" },
    { question: "The marks 10, 20, 30, 40, 50 have frequencies 2, 4, 6, 4, 2. If the mean is 30, what is the sum of deviations from the mean?", options: ["0", "60", "120", "30"], answer: "0" },
    { question: "A frequency distribution has class intervals 5-15, 15-25, 25-35, 35-45 with frequencies 3, 7, 5, 2. What is the mode using the formula?", options: ["20", "22", "18", "24"], answer: "20" },
    { question: "The ogive for a data set shows the median at 25. The class intervals are 10-20, 20-30, 30-40 with cumulative frequencies 8, 18, 25. What is the median value using interpolation?", options: ["25", "24", "26", "23"], answer: "24" },
    { question: "The points (10, 2), (20, 4), (30, 6), (40, 3), (50, 1) represent class marks and frequencies. What is the mean using coordinate geometry (weighted average)?", options: ["26", "28", "30", "32"], answer: "28" },
    { question: "A frequency distribution has class intervals 0-10, 10-20, 20-30, 30-40 with frequencies 4, 6, 8, 2. If the median class is 20-30, what is the median using the formula?", options: ["25", "26", "27", "28"], answer: "26" },
    { question: "The data points (5, 3), (15, 7), (25, 5), (35, 2) are class marks and frequencies. What is the mode using coordinate geometry?", options: ["15", "20", "25", "10"], answer: "15" },
    { question: "A cumulative frequency table gives less than 15: 4, less than 25: 12, less than 35: 20, less than 45: 25. What is the mean using class marks 10, 20, 30, 40?", options: ["26", "27", "28", "29"], answer: "27" },
    { question: "A histogram with class intervals 10-20, 20-30, 30-40 has frequencies 5, 8, 3. If the area of the rectangle for 20-30 is 80 units, what is the area for 10-20?", options: ["50", "60", "70", "40"], answer: "50" },
    { question: "The marks 15, 25, 35, 45 have frequencies 2, 3, 4, 1. If a new observation 55 with frequency 2 is added, what is the new mean?", options: ["32", "33", "34", "35"], answer: "33" },
    { question: "The ogive for class intervals 0-10, 10-20, 20-30, 30-40 shows cumulative frequencies 5, 15, 22, 25. What is the median class?", options: ["10-20", "20-30", "30-40", "0-10"], answer: "10-20" },
    { question: "A frequency distribution has class intervals 5-15, 15-25, 25-35 with frequencies 4, 8, 6. What is the mean using the step-deviation method (A = 20, h = 10)?", options: ["21", "22", "23", "24"], answer: "22" },
    { question: "The points (10, 3), (20, 5), (30, 7), (40, 2) represent class marks and frequencies. What is the median using coordinate geometry?", options: ["25", "20", "30", "15"], answer: "25" },
    { question: "A frequency distribution has class intervals 10-20, 20-30, 30-40, 40-50 with frequencies 3, 7, 5, 2. What is the mode using the formula?", options: ["25", "27", "29", "23"], answer: "25" },
    { question: "The cumulative frequency table gives less than 20: 6, less than 30: 14, less than 40: 20, less than 50: 25. What is the median using interpolation?", options: ["28", "29", "30", "31"], answer: "29" },
    { question: "A histogram with class intervals 0-10, 10-20, 20-30 has frequencies 4, 6, 5. If the height of the rectangle for 10-20 is 3 units, what is the height for 0-10?", options: ["2", "3", "4", "5"], answer: "2" },
    { question: "The marks 10, 20, 30, 40, 50 have frequencies 1, 2, 3, 2, 2. If the mean is 30, what is the variance?", options: ["144", "150", "156", "162"], answer: "156" },
    { question: "The ogive for class intervals 5-15, 15-25, 25-35, 35-45 shows cumulative frequencies 4, 12, 18, 20. What is the median using the formula?", options: ["22", "23", "24", "25"], answer: "23" }
  ]
};

// Render quiz
function renderQuiz(level) {
  console.log("Rendering quiz for level: ", level);
  const quizContainer = document.getElementById("quizContainer");
  if (!quizContainer) {
    console.error("quizContainer not found!");
    return;
  }
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
  console.log("Checking answers for level: ", level);
  let score = 0;
  quizData[level].forEach((item, index) => {
    const selected = document.querySelector(`input[name="q${index}"]:checked`);
    console.log(`Q${index + 1}: User Answer = ${selected ? selected.value : 'none'}, Correct Answer = ${item.answer}`);
    if (selected && selected.value === item.answer) {
      score++;
      selected.parentElement.style.color = "var(--correct-color)";
    } else if (selected) {
      selected.parentElement.style.color = "var(--wrong-color)";
    }
  });
  const resultDiv = document.getElementById("result");
  if (!resultDiv) {
    console.error("resultDiv not found!");
    return;
  }
  resultDiv.innerHTML = `Your Score: ${score}/${quizData[level].length} 🎉<br>${score === quizData[level].length ? "Full marks, bro! 😎" : "Keep grinding! 🚀"}`;
  resultDiv.className = "result animate__animated animate__bounceIn";
}

// Level selection
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing quiz...");
  renderQuiz("level1"); // Default to Level 1
  const levelSelect = document.getElementById("levelSelect");
  const submitQuiz = document.getElementById("submitQuiz");
  if (!levelSelect || !submitQuiz) {
    console.error("levelSelect or submitQuiz not found!");
    return;
  }
  levelSelect.addEventListener("change", function () {
    console.log("Level changed to: ", this.value);
    const selectedLevel = this.value;
    renderQuiz(selectedLevel);
    submitQuiz.onclick = () => checkAnswers(selectedLevel);
  });

  submitQuiz.onclick = () => checkAnswers(levelSelect.value);
});