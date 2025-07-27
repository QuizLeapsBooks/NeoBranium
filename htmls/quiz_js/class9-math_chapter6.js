// Quiz data for Lines and Angles (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is the measure of a right angle?", options: ["90°", "180°", "45°", "360°"], answer: "90°" },
    { question: "What is the measure of an acute angle?", options: ["Greater than 90°", "Less than 90°", "Equal to 90°", "Equal to 180°"], answer: "Less than 90°" },
    { question: "What is the measure of an obtuse angle?", options: ["Less than 90°", "Greater than 90° but less than 180°", "Equal to 90°", "Equal to 180°"], answer: "Greater than 90° but less than 180°" },
    { question: "What are complementary angles?", options: ["Angles that sum to 180°", "Angles that sum to 90°", "Equal angles", "Opposite angles"], answer: "Angles that sum to 90°" },
    { question: "What are supplementary angles?", options: ["Angles that sum to 90°", "Angles that sum to 180°", "Equal angles", "Opposite angles"], answer: "Angles that sum to 180°" },
    { question: "What are vertically opposite angles?", options: ["Angles that sum to 90°", "Angles that sum to 180°", "Angles formed by intersecting lines and are equal", "Angles on the same side"], answer: "Angles formed by intersecting lines and are equal" },
    { question: "If two angles are complementary, and one is 40°, what is the other?", options: ["50°", "40°", "90°", "140°"], answer: "50°" },
    { question: "If two angles are supplementary, and one is 120°, what is the other?", options: ["60°", "120°", "90°", "180°"], answer: "60°" },
    { question: "What is the angle formed by a straight line?", options: ["90°", "180°", "360°", "45°"], answer: "180°" },
    { question: "What are adjacent angles?", options: ["Angles that are equal", "Angles that share a common side and vertex", "Angles that sum to 90°", "Angles that sum to 180°"], answer: "Angles that share a common side and vertex" },
    { question: "If two lines intersect, how many pairs of vertically opposite angles are formed?", options: ["1", "2", "3", "4"], answer: "2" },
    { question: "What is the measure of a reflex angle?", options: ["Less than 90°", "Greater than 180° but less than 360°", "Equal to 180°", "Equal to 90°"], answer: "Greater than 180° but less than 360°" },
    { question: "If one angle of a linear pair is 70°, what is the other?", options: ["110°", "70°", "90°", "180°"], answer: "110°" },
    { question: "What are parallel lines?", options: ["Lines that intersect", "Lines that never meet", "Lines that form a right angle", "Lines that are curved"], answer: "Lines that never meet" },
    { question: "What is a transversal?", options: ["A line parallel to another line", "A line that intersects two or more lines", "A line segment", "A curved line"], answer: "A line that intersects two or more lines" },
    { question: "If two angles are complementary, and one is 25°, what is the other?", options: ["65°", "75°", "55°", "45°"], answer: "65°" },
    { question: "If two angles are supplementary, and one is 45°, what is the other?", options: ["135°", "145°", "125°", "155°"], answer: "135°" },
    { question: "What is the sum of angles at a point?", options: ["180°", "360°", "90°", "270°"], answer: "360°" },
    { question: "What are alternate interior angles?", options: ["Angles on the same side of a transversal", "Angles that are equal and on opposite sides of a transversal", "Angles that sum to 180°", "Angles that are adjacent"], answer: "Angles that are equal and on opposite sides of a transversal" },
    { question: "What is the measure of each angle in a pair of equal vertically opposite angles?", options: ["They can be any measure but equal", "90°", "180°", "45°"], answer: "They can be any measure but equal" }
  ],
  level2: [
    { question: "If two parallel lines are cut by a transversal, what is true about alternate interior angles?", options: ["They are supplementary", "They are equal", "They are complementary", "They sum to 360°"], answer: "They are equal" },
    { question: "If two parallel lines are cut by a transversal, what is true about corresponding angles?", options: ["They are supplementary", "They are equal", "They are complementary", "They sum to 360°"], answer: "They are equal" },
    { question: "If two parallel lines are cut by a transversal, what is the measure of each interior angle on the same side of the transversal?", options: ["90°", "180°", "360°", "They sum to 180°"], answer: "They sum to 180°" },
    { question: "If one angle of a linear pair is 100°, what is the other angle?", options: ["80°", "90°", "100°", "180°"], answer: "80°" },
    { question: "If two lines are parallel and one angle formed by a transversal is 60°, what is the measure of the corresponding angle?", options: ["60°", "120°", "90°", "180°"], answer: "60°" },
    { question: "If two lines intersect and one angle is 70°, what is the measure of the vertically opposite angle?", options: ["70°", "110°", "90°", "180°"], answer: "70°" },
    { question: "If two parallel lines are cut by a transversal and one alternate interior angle is 75°, what is the other alternate interior angle?", options: ["75°", "105°", "90°", "180°"], answer: "75°" },
    { question: "If two angles are supplementary and one is 3 times the other, what is the smaller angle?", options: ["45°", "60°", "30°", "90°"], answer: "45°" },
    { question: "If two angles are complementary and one is twice the other, what is the smaller angle?", options: ["30°", "45°", "60°", "90°"], answer: "30°" },
    { question: "If two parallel lines are cut by a transversal, what is the measure of an exterior angle if the corresponding interior angle is 110°?", options: ["110°", "70°", "90°", "180°"], answer: "110°" },
    { question: "If two lines intersect and one angle is 120°, what is the measure of the adjacent angle?", options: ["60°", "120°", "90°", "180°"], answer: "60°" },
    { question: "If two parallel lines are cut by a transversal and one interior angle is 80°, what is the measure of the co-interior angle?", options: ["100°", "80°", "90°", "180°"], answer: "100°" },
    { question: "If two angles are vertically opposite and one is 95°, what is the other?", options: ["95°", "85°", "90°", "180°"], answer: "95°" },
    { question: "If two parallel lines are cut by a transversal and one angle is 130°, what is the measure of the corresponding angle?", options: ["130°", "50°", "90°", "180°"], answer: "130°" },
    { question: "If two angles are complementary and their difference is 20°, what is the larger angle?", options: ["55°", "65°", "45°", "75°"], answer: "55°" },
    { question: "If two angles are supplementary and their difference is 30°, what is the smaller angle?", options: ["75°", "105°", "90°", "60°"], answer: "75°" },
    { question: "If two parallel lines are cut by a transversal, how many pairs of alternate interior angles are formed?", options: ["2", "4", "1", "3"], answer: "2" },
    { question: "If two lines intersect, how many angles are formed at the point of intersection?", options: ["2", "4", "6", "8"], answer: "4" },
    { question: "If two parallel lines are cut by a transversal and one exterior angle is 140°, what is the co-exterior angle?", options: ["40°", "140°", "90°", "180°"], answer: "40°" },
    { question: "If one angle of a linear pair is 45°, what is the other angle?", options: ["135°", "45°", "90°", "180°"], answer: "135°" }
  ],
  level3: [
    { question: "If two parallel lines are cut by a transversal and one interior angle is 70°, what is the measure of the alternate exterior angle?", options: ["70°", "110°", "90°", "180°"], answer: "70°" },
    { question: "If two angles are supplementary and one is 4 times the other, what is the larger angle?", options: ["144°", "120°", "108°", "90°"], answer: "144°" },
    { question: "If two parallel lines are cut by a transversal and the sum of two consecutive interior angles is 180°, what is the measure of one angle if the other is 65°?", options: ["115°", "65°", "90°", "180°"], answer: "115°" },
    { question: "If two lines intersect and one angle is 85°, what is the sum of the remaining three angles?", options: ["275°", "360°", "180°", "95°"], answer: "275°" },
    { question: "If two parallel lines are cut by a transversal and one angle is x°, what is the measure of the corresponding angle?", options: ["x°", "180° - x°", "90° - x°", "2x°"], answer: "x°" },
    { question: "If two angles are complementary and their ratio is 2:3, what is the larger angle?", options: ["54°", "36°", "45°", "60°"], answer: "54°" },
    { question: "If two parallel lines are cut by a transversal and one exterior angle is 120°, what is the measure of the alternate interior angle?", options: ["120°", "60°", "90°", "180°"], answer: "120°" },
    { question: "If two lines intersect and one angle is x°, what is the measure of the vertically opposite angle?", options: ["x°", "180° - x°", "90° - x°", "2x°"], answer: "x°" },
    { question: "If two parallel lines are cut by a transversal and one interior angle is 2x°, what is the co-interior angle?", options: ["180° - 2x°", "2x°", "x°", "90° - x°"], answer: "180° - 2x°" },
    { question: "If two angles are supplementary and their ratio is 5:4, what is the smaller angle?", options: ["80°", "100°", "90°", "72°"], answer: "80°" },
    { question: "If two parallel lines are cut by a transversal and one angle is 3x°, and its corresponding angle is 3x°, what is x?", options: ["Any value", "90°", "180°", "60°"], answer: "Any value" },
    { question: "If two lines intersect and one angle is 100°, what is the sum of the two adjacent angles?", options: ["180°", "260°", "100°", "360°"], answer: "260°" },
    { question: "If two parallel lines are cut by a transversal and one interior angle is 55°, what is the measure of the alternate interior angle?", options: ["55°", "125°", "90°", "180°"], answer: "55°" },
    { question: "If two angles are complementary and their difference is 10°, what is the smaller angle?", options: ["40°", "50°", "45°", "35°"], answer: "40°" },
    { question: "If two parallel lines are cut by a transversal and one exterior angle is 4x°, what is the co-exterior angle?", options: ["180° - 4x°", "4x°", "2x°", "90° - x°"], answer: "180° - 4x°" },
    { question: "If two lines are perpendicular, what is the measure of the angle between them?", options: ["90°", "180°", "45°", "360°"], answer: "90°" },
    { question: "If two parallel lines are cut by a transversal and one angle is 70°, what is the measure of the co-interior angle?", options: ["110°", "70°", "90°", "180°"], answer: "110°" },
    { question: "If two angles are supplementary and one is 5 times the other, what is the smaller angle?", options: ["30°", "150°", "90°", "60°"], answer: "30°" },
    { question: "If two parallel lines are cut by a transversal and one angle is x°, what is the measure of the alternate exterior angle?", options: ["x°", "180° - x°", "90° - x°", "2x°"], answer: "x°" },
    { question: "If two lines intersect and one angle is 110°, what is the measure of the adjacent angle?", options: ["70°", "110°", "90°", "180°"], answer: "70°" }
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