// Quiz data for Constructions (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is the first step to construct a perpendicular bisector of a line segment?", options: ["Draw an arc from one end", "Draw two arcs from both ends", "Measure the segment", "Draw a line parallel to the segment"], answer: "Draw two arcs from both ends" },
    { question: "Which tool is used to construct a circle with a given radius?", options: ["Ruler", "Compass", "Protractor", "Divider"], answer: "Compass" },
    { question: "To construct an angle of 60°, how many arcs are typically drawn?", options: ["2", "3", "4", "5"], answer: "2" },
    { question: "What is the angle formed by the bisector of a 90° angle?", options: ["45°", "30°", "60°", "90°"], answer: "45°" },
    { question: "In constructing a triangle with sides 5 cm, 6 cm, and 7 cm, what is the first step?", options: ["Draw an angle", "Draw the base", "Draw an arc", "Measure the angles"], answer: "Draw the base" },
    { question: "To construct a perpendicular to a line from a point on it, what is used?", options: ["Ruler", "Compass", "Protractor", "Set square"], answer: "Compass" },
    { question: "What is the measure of each angle in an equilateral triangle?", options: ["60°", "90°", "45°", "120°"], answer: "60°" },
    { question: "To construct an angle of 120°, how many 60° angles are combined?", options: ["1", "2", "3", "4"], answer: "2" },
    { question: "What is the minimum number of arcs needed to bisect an angle?", options: ["2", "3", "4", "5"], answer: "3" },
    { question: "In constructing a triangle, which condition must be satisfied for sides a, b, c?", options: ["a + b < c", "a + b > c", "a = b = c", "a + b = c"], answer: "a + b > c" },
    { question: "To construct a 90° angle, what is the key step after drawing a base line?", options: ["Draw an arc from one end", "Draw two equal arcs intersecting inside", "Measure 90° with a protractor", "Draw a parallel line"], answer: "Draw two equal arcs intersecting inside" },
    { question: "What is used to construct a perpendicular from a point outside a line?", options: ["Ruler only", "Compass and ruler", "Protractor", "Set square"], answer: "Compass and ruler" },
    { question: "To construct an angle of 30°, what is typically done?", options: ["Bisect a 90° angle", "Bisect a 60° angle", "Bisect a 120° angle", "Draw a 45° angle"], answer: "Bisect a 60° angle" },
    { question: "In constructing a triangle with two sides and the included angle, what is measured first?", options: ["The angle", "The sides", "The base", "The height"], answer: "The base" },
    { question: "What is the result of bisecting a 180° angle?", options: ["90°", "60°", "45°", "30°"], answer: "90°" },
    { question: "To construct a triangle with sides 4 cm, 5 cm, and 6 cm, how many sides are drawn initially?", options: ["1", "2", "3", "None"], answer: "1" },
    { question: "What tool is used to measure the length of a segment in constructions?", options: ["Compass", "Ruler", "Protractor", "Divider"], answer: "Ruler" },
    { question: "To construct a 45° angle, what is typically done?", options: ["Bisect a 90° angle", "Bisect a 60° angle", "Draw a 120° angle", "Draw a 30° angle"], answer: "Bisect a 90° angle" },
    { question: "What is the purpose of a perpendicular bisector?", options: ["Divide an angle", "Divide a line into two equal parts", "Draw a circle", "Measure an angle"], answer: "Divide a line into two equal parts" },
    { question: "In constructing an equilateral triangle, how many sides are of equal length?", options: ["1", "2", "3", "4"], answer: "3" }
  ],
  level2: [
    { question: "To construct a triangle with sides 6 cm, 7 cm, and 8 cm, what is the second step after drawing the base?", options: ["Draw an angle", "Draw an arc with one side length", "Measure the third side", "Bisect the base"], answer: "Draw an arc with one side length" },
    { question: "In constructing a 60° angle, what is the radius of the arcs drawn?", options: ["Any equal radius", "Different radii", "Half the line length", "Double the line length"], answer: "Any equal radius" },
    { question: "To construct a perpendicular bisector, how many arcs are drawn to find the midpoint?", options: ["2", "3", "4", "5"], answer: "4" },
    { question: "In constructing a triangle with sides 5 cm, 5 cm, and 6 cm, what type of triangle is formed?", options: ["Equilateral", "Isosceles", "Scalene", "Right-angled"], answer: "Isosceles" },
    { question: "To construct an angle of 15°, what is typically done?", options: ["Bisect a 30° angle", "Bisect a 60° angle", "Bisect a 90° angle", "Bisect a 45° angle"], answer: "Bisect a 30° angle" },
    { question: "In constructing a triangle with two angles 40° and 60° and the included side 5 cm, what is the third angle?", options: ["80°", "100°", "70°", "90°"], answer: "80°" },
    { question: "To construct a perpendicular from a point outside a line, how many arcs are typically drawn?", options: ["3", "4", "5", "6"], answer: "4" },
    { question: "In constructing an equilateral triangle with side 6 cm, what is the measure of each angle?", options: ["60°", "90°", "45°", "120°"], answer: "60°" },
    { question: "To construct a 90° angle using a compass, how many arcs are drawn?", options: ["3", "4", "5", "6"], answer: "4" },
    { question: "In constructing a triangle with sides 4 cm, 5 cm, and 7 cm, what must be true for the sides?", options: ["4 + 5 > 7", "4 + 5 < 7", "4 = 5 = 7", "4 + 5 = 7"], answer: "4 + 5 > 7" },
    { question: "To construct a 120° angle, what is typically done?", options: ["Combine two 60° angles", "Bisect a 180° angle", "Bisect a 90° angle", "Draw a 90° angle"], answer: "Combine two 60° angles" },
    { question: "In constructing a triangle with sides 5 cm, 6 cm, and 8 cm, how many arcs are drawn to locate the third vertex?", options: ["1", "2", "3", "4"], answer: "2" },
    { question: "To construct an angle bisector, what is the first step after drawing the angle?", options: ["Draw an arc inside the angle", "Measure the angle", "Draw a perpendicular", "Draw a parallel line"], answer: "Draw an arc inside the angle" },
    { question: "In constructing a triangle with two sides 6 cm and 7 cm and included angle 45°, what tool is used to measure the angle?", options: ["Ruler", "Compass", "Protractor", "Divider"], answer: "Protractor" },
    { question: "To construct a perpendicular to a line from a point on it, how many arcs are drawn?", options: ["2", "3", "4", "5"], answer: "4" },
    { question: "In constructing an isosceles triangle with base 6 cm and equal sides 5 cm, what is the first step?", options: ["Draw the base", "Draw an angle", "Draw an arc", "Measure the angles"], answer: "Draw the base" },
    { question: "To construct a 30° angle, how many arcs are typically drawn?", options: ["3", "4", "5", "6"], answer: "3" },
    { question: "In constructing a triangle with sides 5 cm, 6 cm, and 9 cm, what is checked before construction?", options: ["Angle sum", "Side sum condition", "Area of triangle", "Perimeter"], answer: "Side sum condition" },
    { question: "To construct a 45° angle, how many arcs are typically drawn?", options: ["3", "4", "5", "6"], answer: "4" },
    { question: "In constructing a perpendicular bisector, what is the purpose of the intersecting arcs?", options: ["Find the midpoint", "Draw a circle", "Measure the angle", "Construct a parallel line"], answer: "Find the midpoint" }
  ],
  level3: [
    { question: "Construct a triangle ABC with AB = 6 cm, BC = 8 cm, and ∠B = 60°. If D is the midpoint of BC, what is the length of AD (using construction and coordinate geometry)?", options: ["5 cm", "6 cm", "7 cm", "8 cm"], answer: "7 cm" },
    { question: "Construct an angle of 22.5°. How many arcs are required to complete the construction?", options: ["5", "6", "7", "8"], answer: "6" },
    { question: "Construct a triangle with sides 5 cm, 6 cm, and 7 cm. If a perpendicular bisector of side BC intersects AB at P, what is the ratio AP:PB?", options: ["1:1", "2:3", "3:2", "1:2"], answer: "1:1" },
    { question: "Construct a triangle ABC with AB = 5 cm, ∠A = 45°, and ∠B = 60°. What is the measure of ∠C?", options: ["75°", "90°", "60°", "45°"], answer: "75°" },
    { question: "Construct a circle with radius 4 cm and a point P 7 cm from the center. Construct tangents from P to the circle. What is the length of each tangent?", options: ["6 cm", "5 cm", "4 cm", "7 cm"], answer: "6 cm" },
    { question: "Construct an equilateral triangle with side 6 cm. If a perpendicular is dropped from one vertex to the opposite side, what is the length of the perpendicular?", options: ["3√3 cm", "3 cm", "4 cm", "5 cm"], answer: "3√3 cm" },
    { question: "Construct a triangle ABC with BC = 8 cm, ∠B = 45°, and ∠C = 60°. If D is the midpoint of AB, what is the length of CD (using coordinate geometry)?", options: ["4√2 cm", "5 cm", "6 cm", "7 cm"], answer: "4√2 cm" },
    { question: "Construct a 15° angle by bisecting a 30° angle. If the initial arc for the 60° angle has radius 5 cm, what is the radius of the arcs used for bisecting?", options: ["Any equal radius", "5 cm", "2.5 cm", "10 cm"], answer: "Any equal radius" },
    { question: "Construct a triangle ABC with AB = 6 cm, AC = 7 cm, and ∠A = 60°. If the perpendicular bisector of BC intersects AB at P, what is the length of AP?", options: ["3 cm", "4 cm", "5 cm", "6 cm"], answer: "3 cm" },
    { question: "Construct a circle with radius 5 cm and a point P 13 cm from the center. Construct two tangents from P. What is the angle between the tangents?", options: ["90°", "60°", "120°", "53°"], answer: "53°" },
    { question: "Construct a triangle ABC with sides 4 cm, 5 cm, and 6 cm. If the angle bisector of ∠A intersects BC at D, what is the ratio BD:DC?", options: ["4:5", "5:4", "2:3", "3:2"], answer: "4:5" },
    { question: "Construct an isosceles triangle with base 6 cm and equal sides 5 cm. What is the measure of the base angles?", options: ["66.42°", "56.44°", "72.36°", "60°"], answer: "72.36°" },
    { question: "Construct a triangle ABC with AB = 5 cm, BC = 7 cm, and ∠B = 90°. If D is the foot of the perpendicular from A to BC, what is the length of AD?", options: ["25/7 cm", "24/7 cm", "20/7 cm", "30/7 cm"], answer: "24/7 cm" },
    { question: "Construct a 67.5° angle by combining constructions of 90° and 45° angles. How many arcs are required?", options: ["6", "7", "8", "9"], answer: "7" },
    { question: "Construct a triangle ABC with BC = 10 cm, ∠B = 30°, and ∠C = 45°. If the perpendicular bisector of AB intersects BC at Q, what is the length of BQ?", options: ["5 cm", "4 cm", "6 cm", "7 cm"], answer: "5 cm" },
    { question: "Construct a circle with radius 3 cm. Construct a tangent from a point P 5 cm from the center. What is the length of the tangent?", options: ["4 cm", "3 cm", "5 cm", "6 cm"], answer: "4 cm" },
    { question: "Construct a triangle ABC with AB = 6 cm, AC = 8 cm, and ∠A = 45°. If D is the midpoint of BC, what is the length of AD (using coordinate geometry)?", options: ["5 cm", "6 cm", "7 cm", "8 cm"], answer: "7 cm" },
    { question: "Construct an equilateral triangle with side 8 cm. If a perpendicular bisector of one side intersects the opposite vertex, what is the length of the segment from the vertex to the intersection?", options: ["4√3 cm", "4 cm", "6 cm", "8 cm"], answer: "4√3 cm" },
    { question: "Construct a triangle ABC with sides 5 cm, 6 cm, and 8 cm. If the angle bisector of ∠B intersects AC at E, what is the ratio AE:EC?", options: ["5:6", "6:5", "3:2", "2:3"], answer: "5:8" },
    { question: "Construct a triangle ABC with AB = 7 cm, ∠A = 60°, and ∠B = 45°. If the perpendicular from C to AB intersects AB at P, what is the length of CP?", options: ["7√2/2 cm", "7/2 cm", "5 cm", "6 cm"], answer: "7√2/2 cm" }
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