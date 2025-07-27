// Quiz data for Quadrilaterals (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is the sum of the interior angles of a quadrilateral?", options: ["180°", "360°", "90°", "270°"], answer: "360°" },
    { question: "What is a quadrilateral with all sides equal?", options: ["Rectangle", "Rhombus", "Trapezium", "Parallelogram"], answer: "Rhombus" },
    { question: "Which quadrilateral has only one pair of parallel sides?", options: ["Parallelogram", "Trapezium", "Rhombus", "Square"], answer: "Trapezium" },
    { question: "What is a quadrilateral with opposite sides equal and parallel?", options: ["Kite", "Rectangle", "Trapezium", "Rhombus"], answer: "Rectangle" },
    { question: "What is the sum of the exterior angles of any quadrilateral?", options: ["180°", "360°", "90°", "270°"], answer: "360°" },
    { question: "In a parallelogram, what is true about opposite angles?", options: ["They are equal", "They are complementary", "They are supplementary", "They are unequal"], answer: "They are equal" },
    { question: "What is a quadrilateral with all sides and angles equal?", options: ["Rectangle", "Square", "Rhombus", "Parallelogram"], answer: "Square" },
    { question: "In a quadrilateral, if one angle is 90°, what is the sum of the other three angles?", options: ["270°", "180°", "360°", "90°"], answer: "270°" },
    { question: "Which quadrilateral has diagonals that bisect each other at 90°?", options: ["Rectangle", "Rhombus", "Parallelogram", "Trapezium"], answer: "Rhombus" },
    { question: "In a parallelogram, if one angle is 70°, what is the opposite angle?", options: ["70°", "110°", "90°", "180°"], answer: "70°" },
    { question: "What is a quadrilateral with two pairs of adjacent sides equal?", options: ["Kite", "Rectangle", "Parallelogram", "Trapezium"], answer: "Kite" },
    { question: "In a rectangle, what is the measure of each angle?", options: ["60°", "90°", "120°", "180°"], answer: "90°" },
    { question: "Which quadrilateral has diagonals that are equal in length?", options: ["Rhombus", "Rectangle", "Parallelogram", "Kite"], answer: "Rectangle" },
    { question: "In a parallelogram, if one angle is 80°, what is the adjacent angle?", options: ["80°", "100°", "90°", "110°"], answer: "100°" },
    { question: "What is the name of a quadrilateral with no parallel sides?", options: ["Parallelogram", "Trapezium", "Kite", "None of these"], answer: "None of these" },
    { question: "In a square, what is true about the diagonals?", options: ["They are unequal", "They bisect at 90°", "They are parallel", "They do not bisect"], answer: "They bisect at 90°" },
    { question: "If the interior angles of a quadrilateral are 80°, 100°, and 120°, what is the fourth angle?", options: ["60°", "70°", "80°", "90°"], answer: "60°" },
    { question: "Which quadrilateral has all sides equal but not necessarily all angles equal?", options: ["Square", "Rectangle", "Rhombus", "Parallelogram"], answer: "Rhombus" },
    { question: "In a trapezium, what is true about the non-parallel sides?", options: ["They are equal", "They are unequal", "They are perpendicular", "They are parallel"], answer: "They are unequal" },
    { question: "In a parallelogram, what is true about consecutive angles?", options: ["They are equal", "They are supplementary", "They are complementary", "They are unequal"], answer: "They are supplementary" }
  ],
  level2: [
    { question: "In a parallelogram ABCD, if ∠A = 70°, what is ∠C?", options: ["70°", "110°", "90°", "100°"], answer: "70°" },
    { question: "In a rhombus, if one angle is 60°, what is the opposite angle?", options: ["60°", "120°", "90°", "180°"], answer: "60°" },
    { question: "In a quadrilateral, if three angles are 80°, 90°, and 110°, what is the fourth angle?", options: ["80°", "90°", "100°", "60°"], answer: "80°" },
    { question: "In a rectangle, if one diagonal is 10 cm, what is the length of the other diagonal?", options: ["5 cm", "10 cm", "15 cm", "20 cm"], answer: "10 cm" },
    { question: "In a parallelogram, if one side is 6 cm and the opposite side is 6 cm, what type is it?", options: ["Rectangle", "Rhombus", "Parallelogram", "All of these"], answer: "All of these" },
    { question: "In a square, if one angle is 90°, what is the sum of the other three angles?", options: ["180°", "270°", "360°", "90°"], answer: "270°" },
    { question: "In a kite, how many pairs of adjacent sides are equal?", options: ["1", "2", "3", "4"], answer: "2" },
    { question: "In a trapezium, if the parallel sides are 5 cm and 7 cm, what can be said about the non-parallel sides?", options: ["They are equal", "They are unequal", "They are parallel", "They are perpendicular"], answer: "They are unequal" },
    { question: "In a parallelogram, if the diagonals bisect each other, what is true about the halves?", options: ["They are unequal", "They are equal", "They are perpendicular", "They are parallel"], answer: "They are equal" },
    { question: "In a rhombus, if one diagonal bisects an angle, what is the angle measure?", options: ["90°", "60°", "120°", "It depends"], answer: "It depends" },
    { question: "In a quadrilateral ABCD, if AB || CD and ∠A = 100°, what is ∠C?", options: ["80°", "100°", "90°", "110°"], answer: "80°" },
    { question: "In a rectangle, what is true about the diagonals?", options: ["They are unequal", "They bisect at 90°", "They are equal", "They do not bisect"], answer: "They are equal" },
    { question: "In a parallelogram, if one angle is 110°, what is the adjacent angle?", options: ["70°", "110°", "90°", "180°"], answer: "70°" },
    { question: "In a kite, what is true about the diagonals?", options: ["They are equal", "They bisect at 90°", "They are parallel", "They do not bisect"], answer: "They bisect at 90°" },
    { question: "In a quadrilateral, if two angles are 120° and 60°, and the other two are equal, what is each of the equal angles?", options: ["90°", "100°", "110°", "120°"], answer: "90°" },
    { question: "In a rhombus, if one angle is 80°, what is the adjacent angle?", options: ["80°", "100°", "90°", "110°"], answer: "100°" },
    { question: "In a parallelogram, if one side is parallel to the other, what is true about opposite sides?", options: ["They are unequal", "They are equal", "They are perpendicular", "They are not parallel"], answer: "They are equal" },
    { question: "In a square, what is the measure of each exterior angle?", options: ["90°", "60°", "120°", "180°"], answer: "90°" },
    { question: "In a quadrilateral, if the sum of two angles is 150° and the other two are equal, what is each of the equal angles?", options: ["105°", "90°", "100°", "110°"], answer: "105°" },
    { question: "In a trapezium, if one angle is 70° and the parallel sides are equal, what type is it?", options: ["Isosceles trapezium", "Rectangle", "Parallelogram", "Kite"], answer: "Isosceles trapezium" }
  ],
  level3: [
    { question: "In a parallelogram ABCD, if ∠A = 65° and ∠B = 115°, what is ∠D?", options: ["65°", "115°", "90°", "100°"], answer: "65°" },
    { question: "In a quadrilateral, if the angles are in the ratio 1:2:3:4, what is the largest angle?", options: ["144°", "108°", "72°", "36°"], answer: "144°" },
    { question: "In a rhombus, if one diagonal bisects an angle of 60°, what is the measure of the opposite angle?", options: ["60°", "120°", "90°", "180°"], answer: "60°" },
    { question: "In a quadrilateral ABCD, if AB || CD and ∠A = 110°, what is ∠C?", options: ["70°", "110°", "90°", "100°"], answer: "70°" },
    { question: "In a parallelogram, if the diagonals are equal, what type is it?", options: ["Rhombus", "Rectangle", "Square", "Kite"], answer: "Rectangle" },
    { question: "In a kite, if one angle between unequal sides is 120°, what is the opposite angle?", options: ["60°", "120°", "90°", "180°"], answer: "120°" },
    { question: "In a quadrilateral, if two opposite angles are 100° each, and the other two are equal, what is each of the equal angles?", options: ["80°", "90°", "100°", "110°"], answer: "80°" },
    { question: "In a trapezium, if the parallel sides are equal and one angle is 70°, what is the adjacent angle on the same parallel side?", options: ["70°", "110°", "90°", "100°"], answer: "110°" },
    { question: "In a parallelogram ABCD, if AB = 5 cm and BC = 5 cm, what can be said about the quadrilateral?", options: ["It is a rectangle", "It is a rhombus", "It is a square", "It is a parallelogram"], answer: "It is a rhombus" },
    { question: "In a quadrilateral, if the sum of three angles is 240°, what is the fourth angle?", options: ["120°", "90°", "100°", "110°"], answer: "120°" },
    { question: "In a rhombus, if one angle is 70°, what is the measure of the adjacent angle?", options: ["70°", "110°", "90°", "100°"], answer: "110°" },
    { question: "In a quadrilateral ABCD, if ∠A = 80°, ∠B = 90°, and AB || CD, what is ∠D?", options: ["100°", "90°", "80°", "110°"], answer: "100°" },
    { question: "In a square, if the diagonal bisects an angle, what is the measure of the bisected angle?", options: ["45°", "90°", "60°", "120°"], answer: "90°" },
    { question: "In a parallelogram, if one angle is 60° and the opposite sides are equal, what type is it?", options: ["Rectangle", "Rhombus", "Square", "Kite"], answer: "Rhombus" },
    { question: "In a quadrilateral, if the angles are in the ratio 2:3:4:6, what is the smallest angle?", options: ["24°", "36°", "48°", "72°"], answer: "24°" },
    { question: "In a trapezium, if the parallel sides are 6 cm and 8 cm, and one angle is 60°, what is the adjacent angle on the same parallel side?", options: ["120°", "60°", "90°", "100°"], answer: "120°" },
    { question: "In a parallelogram, if the diagonals bisect each other at 90°, what type is it?", options: ["Rectangle", "Rhombus", "Square", "Kite"], answer: "Rhombus" },
    { question: "In a quadrilateral, if two angles are 70° and 110°, and the other two are in the ratio 1:2, what is the larger of the two angles?", options: ["100°", "120°", "80°", "140°"], answer: "120°" },
    { question: "In a rhombus, if the diagonals are 8 cm and 6 cm, what is the length of each side?", options: ["5 cm", "7 cm", "10 cm", "14 cm"], answer: "5 cm" },
    { question: "In a quadrilateral ABCD, if AB || CD and BC || AD, what type is it?", options: ["Trapezium", "Parallelogram", "Kite", "Rectangle"], answer: "Parallelogram" }
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