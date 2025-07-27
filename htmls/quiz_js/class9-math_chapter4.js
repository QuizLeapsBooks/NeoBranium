// Quiz data for Linear Equations in Two Variables (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is a linear equation in two variables?", options: ["An equation of degree 2", "An equation with two variables and degree 1", "An equation with one variable", "An equation with three variables"], answer: "An equation with two variables and degree 1" },
    { question: "Which of the following is a linear equation in two variables?", options: ["x² + y = 5", "2x + 3y = 7", "x/y = 2", "xy = 10"], answer: "2x + 3y = 7" },
    { question: "What is the degree of a linear equation?", options: ["1", "2", "3", "0"], answer: "1" },
    { question: "The solution of a linear equation in two variables is represented by:", options: ["A single number", "An ordered pair (x, y)", "A line", "A point"], answer: "An ordered pair (x, y)" },
    { question: "Which of these points satisfies the equation 2x + y = 5?", options: ["(1, 3)", "(2, 2)", "(0, 0)", "(3, 1)"], answer: "(1, 3)" },
    { question: "What is the value of y when x = 2 in the equation x + y = 4?", options: ["2", "3", "4", "1"], answer: "2" },
    { question: "What is the value of x when y = 3 in the equation 3x + y = 9?", options: ["2", "3", "4", "1"], answer: "2" },
    { question: "Which equation represents a straight line?", options: ["x² + y = 4", "2x + 3y = 6", "xy = 8", "y = x²"], answer: "2x + 3y = 6" },
    { question: "How many solutions does a linear equation in two variables have?", options: ["One", "Two", "Infinitely many", "None"], answer: "Infinitely many" },
    { question: "If x = 0 in the equation 4x + y = 8, what is y?", options: ["2", "4", "8", "0"], answer: "8" },
    { question: "What is the slope of the line 2x + y = 5?", options: ["-2", "2", "-1", "1"], answer: "-2" },
    { question: "Which point lies on the line x + y = 7?", options: ["(2, 5)", "(3, 3)", "(1, 5)", "(4, 2)"], answer: "(2, 5)" },
    { question: "What is the value of y when x = 1 in the equation 3x - y = 2?", options: ["1", "-1", "2", "3"], answer: "1" },
    { question: "Which of these is not a linear equation?", options: ["x + y = 3", "2x - 5y = 10", "x² + y = 4", "3x + 2y = 6"], answer: "x² + y = 4" },
    { question: "What is the value of x when y = 0 in the equation 2x + 3y = 6?", options: ["2", "3", "4", "1"], answer: "3" },
    { question: "Which equation has the solution (0, 4)?", options: ["x + y = 4", "2x + y = 4", "x - y = 4", "y - x = 4"], answer: "x + y = 4" },
    { question: "What is the general form of a linear equation in two variables?", options: ["ax + by + c = 0", "ax² + by = c", "ax + by = c²", "a/x + b/y = c"], answer: "ax + by + c = 0" },
    { question: "What is the value of x when y = 2 in the equation x - 2y = 4?", options: ["8", "6", "4", "2"], answer: "8" },
    { question: "Which point satisfies the equation 5x + y = 10?", options: ["(1, 5)", "(2, 0)", "(0, 5)", "(3, 5)"], answer: "(1, 5)" },
    { question: "What is the value of y when x = 3 in the equation 2x - y = 5?", options: ["1", "-1", "2", "3"], answer: "1" }
  ],
  level2: [
    { question: "What is the solution of the system of equations x + y = 5 and x - y = 1?", options: ["(3, 2)", "(2, 3)", "(1, 4)", "(4, 1)"], answer: "(3, 2)" },
    { question: "Which of the following equations is equivalent to 3x + 2y = 12?", options: ["6x + 4y = 24", "3x - 2y = 12", "x + 2y = 6", "2x + 3y = 12"], answer: "6x + 4y = 24" },
    { question: "What is the value of k if (2, 3) is a solution of the equation kx + y = 7?", options: ["2", "3", "1", "4"], answer: "2" },
    { question: "The lines 2x + y = 4 and 4x + 2y = 8 are:", options: ["Parallel", "Coincident", "Intersecting", "Perpendicular"], answer: "Coincident" },
    { question: "What is the x-intercept of the line 3x + 4y = 12?", options: ["4", "3", "2", "6"], answer: "4" },
    { question: "What is the y-intercept of the line 2x + 5y = 10?", options: ["2", "5", "10", "1"], answer: "2" },
    { question: "Solve the system of equations 2x + y = 7 and x + y = 4.", options: ["(3, 1)", "(1, 3)", "(2, 3)", "(3, 2)"], answer: "(3, 1)" },
    { question: "What is the value of x in the solution of 3x - y = 2 and x + y = 6?", options: ["2", "3", "4", "1"], answer: "2" },
    { question: "What is the slope of the line 3x - 4y = 12?", options: ["3/4", "-3/4", "4/3", "-4/3"], answer: "3/4" },
    { question: "Which pair of equations has no solution?", options: ["x + y = 2, x + y = 3", "x + y = 2, 2x + 2y = 4", "x + y = 2, x - y = 1", "2x + y = 4, x + y = 3"], answer: "x + y = 2, x + y = 3" },
    { question: "What is the value of y in the solution of x + 2y = 8 and 2x + y = 7?", options: ["2", "3", "1", "4"], answer: "2" },
    { question: "The equation 2x + 3y = 6 has the solution:", options: ["(0, 2)", "(2, 0)", "(3, 0)", "(0, 3)"], answer: "(0, 2)" },
    { question: "What is the value of k if the lines kx + 2y = 5 and 3x + y = 1 are parallel?", options: ["6", "3", "2", "1"], answer: "6" },
    { question: "What is the x-intercept of the line x + 2y = 8?", options: ["8", "4", "2", "6"], answer: "8" },
    { question: "What is the y-intercept of the line 4x + 3y = 12?", options: ["4", "3", "2", "6"], answer: "4" },
    { question: "Solve the system of equations 3x + 2y = 11 and x + y = 4.", options: ["(3, 1)", "(1, 3)", "(2, 3)", "(3, 2)"], answer: "(3, 1)" },
    { question: "What is the value of x in the solution of 2x + 3y = 12 and x - y = 1?", options: ["3", "2", "4", "1"], answer: "3" },
    { question: "What is the slope of the line x - y = 5?", options: ["1", "-1", "2", "-2"], answer: "1" },
    { question: "Which point satisfies both equations x + y = 5 and 2x - y = 4?", options: ["(3, 2)", "(2, 3)", "(1, 4)", "(4, 1)"], answer: "(3, 2)" },
    { question: "What is the value of y when x = 4 in the equation 2x + y = 10?", options: ["2", "3", "1", "4"], answer: "2" }
  ],
  level3: [
    { question: "The cost of 2 pens and 3 pencils is ₹13, and the cost of 4 pens and 2 pencils is ₹16. What is the cost of one pen?", options: ["₹4", "₹3", "₹2", "₹5"], answer: "₹4" },
    { question: "Solve the system of equations 2x + 3y = 11 and 3x + 2y = 9.", options: ["(3, 1)", "(1, 3)", "(2, 3)", "(3, 2)"], answer: "(3, 1)" },
    { question: "What is the value of k if the lines 2x + ky = 10 and 3x + 2y = 5 are coincident?", options: ["3", "2", "4", "1"], answer: "3" },
    { question: "The sum of two numbers is 15 and their difference is 3. What is the larger number?", options: ["9", "8", "7", "6"], answer: "9" },
    { question: "What is the solution of the system 5x + 2y = 16 and 3x - y = 5?", options: ["(2, 3)", "(3, 2)", "(2, 1)", "(1, 2)"], answer: "(2, 3)" },
    { question: "The lines 2x + 3y = 6 and 4x + 6y = k are parallel. What is k?", options: ["12", "6", "8", "10"], answer: "12" },
    { question: "The cost of 3 books and 2 pens is ₹800, and the cost of 2 books and 3 pens is ₹700. What is the cost of one book?", options: ["₹200", "₹150", "₹100", "₹250"], answer: "₹200" },
    { question: "Solve the system of equations x + 2y = 10 and 3x + 4y = 26.", options: ["(2, 4)", "(4, 3)", "(3, 4)", "(4, 2)"], answer: "(2, 4)" },
    { question: "What is the value of k if (1, 2) is a solution of kx - y = 4?", options: ["6", "5", "4", "3"], answer: "6" },
    { question: "The lines 3x + y = 10 and 6x + 2y = k have infinitely many solutions. What is k?", options: ["20", "10", "15", "25"], answer: "20" },
    { question: "The sum of two numbers is 20 and their difference is 4. What is the smaller number?", options: ["8", "9", "10", "12"], answer: "8" },
    { question: "What is the solution of the system 4x + 3y = 17 and 2x + y = 7?", options: ["(2, 3)", "(3, 2)", "(1, 3)", "(2, 1)"], answer: "(2, 3)" },
    { question: "The cost of 5 apples and 3 oranges is ₹35, and the cost of 2 apples and 4 oranges is ₹28. What is the cost of one apple?", options: ["₹5", "₹4", "₹3", "₹6"], answer: "₹5" },
    { question: "What is the value of k if the lines 2x + 3y = 7 and kx + 9y = 21 are parallel?", options: ["6", "3", "2", "4"], answer: "6" },
    { question: "Solve the system of equations 3x - 2y = 1 and x + y = 3.", options: ["(1, 2)", "(2, 1)", "(3, 1)", "(1, 3)"], answer: "(1, 2)" },
    { question: "The lines x + 2y = 5 and 2x + 4y = k have no solution. What is k?", options: ["10", "5", "8", "12"], answer: "10" },
    { question: "The cost of 4 chairs and 3 tables is ₹2100, and the cost of 3 chairs and 4 tables is ₹2300. What is the cost of one chair?", options: ["₹200", "₹300", "₹400", "₹500"], answer: "₹300" },
    { question: "What is the solution of the system 2x + 5y = 19 and x + 2y = 8?", options: ["(3, 2)", "(2, 3)", "(1, 3)", "(3, 1)"], answer: "(1, 3)" },
    { question: "What is the value of k if (2, 1) is a solution of 3x + ky = 7?", options: ["1", "2", "3", "4"], answer: "1" },
    { question: "The lines 2x + y = 8 and 4x + 2y = k are coincident. What is k?", options: ["16", "8", "12", "10"], answer: "16" }
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
});