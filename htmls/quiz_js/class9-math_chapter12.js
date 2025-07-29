// Quiz data for Heron’s Formula (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is the semi-perimeter of a triangle with sides 3 cm, 4 cm, and 5 cm?", options: ["6 cm", "7 cm", "8 cm", "12 cm"], answer: "6 cm" },
    { question: "Using Heron’s Formula, what is the area of a triangle with sides 3 cm, 4 cm, and 5 cm?", options: ["6 cm²", "12 cm²", "10 cm²", "8 cm²"], answer: "6 cm²" },
    { question: "What is the formula for the area of a triangle using Heron’s Formula, where s is the semi-perimeter and a, b, c are sides?", options: ["√(s(s-a)(s-b)(s-c))", "s(s-a)(s-b)(s-c)", "½ × base × height", "s(a+b+c)"], answer: "√(s(s-a)(s-b)(s-c))" },
    { question: "If the sides of a triangle are 5 cm, 5 cm, and 6 cm, what is the semi-perimeter?", options: ["8 cm", "9 cm", "10 cm", "16 cm"], answer: "8 cm" },
    { question: "What is the area of an equilateral triangle with side 4 cm using Heron’s Formula?", options: ["4√3 cm²", "8 cm²", "6 cm²", "4 cm²"], answer: "4√3 cm²" },
    { question: "If the semi-perimeter of a triangle is 12 cm and sides are 6 cm, 8 cm, and 10 cm, what is the area?", options: ["24 cm²", "48 cm²", "36 cm²", "12 cm²"], answer: "24 cm²" },
    { question: "What is the area of a triangle with sides 7 cm, 8 cm, and 9 cm?", options: ["28 cm²", "30 cm²", "24 cm²", "36 cm²"], answer: "28 cm²" },
    { question: "For a triangle with sides 6 cm, 8 cm, and 10 cm, what type of triangle is it?", options: ["Equilateral", "Isosceles", "Scalene", "Right-angled"], answer: "Right-angled" },
    { question: "What is the semi-perimeter of a triangle with sides 9 cm, 12 cm, and 15 cm?", options: ["18 cm", "20 cm", "24 cm", "36 cm"], answer: "18 cm" },
    { question: "What is the area of a triangle with sides 9 cm, 12 cm, and 15 cm?", options: ["54 cm²", "60 cm²", "48 cm²", "72 cm²"], answer: "54 cm²" },
    { question: "If the area of an equilateral triangle is 16√3 cm², what is the side length?", options: ["8 cm", "6 cm", "4 cm", "10 cm"], answer: "8 cm" },
    { question: "What is the area of a triangle with sides 5 cm, 12 cm, and 13 cm?", options: ["30 cm²", "60 cm²", "25 cm²", "50 cm²"], answer: "30 cm²" },
    { question: "What is the semi-perimeter of an equilateral triangle with side 6 cm?", options: ["9 cm", "12 cm", "18 cm", "6 cm"], answer: "9 cm" },
    { question: "What is the area of an equilateral triangle with side 2 cm?", options: ["√3 cm²", "2√3 cm²", "4 cm²", "2 cm²"], answer: "√3 cm²" },
    { question: "If the sides of a triangle are 10 cm, 10 cm, and 12 cm, what is the semi-perimeter?", options: ["16 cm", "18 cm", "20 cm", "32 cm"], answer: "16 cm" },
    { question: "What is the area of a triangle with sides 10 cm, 10 cm, and 12 cm?", options: ["48 cm²", "60 cm²", "96 cm²", "30 cm²"], answer: "48 cm²" },
    { question: "What is the area of a triangle with sides 8 cm, 15 cm, and 17 cm?", options: ["60 cm²", "120 cm²", "90 cm²", "80 cm²"], answer: "60 cm²" },
    { question: "If the semi-perimeter of a triangle is 15 cm and sides are 8 cm, 9 cm, and 13 cm, what is the area?", options: ["36 cm²", "48 cm²", "60 cm²", "72 cm²"], answer: "36 cm²" },
    { question: "What is the area of an equilateral triangle with side 10 cm?", options: ["25√3 cm²", "50 cm²", "100 cm²", "10√3 cm²"], answer: "25√3 cm²" },
    { question: "If a triangle has sides 7 cm, 24 cm, and 25 cm, what type of triangle is it?", options: ["Equilateral", "Isosceles", "Scalene", "Right-angled"], answer: "Right-angled" }
  ],
  level2: [
    { question: "What is the area of a triangle with sides 13 cm, 14 cm, and 15 cm?", options: ["84 cm²", "90 cm²", "78 cm²", "96 cm²"], answer: "84 cm²" },
    { question: "If the semi-perimeter of a triangle is 18 cm and sides are 10 cm, 12 cm, and 14 cm, what is the area?", options: ["48 cm²", "60 cm²", "72 cm²", "96 cm²"], answer: "48 cm²" },
    { question: "What is the area of an isosceles triangle with equal sides 5 cm and base 6 cm?", options: ["12 cm²", "10 cm²", "15 cm²", "18 cm²"], answer: "12 cm²" },
    { question: "If the area of an equilateral triangle is 9√3 cm², what is the side length?", options: ["6 cm", "9 cm", "3 cm", "12 cm"], answer: "6 cm" },
    { question: "What is the semi-perimeter of a triangle with sides 7 cm, 8 cm, and 11 cm?", options: ["13 cm", "14 cm", "15 cm", "26 cm"], answer: "13 cm" },
    { question: "What is the area of a triangle with sides 7 cm, 8 cm, and 11 cm?", options: ["28 cm²", "30 cm²", "32 cm²", "26 cm²"], answer: "28 cm²" },
    { question: "If a triangle has sides 9 cm, 12 cm, and 15 cm, and is divided into two triangles by an altitude, what is the altitude to the base 15 cm?", options: ["7.2 cm", "6 cm", "8 cm", "9 cm"], answer: "7.2 cm" },
    { question: "What is the area of a triangle with sides 6 cm, 8 cm, and 10 cm, if it is right-angled?", options: ["24 cm²", "30 cm²", "48 cm²", "60 cm²"], answer: "24 cm²" },
    { question: "If the semi-perimeter of a triangle is 21 cm and sides are 12 cm, 14 cm, and 16 cm, what is the area?", options: ["84 cm²", "96 cm²", "72 cm²", "108 cm²"], answer: "84 cm²" },
    { question: "What is the area of an equilateral triangle with side 8 cm?", options: ["16√3 cm²", "32 cm²", "64 cm²", "8√3 cm²"], answer: "16√3 cm²" },
    { question: "If a triangle has sides 5 cm, 5 cm, and 6 cm, what is the area?", options: ["12 cm²", "15 cm²", "10 cm²", "18 cm²"], answer: "12 cm²" },
    { question: "What is the semi-perimeter of a triangle with sides 11 cm, 12 cm, and 13 cm?", options: ["18 cm", "19 cm", "20 cm", "36 cm"], answer: "18 cm" },
    { question: "What is the area of a triangle with sides 11 cm, 12 cm, and 13 cm?", options: ["60 cm²", "66 cm²", "72 cm²", "48 cm²"], answer: "60 cm²" },
    { question: "If the area of a triangle is 30 cm² and sides are 5 cm, 12 cm, and 13 cm, what is the altitude to the base 13 cm?", options: ["4.6 cm", "5 cm", "6 cm", "4 cm"], answer: "4.6 cm" },
    { question: "What is the area of a triangle with sides 10 cm, 10 cm, and 12 cm?", options: ["48 cm²", "60 cm²", "36 cm²", "24 cm²"], answer: "48 cm²" },
    { question: "If the semi-perimeter of a triangle is 15 cm and sides are 8 cm, 9 cm, and 13 cm, what is the area?", options: ["36 cm²", "48 cm²", "60 cm²", "72 cm²"], answer: "36 cm²" },
    { question: "What is the area of an equilateral triangle with side 12 cm?", options: ["36√3 cm²", "72 cm²", "48 cm²", "24√3 cm²"], answer: "36√3 cm²" },
    { question: "If a triangle has sides 7 cm, 24 cm, and 25 cm, what is the area?", options: ["84 cm²", "168 cm²", "96 cm²", "120 cm²"], answer: "84 cm²" },
    { question: "What is the semi-perimeter of a triangle with sides 6 cm, 7 cm, and 8 cm?", options: ["10.5 cm", "11 cm", "12 cm", "21 cm"], answer: "10.5 cm" },
    { question: "What is the area of a triangle with sides 6 cm, 7 cm, and 8 cm?", options: ["20.5 cm²", "21 cm²", "22 cm²", "23.66 cm²"], answer: "20.5 cm²" }
  ],
  level3: [
    { question: "A triangle has vertices at A(0,0), B(4,0), and C(2,4). Using Heron’s Formula, what is the area of triangle ABC?", options: ["8 cm²", "12 cm²", "16 cm²", "10 cm²"], answer: "8 cm²" },
    { question: "A triangle has sides 5 cm, 7 cm, and 8 cm. If an altitude from vertex A to base BC divides BC into segments of 3 cm and 5 cm, what is the length of the altitude?", options: ["4.8 cm", "5.2 cm", "6 cm", "7 cm"], answer: "4.8 cm" },
    { question: "In a triangle with sides 9 cm, 12 cm, and 15 cm, the angle bisector from vertex A divides side BC into segments in the ratio 3:4. What is the area of triangle ABD?", options: ["27 cm²", "21.6 cm²", "24 cm²", "30 cm²"], answer: "21.6 cm²" },
    { question: "A triangle has sides 6 cm, 8 cm, and 10 cm. If a line parallel to BC divides AB and AC in the ratio 1:2, what is the area of the smaller triangle formed?", options: ["2.67 cm²", "3 cm²", "4 cm²", "5.33 cm²"], answer: "2.67 cm²" },
    { question: "A quadrilateral ABCD is divided into triangles ABC and ADC by diagonal AC. If sides of triangle ABC are 5 cm, 6 cm, 7 cm (area 16.25 cm²) and triangle ADC has sides 6 cm, 7 cm, 8 cm (area 20.5 cm²), what is the area of quadrilateral ABCD?", options: ["36.75 cm²", "33 cm²", "40 cm²", "30 cm²"], answer: "36.75 cm²" },
    { question: "A triangle has sides 13 cm, 14 cm, and 15 cm. If the altitude to the base 15 cm is 11.2 cm, what is the length of the median to the base?", options: ["7.5 cm", "8 cm", "9 cm", "10 cm"], answer: "7.5 cm" },
    { question: "In a triangle with sides 7 cm, 8 cm, and 9 cm, the angle bisector from vertex B divides AC into segments in the ratio 7:9. What is the area of triangle ABC?", options: ["28 cm²", "30 cm²", "32 cm²", "24 cm²"], answer: "28 cm²" },
    { question: "A triangle has vertices at A(1,1), B(5,1), and C(3,5). What is the area using Heron’s Formula?", options: ["8 cm²", "10 cm²", "12 cm²", "16 cm²"], answer: "8 cm²" },
    { question: "In a triangle with sides 10 cm, 10 cm, and 12 cm, if an altitude from vertex A to base BC divides BC into segments of 6 cm each, what is the length of the altitude?", options: ["8 cm", "9 cm", "10 cm", "12 cm"], answer: "8 cm" },
    { question: "A triangle has sides 5 cm, 5 cm, and 6 cm. If a cevian divides side BC into segments in the ratio 1:2 and the area of the smaller triangle is 4 cm², what is the area of the larger triangle?", options: ["9 cm²", "12 cm²", "15 cm²", "18 cm²"], answer: "9 cm²" },
    { question: "In a quadrilateral PQRS, diagonal PR divides it into triangles PQR (sides 6 cm, 7 cm, 8 cm, area 20.5 cm²) and PSR (sides 7 cm, 8 cm, 9 cm, area 28 cm²). What is the area of quadrilateral PQRS?", options: ["48.5 cm²", "44 cm²", "50 cm²", "40 cm²"], answer: "48.5 cm²" },
    { question: "A triangle has sides 8 cm, 15 cm, and 17 cm. If the altitude to the base 17 cm is 7.06 cm, what is the length of the median to the base?", options: ["8.5 cm", "9 cm", "10 cm", "7.5 cm"], answer: "8.5 cm" },
    { question: "In a triangle with sides 9 cm, 12 cm, and 15 cm, a line parallel to BC divides AB and AC in the ratio 2:3. What is the area of the smaller triangle formed?", options: ["9.6 cm²", "12 cm²", "15 cm²", "8 cm²"], answer: "9.6 cm²" },
    { question: "A triangle has vertices at A(0,0), B(6,0), and C(3,4). If D is the midpoint of BC, what is the area of triangle ABD using Heron’s Formula?", options: ["6 cm²", "8 cm²", "10 cm²", "12 cm²"], answer: "6 cm²" },
    { question: "In a triangle with sides 7 cm, 24 cm, and 25 cm, if the angle bisector from vertex A divides BC into segments in the ratio 7:24, what is the area of triangle ABD?", options: ["24 cm²", "28 cm²", "30 cm²", "36 cm²"], answer: "24 cm²" },
    { question: "A triangle has sides 6 cm, 8 cm, and 10 cm. If a cevian from vertex A divides BC into segments in the ratio 3:2, what is the area of the smaller triangle?", options: ["7.2 cm²", "9.6 cm²", "12 cm²", "14.4 cm²"], answer: "7.2 cm²" },
    { question: "In a triangle with sides 5 cm, 12 cm, and 13 cm, the altitude to the base 13 cm is 4.8 cm. What is the length of the median to the base?", options: ["6.5 cm", "7 cm", "8 cm", "5.5 cm"], answer: "6.5 cm" },
    { question: "A triangle has sides 10 cm, 10 cm, and 16 cm. If a line parallel to BC divides AB and AC in the ratio 1:3, what is the area of the smaller triangle?", options: ["6 cm²", "8 cm²", "10 cm²", "12 cm²"], answer: "6 cm²" },
    { question: "In a quadrilateral ABCD, diagonal AC divides it into triangles ABC (sides 8 cm, 15 cm, 17 cm, area 60 cm²) and ADC (sides 9 cm, 12 cm, 15 cm, area 54 cm²). What is the area of quadrilateral ABCD?", options: ["114 cm²", "108 cm²", "120 cm²", "100 cm²"], answer: "114 cm²" },
    { question: "A triangle has vertices at A(2,2), B(6,2), and C(4,6). If D is the foot of the altitude from A to BC, what is the area of triangle ADC using Heron’s Formula?", options: ["4 cm²", "6 cm²", "8 cm²", "10 cm²"], answer: "4 cm²" }
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