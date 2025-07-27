// Quiz data for Circles (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is the measure of an angle subtended by a semicircle at the center?", options: ["90°", "180°", "360°", "120°"], answer: "180°" },
    { question: "In a circle, what is true about chords of equal length?", options: ["They are at different distances from the center", "They are equidistant from the center", "They are parallel", "They are perpendicular"], answer: "They are equidistant from the center" },
    { question: "What is the angle in a semicircle?", options: ["90°", "180°", "60°", "120°"], answer: "90°" },
    { question: "If two chords AB and CD of a circle intersect at point P inside the circle, what is true?", options: ["AP × PB = CP × PD", "AP + PB = CP + PD", "AP = CP", "PB = PD"], answer: "AP × PB = CP × PD" },
    { question: "What is a cyclic quadrilateral?", options: ["A quadrilateral with all sides equal", "A quadrilateral with opposite angles equal", "A quadrilateral whose vertices lie on a circle", "A quadrilateral with all angles 90°"], answer: "A quadrilateral whose vertices lie on a circle" },
    { question: "In a cyclic quadrilateral, what is the sum of opposite angles?", options: ["90°", "180°", "360°", "270°"], answer: "180°" },
    { question: "What is the length of a tangent from a point to a circle if the radius is 5 cm and the distance from the point to the center is 13 cm?", options: ["12 cm", "10 cm", "8 cm", "6 cm"], answer: "12 cm" },
    { question: "How many tangents can be drawn from a point outside a circle?", options: ["1", "2", "3", "Infinite"], answer: "2" },
    { question: "What is true about the radius drawn to the point of contact of a tangent?", options: ["It is parallel to the tangent", "It is perpendicular to the tangent", "It bisects the tangent", "It is equal to the tangent"], answer: "It is perpendicular to the tangent" },
    { question: "In a circle, if ∠AOB = 60°, what is the angle subtended by arc AB at a point on the major arc?", options: ["30°", "60°", "90°", "120°"], answer: "30°" },
    { question: "What is true about angles in the same segment of a circle?", options: ["They are unequal", "They are equal", "They are complementary", "They are supplementary"], answer: "They are equal" },
    { question: "If the diameter of a circle is 10 cm, what is the radius?", options: ["5 cm", "10 cm", "20 cm", "15 cm"], answer: "5 cm" },
    { question: "In a circle, if two tangents are drawn from an external point, what is true about their lengths?", options: ["They are unequal", "They are equal", "They are parallel", "They are perpendicular"], answer: "They are equal" },
    { question: "What is the measure of the angle between two tangents drawn from an external point to a circle?", options: ["90°", "180°", "60°", "It depends"], answer: "It depends" },
    { question: "In a cyclic quadrilateral ABCD, if ∠A = 70°, what is ∠C?", options: ["110°", "70°", "90°", "180°"], answer: "110°" },
    { question: "If a chord subtends an angle of 80° at the center, what is the angle subtended at a point on the major arc?", options: ["40°", "80°", "100°", "160°"], answer: "40°" },
    { question: "What is true about the perpendicular from the center to a chord?", options: ["It bisects the chord", "It is parallel to the chord", "It is equal to the chord", "It intersects the chord at one end"], answer: "It bisects the chord" },
    { question: "In a circle, if ∠ABC = 50° at point B on the circumference, what is ∠AOC at the center?", options: ["100°", "50°", "25°", "75°"], answer: "100°" },
    { question: "What is the sum of the interior angles of a cyclic quadrilateral?", options: ["180°", "360°", "90°", "270°"], answer: "360°" },
    { question: "If a tangent and a chord meet at a point on the circle, what is true about the angles formed?", options: ["They are equal", "They are supplementary", "They are complementary", "They are unequal"], answer: "They are equal" }
  ],
  level2: [
    { question: "In a circle with center O, chord AB subtends ∠AOB = 70°. What is the angle subtended by arc AB at a point on the major arc?", options: ["35°", "70°", "105°", "140°"], answer: "35°" },
    { question: "In a cyclic quadrilateral ABCD, if ∠B = 80°, what is ∠D?", options: ["100°", "80°", "90°", "110°"], answer: "100°" },
    { question: "If two chords PQ and RS intersect at point T inside a circle, and PT = 4 cm, TQ = 6 cm, RT = 3 cm, what is TS?", options: ["8 cm", "6 cm", "9 cm", "12 cm"], answer: "8 cm" },
    { question: "In a circle, if a tangent from point P to point T on the circle has length 15 cm, and the radius is 8 cm, what is the distance from P to the center?", options: ["17 cm", "13 cm", "10 cm", "20 cm"], answer: "17 cm" },
    { question: "In a circle, if ∠AOB = 100° at the center, what is the angle subtended by arc AB at a point on the minor arc?", options: ["50°", "100°", "130°", "80°"], answer: "50°" },
    { question: "In a cyclic quadrilateral PQRS, if ∠P = 65°, what is ∠R?", options: ["115°", "65°", "90°", "125°"], answer: "115°" },
    { question: "If two tangents PA and PB are drawn from point P to a circle, and ∠APB = 60°, what is ∠AOB at the center?", options: ["120°", "60°", "90°", "180°"], answer: "120°" },
    { question: "In a circle, if a chord subtends an angle of 90° at the center, what is the angle subtended at a point on the major arc?", options: ["45°", "90°", "135°", "180°"], answer: "45°" },
    { question: "If the radius of a circle is 5 cm and a chord is 8 cm long, what is the distance from the center to the chord?", options: ["3 cm", "4 cm", "5 cm", "6 cm"], answer: "3 cm" },
    { question: "In a circle, if two chords AB and CD intersect at point P such that AP = 5 cm, PB = 4 cm, CP = 2 cm, what is PD?", options: ["10 cm", "8 cm", "6 cm", "12 cm"], answer: "10 cm" },
    { question: "In a cyclic quadrilateral, if one angle is 110°, what is the opposite angle?", options: ["70°", "110°", "90°", "100°"], answer: "70°" },
    { question: "If a tangent from point P to a circle is 24 cm and the distance from P to the center is 25 cm, what is the radius?", options: ["7 cm", "10 cm", "5 cm", "12 cm"], answer: "7 cm" },
    { question: "In a circle, if ∠ABC = 40° at point B on the circumference, what is ∠AOC at the center?", options: ["80°", "40°", "20°", "120°"], answer: "80°" },
    { question: "If two tangents from an external point P to points A and B on a circle form ∠APB = 90°, what is ∠AOB at the center?", options: ["90°", "180°", "45°", "120°"], answer: "90°" },
    { question: "In a circle, if a chord is perpendicular to the radius, what is true?", options: ["It is bisected by the radius", "It is parallel to the radius", "It is equal to the radius", "It does not intersect the radius"], answer: "It is bisected by the radius" },
    { question: "In a cyclic quadrilateral ABCD, if ∠A = 85°, what is ∠C?", options: ["95°", "85°", "90°", "105°"], answer: "95°" },
    { question: "If a chord subtends an angle of 120° at the center, what is the angle subtended at a point on the minor arc?", options: ["60°", "120°", "30°", "90°"], answer: "60°" },
    { question: "If two chords PQ and RS intersect at T inside a circle, and PT = 6 cm, TQ = 4 cm, RT = 3 cm, what is TS?", options: ["8 cm", "6 cm", "12 cm", "9 cm"], answer: "8 cm" },
    { question: "In a circle, if ∠AOB = 80°, what is the angle subtended by arc AB at a point on the major arc?", options: ["40°", "80°", "100°", "160°"], answer: "40°" },
    { question: "If a tangent and a chord meet at point T on a circle, and the angle between them is 50°, what is the angle subtended by the chord at a point on the major arc?", options: ["50°", "100°", "25°", "75°"], answer: "50°" }
  ],
  level3: [
    { question: "In a circle with center O, chords AB and CD intersect at P inside the circle such that AP = 3 cm, PB = 5 cm, CP = 4 cm. If the radius is 5 cm, what is PD?", options: ["3.75 cm", "4 cm", "5 cm", "6 cm"], answer: "3.75 cm" },
    { question: "In a cyclic quadrilateral ABCD, ∠A = 70°, and the external angle at B is 120°. What is the measure of ∠C?", options: ["110°", "130°", "100°", "90°"], answer: "110°" },
    { question: "In a circle with center O, point P is on the circumference such that ∠POQ = 100° for arc PQ. If point R is on the major arc PQ, what is ∠PRQ?", options: ["50°", "40°", "60°", "80°"], answer: "50°" },
    { question: "In a circle, two tangents PA and PB are drawn from point P such that ∠APB = 60°. If the radius is 6 cm, what is the distance OP?", options: ["12 cm", "10 cm", "8 cm", "6√3 cm"], answer: "12 cm" },
    { question: "In a circle with center O, chord AB is extended to point P outside the circle such that AP = 12 cm and AB = 8 cm. If the radius is 5 cm, what is the length of tangent PT from P to point T on the circle?", options: ["9 cm", "8 cm", "10 cm", "12 cm"], answer: "9 cm" },
    { question: "In a circle, points A, B, C, and D form a cyclic quadrilateral. If ∠ABC = 80° and arc AC subtends ∠AOC = 100° at the center, what is ∠ADC?", options: ["100°", "80°", "90°", "110°"], answer: "100°" },
    { question: "In a circle with center O, chord PQ is bisected by radius OR at point M. If OM = 3 cm and radius OP = 5 cm, what is the length of chord PQ?", options: ["8 cm", "6 cm", "10 cm", "4 cm"], answer: "8 cm" },
    { question: "In a cyclic quadrilateral PQRS, diagonals PR and QS intersect at T. If ∠PTQ = 50° and ∠PRS = 60°, what is ∠QRS?", options: ["70°", "80°", "90°", "100°"], answer: "80°" },
    { question: "In a circle with center O, points A, B, C are on the circumference such that ∠AOB = 90° and ∠BOC = 110°. What is ∠BAC?", options: ["100°", "90°", "50°", "55°"], answer: "100°" },
    { question: "In a circle, two chords AB and CD intersect at P inside the circle. If AP = 6 cm, PB = 4 cm, CP = 3 cm, and the radius is 5 cm, what is the distance from O to P?", options: ["4 cm", "3 cm", "2 cm", "5 cm"], answer: "3 cm" },
    { question: "In a circle with center O, a tangent from point P touches the circle at T. If OT = 5 cm and PT = 12 cm, and another tangent from P touches at S, what is ∠TOS?", options: ["90°", "120°", "60°", "180°"], answer: "90°" },
    { question: "In a cyclic quadrilateral ABCD, if arc AB subtends 80° at the center and arc CD subtends 100°, what is ∠BCD?", options: ["90°", "100°", "80°", "110°"], answer: "90°" },
    { question: "In a circle with center O, chord AB is parallel to chord CD. If ∠AOB = 70°, what is the angle subtended by arc AB at a point on the major arc?", options: ["35°", "70°", "55°", "110°"], answer: "35°" },
    { question: "In a circle, two tangents PA and PB are drawn such that ∠APB = 90°. If the radius is 4 cm, what is the length of PA?", options: ["4 cm", "8 cm", "6 cm", "5 cm"], answer: "4√2 cm" },
    { question: "In a circle with center O, points A, B, C, D are concyclic. If ∠BAC = 40° and ∠BDC = 70°, what is ∠ABC?", options: ["70°", "110°", "90°", "100°"], answer: "110°" },
    { question: "In a circle, chord AB subtends ∠AOB = 120°. Point P is on the major arc AB such that AP = PB. What is ∠APB?", options: ["60°", "90°", "120°", "30°"], answer: "90°" },
    { question: "In a circle with center O, two chords PQ and RS intersect at T such that PT = 5 cm, TQ = 3 cm, RT = 2 cm. If the radius is 5 cm, what is TS?", options: ["7.5 cm", "6 cm", "8 cm", "10 cm"], answer: "7.5 cm" },
    { question: "In a circle with center O, point P is outside the circle such that OP = 13 cm and the radius is 5 cm. If PT is a tangent, what is the length of PT?", options: ["12 cm", "10 cm", "8 cm", "6 cm"], answer: "12 cm" },
    { question: "In a cyclic quadrilateral ABCD, if ∠A = 65° and the external angle at C is 130°, what is ∠B?", options: ["115°", "50°", "65°", "100°"], answer: "50°" },
    { question: "In a circle with center O, points A, B, C are on the circumference such that AB = BC and ∠AOB = 80°. What is ∠BAC?", options: ["40°", "50°", "60°", "80°"], answer: "50°" }
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