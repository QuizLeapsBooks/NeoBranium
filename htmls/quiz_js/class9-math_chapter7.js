// Quiz data for Triangles (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is the sum of the angles in a triangle?", options: ["180°", "360°", "90°", "270°"], answer: "180°" },
    { question: "What is an equilateral triangle?", options: ["A triangle with two equal sides", "A triangle with all sides equal", "A triangle with no equal sides", "A triangle with one right angle"], answer: "A triangle with all sides equal" },
    { question: "What is an isosceles triangle?", options: ["A triangle with all sides equal", "A triangle with two sides equal", "A triangle with no sides equal", "A triangle with three acute angles"], answer: "A triangle with two sides equal" },
    { question: "What is a scalene triangle?", options: ["A triangle with all sides equal", "A triangle with two sides equal", "A triangle with no sides equal", "A triangle with one right angle"], answer: "A triangle with no sides equal" },
    { question: "What is a right-angled triangle?", options: ["A triangle with all angles equal", "A triangle with one angle 90°", "A triangle with two angles equal", "A triangle with no equal angles"], answer: "A triangle with one angle 90°" },
    { question: "In a triangle, if two angles are 50° and 60°, what is the third angle?", options: ["70°", "80°", "90°", "100°"], answer: "70°" },
    { question: "Which of the following is a criterion for congruence of triangles?", options: ["AAA", "SSS", "ASA", "Both SSS and ASA"], answer: "Both SSS and ASA" },
    { question: "In an isosceles triangle, how many angles are equal?", options: ["1", "2", "3", "None"], answer: "2" },
    { question: "What is the exterior angle of a triangle equal to?", options: ["The sum of all interior angles", "The sum of two opposite interior angles", "The third interior angle", "The difference of two interior angles"], answer: "The sum of two opposite interior angles" },
    { question: "If one angle of a triangle is 80° and the other two are equal, what is each of the equal angles?", options: ["50°", "60°", "70°", "80°"], answer: "50°" },
    { question: "Which of the following is NOT a criterion for triangle congruence?", options: ["SSS", "SAS", "AAA", "ASA"], answer: "AAA" },
    { question: "In a right-angled triangle, if one angle is 90°, what is the sum of the other two angles?", options: ["90°", "180°", "360°", "270°"], answer: "90°" },
    { question: "In an equilateral triangle, what is the measure of each angle?", options: ["60°", "90°", "120°", "180°"], answer: "60°" },
    { question: "What is the property of the angles opposite to equal sides in an isosceles triangle?", options: ["They are equal", "They are supplementary", "They are complementary", "They are unequal"], answer: "They are equal" },
    { question: "If the exterior angle of a triangle is 110° and one opposite interior angle is 40°, what is the other opposite interior angle?", options: ["70°", "60°", "50°", "80°"], answer: "70°" },
    { question: "Which side of a triangle is the longest if one angle is 100°?", options: ["The side opposite to 100°", "The side opposite to the smallest angle", "Any side", "The side adjacent to 100°"], answer: "The side opposite to 100°" },
    { question: "In a triangle, if two sides are equal, what type of triangle is it?", options: ["Scalene", "Isosceles", "Equilateral", "Right-angled"], answer: "Isosceles" },
    { question: "What is the sum of the exterior angles of a triangle?", options: ["180°", "360°", "90°", "270°"], answer: "360°" },
    { question: "In a triangle, if one angle is 45° and another is 60°, what is the third angle?", options: ["75°", "85°", "65°", "95°"], answer: "75°" },
    { question: "Which of the following triangles can have an obtuse angle?", options: ["Equilateral", "Isosceles", "Right-angled", "All of these"], answer: "Isosceles" }
  ],
  level2: [
    { question: "In triangle ABC, if AB = AC and ∠A = 50°, what is ∠B?", options: ["65°", "50°", "60°", "70°"], answer: "65°" },
    { question: "Which criterion proves that two triangles are congruent if two sides and the included angle are equal?", options: ["SSS", "SAS", "ASA", "AAA"], answer: "SAS" },
    { question: "In triangle PQR, if PQ = PR and ∠P = 40°, what is ∠Q?", options: ["70°", "60°", "50°", "80°"], answer: "70°" },
    { question: "If the exterior angle of a triangle is 120° and one opposite interior angle is 50°, what is the other opposite interior angle?", options: ["70°", "60°", "50°", "80°"], answer: "70°" },
    { question: "In a triangle, if two sides are 5 cm and 5 cm, and the angle between them is 60°, what is the triangle type?", options: ["Equilateral", "Isosceles", "Scalene", "Right-angled"], answer: "Isosceles" },
    { question: "Which criterion proves congruence if two angles and the included side are equal?", options: ["SSS", "SAS", "ASA", "AAA"], answer: "ASA" },
    { question: "In triangle XYZ, if ∠X = 70° and ∠Y = 50°, what is the exterior angle at Z?", options: ["120°", "110°", "130°", "100°"], answer: "120°" },
    { question: "If two triangles are congruent by SSS, what must be true?", options: ["All angles are equal", "All sides are equal", "Two sides are equal", "One angle is equal"], answer: "All sides are equal" },
    { question: "In an isosceles triangle, if the vertex angle is 80°, what is the measure of each base angle?", options: ["50°", "60°", "70°", "80°"], answer: "50°" },
    { question: "Which of the following is true about the sides opposite to equal angles in a triangle?", options: ["They are unequal", "They are equal", "They are perpendicular", "They are parallel"], answer: "They are equal" },
    { question: "In triangle ABC, if ∠A = 60° and ∠B = 60°, what type of triangle is it?", options: ["Scalene", "Isosceles", "Equilateral", "Right-angled"], answer: "Equilateral" },
    { question: "If two triangles are congruent by ASA, what must be equal?", options: ["Two sides and one angle", "Two angles and one side", "Three sides", "Three angles"], answer: "Two angles and one side" },
    { question: "In a triangle, if one exterior angle is 140° and one opposite interior angle is 60°, what is the other opposite interior angle?", options: ["80°", "70°", "90°", "100°"], answer: "80°" },
    { question: "Which criterion proves congruence if two sides and the angle opposite one of them are equal?", options: ["SSS", "SAS", "ASA", "RHS"], answer: "None of these" },
    { question: "In triangle ABC, if AB = BC and ∠B = 70°, what is ∠C?", options: ["70°", "55°", "60°", "65°"], answer: "70°" },
    { question: "What is the measure of each exterior angle in an equilateral triangle?", options: ["120°", "60°", "90°", "180°"], answer: "120°" },
    { question: "In triangle PQR, if ∠P = 50° and ∠Q = 70°, what is the exterior angle at R?", options: ["120°", "110°", "130°", "100°"], answer: "120°" },
    { question: "If two triangles are congruent by RHS, what must one of the angles be?", options: ["60°", "90°", "45°", "120°"], answer: "90°" },
    { question: "In a triangle, if one angle is 100°, what is the sum of the other two angles?", options: ["80°", "90°", "100°", "180°"], answer: "80°" },
    { question: "If two angles of a triangle are 45° and 45°, what type of triangle is it?", options: ["Equilateral", "Isosceles", "Scalene", "Right-angled"], answer: "Isosceles" }
  ],
  level3: [
    { question: "In triangle ABC, if AB = AC and ∠B = 70°, what is the measure of ∠A?", options: ["40°", "50°", "60°", "70°"], answer: "40°" },
    { question: "If two triangles are congruent by SAS, and one triangle has sides 3 cm, 4 cm, and included angle 60°, what is true about the other triangle?", options: ["It has sides 3 cm, 4 cm, and angle 60°", "It has sides 4 cm, 5 cm, and angle 60°", "It has sides 3 cm, 3 cm, and angle 60°", "It has sides 3 cm, 4 cm, and angle 90°"], answer: "It has sides 3 cm, 4 cm, and angle 60°" },
    { question: "In triangle PQR, if PQ = PR and the exterior angle at Q is 100°, what is ∠P?", options: ["80°", "50°", "60°", "70°"], answer: "80°" },
    { question: "If the angles of a triangle are in the ratio 1:2:3, what is the measure of the largest angle?", options: ["90°", "60°", "30°", "120°"], answer: "90°" },
    { question: "In triangle ABC, if ∠A = 50°, ∠B = 60°, and AB = AC, what is ∠B?", options: ["50°", "60°", "65°", "70°"], answer: "65°" },
    { question: "If two triangles are congruent by RHS, what must be equal besides the right angle?", options: ["Two angles", "Two sides", "Hypotenuse and one side", "All sides"], answer: "Hypotenuse and one side" },
    { question: "In triangle XYZ, if ∠X = 40°, ∠Y = 70°, and XY = XZ, what is ∠Z?", options: ["70°", "40°", "50°", "60°"], answer: "70°" },
    { question: "If the exterior angle at one vertex of a triangle is 130° and one opposite interior angle is 50°, what is the other opposite interior angle?", options: ["80°", "70°", "90°", "100°"], answer: "80°" },
    { question: "In triangle ABC, if AB = BC and the exterior angle at C is 110°, what is ∠A?", options: ["70°", "55°", "60°", "50°"], answer: "70°" },
    { question: "If two angles of a triangle are in the ratio 2:3 and the third angle is 60°, what is the largest angle?", options: ["72°", "48°", "60°", "90°"], answer: "72°" },
    { question: "In triangle PQR, if PQ = PR and ∠Q = 50°, what is the exterior angle at R?", options: ["100°", "80°", "130°", "110°"], answer: "100°" },
    { question: "If two triangles are congruent by ASA, and one triangle has angles 40°, 60°, and side 5 cm, what is true about the other triangle?", options: ["Angles 40°, 60°, and side 5 cm", "Angles 40°, 60°, and side 6 cm", "Angles 50°, 60°, and side 5 cm", "Angles 40°, 80°, and side 5 cm"], answer: "Angles 40°, 60°, and side 5 cm" },
    { question: "In triangle ABC, if ∠A = 70° and AB = AC, what is the measure of ∠B?", options: ["55°", "65°", "70°", "60°"], answer: "55°" },
    { question: "If the angles of a triangle are in the ratio 1:1:1, what type of triangle is it?", options: ["Isosceles", "Equilateral", "Scalene", "Right-angled"], answer: "Equilateral" },
    { question: "In triangle XYZ, if XY = XZ and the exterior angle at Y is 120°, what is ∠X?", options: ["60°", "80°", "70°", "50°"], answer: "60°" },
    { question: "If two triangles are congruent by SSS, and one triangle has sides 3 cm, 4 cm, 5 cm, what are the sides of the other triangle?", options: ["3 cm, 4 cm, 5 cm", "4 cm, 5 cm, 6 cm", "3 cm, 3 cm, 5 cm", "3 cm, 4 cm, 6 cm"], answer: "3 cm, 4 cm, 5 cm" },
    { question: "In triangle ABC, if ∠B = 80° and ∠C = 80°, what type of triangle is it?", options: ["Equilateral", "Isosceles", "Scalene", "Right-angled"], answer: "Isosceles" },
    { question: "If the exterior angles of a triangle are 120°, 130°, and x°, what is x?", options: ["110°", "120°", "130°", "100°"], answer: "110°" },
    { question: "In triangle PQR, if PQ = PR and ∠P = 30°, what is ∠Q?", options: ["75°", "60°", "70°", "65°"], answer: "75°" },
    { question: "If two angles of a triangle are 50° and 60°, and the side opposite to 50° is equal to the side opposite to 60°, what type of triangle is it?", options: ["Equilateral", "Isosceles", "Scalene", "Right-angled"], answer: "Isosceles" }
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