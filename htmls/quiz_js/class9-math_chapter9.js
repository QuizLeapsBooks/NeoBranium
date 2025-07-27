// Quiz data for Areas of Parallelograms and Triangles (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is the area of a parallelogram with base 5 cm and height 4 cm?", options: ["20 cm²", "9 cm²", "15 cm²", "25 cm²"], answer: "20 cm²" },
    { question: "If two triangles are on the same base and between the same parallels, what is true about their areas?", options: ["They are unequal", "They are equal", "One is half of the other", "Depends on the height"], answer: "They are equal" },
    { question: "What is the formula for the area of a triangle?", options: ["base × height", "½ × base × height", "base + height", "2 × base × height"], answer: "½ × base × height" },
    { question: "If a parallelogram has an area of 24 cm² and base of 6 cm, what is its height?", options: ["4 cm", "6 cm", "8 cm", "12 cm"], answer: "4 cm" },
    { question: "What is the area of a triangle with base 8 cm and height 3 cm?", options: ["12 cm²", "24 cm²", "15 cm²", "18 cm²"], answer: "12 cm²" },
    { question: "In a parallelogram, if the base is doubled, what happens to the area?", options: ["Remains same", "Doubles", "Triples", "Halves"], answer: "Doubles" },
    { question: "If two parallelograms have the same base and equal areas, what is true about their heights?", options: ["They are equal", "They are unequal", "Depends on the shape", "One is double the other"], answer: "They are equal" },
    { question: "What is the area of a parallelogram with base 10 cm and height 5 cm?", options: ["50 cm²", "25 cm²", "15 cm²", "30 cm²"], answer: "50 cm²" },
    { question: "If a triangle and a parallelogram have the same base and height, what is the ratio of their areas?", options: ["1:1", "1:2", "2:1", "1:3"], answer: "1:2" },
    { question: "If the height of a triangle is 6 cm and area is 18 cm², what is the base?", options: ["6 cm", "3 cm", "9 cm", "12 cm"], answer: "6 cm" },
    { question: "What is the area of a parallelogram if its base is 7 cm and height is 8 cm?", options: ["56 cm²", "28 cm²", "15 cm²", "64 cm²"], answer: "56 cm²" },
    { question: "If two triangles have equal areas and same base, what is true about their heights?", options: ["They are equal", "They are unequal", "One is double the other", "Depends on the shape"], answer: "They are equal" },
    { question: "What is the area of a triangle with base 12 cm and height 5 cm?", options: ["30 cm²", "60 cm²", "24 cm²", "36 cm²"], answer: "30 cm²" },
    { question: "In a parallelogram, if the height is halved, what happens to the area?", options: ["Doubles", "Halves", "Remains same", "Triples"], answer: "Halves" },
    { question: "If a parallelogram and a triangle are on the same base and between the same parallels, what is the ratio of their areas?", options: ["1:1", "2:1", "1:2", "3:1"], answer: "2:1" },
    { question: "What is the area of a triangle with vertices at (0,0), (4,0), and (4,3)?", options: ["6 cm²", "12 cm²", "8 cm²", "10 cm²"], answer: "6 cm²" },
    { question: "If the area of a parallelogram is 40 cm² and height is 5 cm, what is the base?", options: ["8 cm", "10 cm", "5 cm", "20 cm"], answer: "8 cm" },
    { question: "What is the area of a parallelogram with base 9 cm and height 4 cm?", options: ["36 cm²", "18 cm²", "13 cm²", "45 cm²"], answer: "36 cm²" },
    { question: "If two triangles are on the same base and have equal areas, what must be true?", options: ["They have different heights", "They are between same parallels", "They have different bases", "They are congruent"], answer: "They are between same parallels" },
    { question: "What is the area of a triangle with base 10 cm and height 7 cm?", options: ["35 cm²", "70 cm²", "17.5 cm²", "50 cm²"], answer: "35 cm²" }
  ],
  level2: [
    { question: "If a parallelogram and a triangle are on the same base 10 cm and have areas 40 cm² and 20 cm² respectively, what is the height of the triangle?", options: ["4 cm", "8 cm", "2 cm", "6 cm"], answer: "4 cm" },
    { question: "In a parallelogram ABCD, if AB = 6 cm, height = 5 cm, what is the area?", options: ["30 cm²", "60 cm²", "15 cm²", "36 cm²"], answer: "30 cm²" },
    { question: "If two triangles on the same base have areas in the ratio 1:2, what is the ratio of their heights?", options: ["1:2", "2:1", "1:1", "3:1"], answer: "1:2" },
    { question: "A triangle has area 24 cm² and base 8 cm. What is its height?", options: ["6 cm", "3 cm", "12 cm", "8 cm"], answer: "6 cm" },
    { question: "If a parallelogram has area 48 cm² and base 12 cm, what is the height?", options: ["4 cm", "6 cm", "8 cm", "3 cm"], answer: "4 cm" },
    { question: "If a triangle and a parallelogram have the same base and the triangle’s area is 15 cm² with height 5 cm, what is the parallelogram’s area?", options: ["30 cm²", "15 cm²", "45 cm²", "60 cm²"], answer: "30 cm²" },
    { question: "In a triangle with vertices (0,0), (5,0), and (5,4), what is the area?", options: ["10 cm²", "20 cm²", "15 cm²", "12 cm²"], answer: "10 cm²" },
    { question: "If two parallelograms have equal areas and bases in the ratio 2:3, what is the ratio of their heights?", options: ["3:2", "2:3", "1:1", "4:9"], answer: "3:2" },
    { question: "If a parallelogram’s area is 72 cm² and height is 9 cm, what is the base?", options: ["8 cm", "9 cm", "12 cm", "16 cm"], answer: "8 cm" },
    { question: "If a triangle’s area is 18 cm² and height is 3 cm, what is the base?", options: ["12 cm", "6 cm", "9 cm", "15 cm"], answer: "12 cm" },
    { question: "If a parallelogram and a triangle share the same base and the parallelogram’s area is 50 cm², what is the triangle’s area if they are between the same parallels?", options: ["25 cm²", "50 cm²", "100 cm²", "12.5 cm²"], answer: "25 cm²" },
    { question: "In a parallelogram, if the base is 7 cm and area is 56 cm², what is the height?", options: ["8 cm", "7 cm", "14 cm", "4 cm"], answer: "8 cm" },
    { question: "If two triangles have areas 20 cm² and 30 cm² on the same base, what is the ratio of their heights?", options: ["2:3", "3:2", "1:1", "4:9"], answer: "2:3" },
    { question: "What is the area of a triangle with vertices at (1,1), (5,1), and (5,5)?", options: ["8 cm²", "10 cm²", "12 cm²", "16 cm²"], answer: "8 cm²" },
    { question: "If a parallelogram’s area is 60 cm² and base is 15 cm, what is the height?", options: ["4 cm", "5 cm", "6 cm", "8 cm"], answer: "4 cm" },
    { question: "If a triangle’s base is 10 cm and area is 40 cm², what is the height?", options: ["8 cm", "4 cm", "10 cm", "12 cm"], answer: "8 cm" },
    { question: "If two parallelograms are on the same base and between the same parallels, what is true about their areas?", options: ["They are equal", "They are unequal", "One is double the other", "Depends on height"], answer: "They are equal" },
    { question: "If a triangle’s area is 36 cm² and base is 9 cm, what is the height?", options: ["8 cm", "4 cm", "12 cm", "6 cm"], answer: "8 cm" },
    { question: "In a parallelogram with base 8 cm and height 6 cm, what is the area?", options: ["48 cm²", "24 cm²", "36 cm²", "64 cm²"], answer: "48 cm²" },
    { question: "If a triangle and a parallelogram have the same base and area 24 cm², what is the ratio of their heights?", options: ["1:2", "2:1", "1:1", "3:1"], answer: "2:1" }
  ],
  level3: [
    { question: "In a parallelogram ABCD, diagonals AC and BD intersect at O, and triangle AOB has area 12 cm². What is the area of parallelogram ABCD?", options: ["24 cm²", "48 cm²", "36 cm²", "60 cm²"], answer: "48 cm²" },
    { question: "Two triangles ABC and PBC share base BC = 10 cm and are between the same parallels. If area of triangle ABC is 25 cm² and height of triangle PBC is 4 cm, what is the height of triangle ABC?", options: ["5 cm", "6 cm", "4 cm", "8 cm"], answer: "5 cm" },
    { question: "In a quadrilateral ABCD, points P and Q are midpoints of AB and CD. If triangle PQD has area 10 cm² and triangle PBC has area 15 cm², what is the area of quadrilateral ABCD?", options: ["50 cm²", "40 cm²", "30 cm²", "25 cm²"], answer: "50 cm²" },
    { question: "In triangle ABC, D is the midpoint of BC, and E is on AB such that AE:EB = 1:2. If area of triangle ADC is 18 cm², what is the area of triangle BEC?", options: ["12 cm²", "9 cm²", "6 cm²", "15 cm²"], answer: "12 cm²" },
    { question: "A parallelogram ABCD and triangle PQR are on the same base AB = 8 cm and between the same parallels. If triangle PQR’s area is 16 cm², what is the area of parallelogram ABCD?", options: ["32 cm²", "16 cm²", "24 cm²", "48 cm²"], answer: "32 cm²" },
    { question: "In a coordinate plane, triangle ABC has vertices A(0,0), B(6,0), and C(3,4). Point D is the midpoint of BC. What is the area of triangle ABD?", options: ["6 cm²", "8 cm²", "10 cm²", "12 cm²"], answer: "8 cm²" },
    { question: "In parallelogram ABCD, point E is the midpoint of AD. If triangle ABE has area 10 cm², what is the area of parallelogram ABCD?", options: ["40 cm²", "20 cm²", "30 cm²", "50 cm²"], answer: "40 cm²" },
    { question: "Two triangles ABC and DBC share base BC. If area of triangle ABC is 30 cm², area of triangle DBC is 20 cm², and BC = 10 cm, what is the ratio of their heights?", options: ["3:2", "2:3", "1:1", "4:3"], answer: "3:2" },
    { question: "In a parallelogram PQRS, diagonals PR and QS intersect at O. If triangle POQ has area 8 cm², what is the area of parallelogram PQRS?", options: ["32 cm²", "16 cm²", "24 cm²", "40 cm²"], answer: "32 cm²" },
    { question: "In triangle ABC, D is on AB such that AD:DB = 2:1, and E is the midpoint of BC. If area of triangle ADE is 12 cm², what is the area of triangle ABC?", options: ["36 cm²", "24 cm²", "18 cm²", "48 cm²"], answer: "36 cm²" },
    { question: "A quadrilateral ABCD has points E and F as midpoints of AB and CD. If triangle EFC has area 15 cm² and triangle ABE has area 10 cm², what is the area of quadrilateral ABCD?", options: ["50 cm²", "40 cm²", "30 cm²", "25 cm²"], answer: "50 cm²" },
    { question: "In triangle ABC, D is the midpoint of BC, and E is on AC such that AE:EC = 1:1. If area of triangle ABD is 20 cm², what is the area of triangle BCE?", options: ["20 cm²", "10 cm²", "15 cm²", "25 cm²"], answer: "20 cm²" },
    { question: "In a coordinate plane, parallelogram ABCD has vertices A(0,0), B(4,0), C(5,3), and D(1,3). What is the area of triangle ABC?", options: ["6 cm²", "12 cm²", "9 cm²", "15 cm²"], answer: "6 cm²" },
    { question: "In parallelogram ABCD, point P is on AB such that AP:PB = 1:2, and Q is the midpoint of CD. If triangle APQ has area 9 cm², what is the area of parallelogram ABCD?", options: ["54 cm²", "36 cm²", "27 cm²", "18 cm²"], answer: "54 cm²" },
    { question: "In triangle ABC, points D and E are midpoints of AB and AC. If triangle ADE has area 7 cm², what is the area of triangle ABC?", options: ["28 cm²", "14 cm²", "21 cm²", "35 cm²"], answer: "28 cm²" },
    { question: "In a quadrilateral PQRS, PQ || SR, and points X and Y are midpoints of PQ and SR. If triangle XQY has area 12 cm², what is the area of quadrilateral PQRS?", options: ["48 cm²", "24 cm²", "36 cm²", "60 cm²"], answer: "48 cm²" },
    { question: "In triangle ABC, D is on BC such that BD:DC = 3:2, and area of triangle ABD is 18 cm². What is the area of triangle ABC?", options: ["30 cm²", "24 cm²", "36 cm²", "45 cm²"], answer: "30 cm²" },
    { question: "In parallelogram ABCD, triangle ABC has area 15 cm². If E is the midpoint of CD, what is the area of triangle ABE?", options: ["15 cm²", "7.5 cm²", "30 cm²", "10 cm²"], answer: "15 cm²" },
    { question: "In a coordinate plane, triangle ABC has vertices A(2,2), B(6,2), and C(4,6). Point D is the midpoint of BC. What is the area of triangle ADC?", options: ["4 cm²", "8 cm²", "6 cm²", "10 cm²"], answer: "4 cm²" },
    { question: "In triangle ABC, points P and Q are on AB and AC such that AP:PB = AQ:QC = 1:3. If triangle APQ has area 8 cm², what is the area of triangle ABC?", options: ["128 cm²", "64 cm²", "32 cm²", "16 cm²"], answer: "128 cm²" }
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