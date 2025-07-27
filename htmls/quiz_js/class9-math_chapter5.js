// Quiz data for Introduction to Euclid's Geometry (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "Who is known as the 'Father of Geometry'?", options: ["Pythagoras", "Euclid", "Archimedes", "Thales"], answer: "Euclid" },
    { question: "What is the name of Euclid's famous book?", options: ["Algebra", "Elements", "Geometry", "Principia"], answer: "Elements" },
    { question: "How many postulates did Euclid propose?", options: ["3", "4", "5", "6"], answer: "5" },
    { question: "What is an axiom?", options: ["A proven statement", "A statement accepted without proof", "A theorem", "A conjecture"], answer: "A statement accepted without proof" },
    { question: "Which of the following is a Euclidean postulate?", options: ["All angles are equal", "A straight line can be drawn from any point to any point", "All triangles are similar", "The sum of angles in a triangle is 180°"], answer: "A straight line can be drawn from any point to any point" },
    { question: "What is a postulate?", options: ["A proven fact", "A statement accepted without proof", "A geometric figure", "A theorem"], answer: "A statement accepted without proof" },
    { question: "Which of Euclid's postulates deals with circles?", options: ["First", "Second", "Third", "Fourth"], answer: "Third" },
    { question: "What does Euclid's first postulate state?", options: ["All right angles are equal", "A straight line can be drawn between two points", "A circle can be drawn with any center and radius", "A line can be extended indefinitely"], answer: "A straight line can be drawn between two points" },
    { question: "How many axioms are mentioned in NCERT Chapter 5 for Class 9?", options: ["5", "7", "10", "12"], answer: "7" },
    { question: "Which of the following is an example of a point?", options: ["A line segment", "A dot on paper", "A plane", "A triangle"], answer: "A dot on paper" },
    { question: "What is a line segment?", options: ["A line with no endpoints", "A part of a line with two endpoints", "A curved line", "A point"], answer: "A part of a line with two endpoints" },
    { question: "What does Euclid's second postulate state?", options: ["A line can be extended indefinitely", "All right angles are equal", "A circle can be drawn with any radius", "Two lines intersect at a point"], answer: "A line can be extended indefinitely" },
    { question: "What is the definition of a plane in Euclidean geometry?", options: ["A curved surface", "A flat surface extending indefinitely", "A single point", "A line segment"], answer: "A flat surface extending indefinitely" },
    { question: "Which of the following is NOT a Euclidean term?", options: ["Point", "Line", "Plane", "Vector"], answer: "Vector" },
    { question: "What does Euclid's third postulate state?", options: ["A straight line can be drawn", "A circle can be drawn with any center and radius", "All right angles are equal", "A line can be extended"], answer: "A circle can be drawn with any center and radius" },
    { question: "What is a theorem?", options: ["A statement accepted without proof", "A statement proved using axioms and postulates", "A geometric figure", "A conjecture"], answer: "A statement proved using axioms and postulates" },
    { question: "Which postulate states that all right angles are equal?", options: ["First", "Second", "Third", "Fourth"], answer: "Fourth" },
    { question: "What is a geometric point?", options: ["A shape with area", "A location with no size", "A line segment", "A plane"], answer: "A location with no size" },
    { question: "What does Euclid's fifth postulate deal with?", options: ["Circles", "Parallel lines", "Right angles", "Line segments"], answer: "Parallel lines" },
    { question: "Which of the following is a basic undefined term in Euclidean geometry?", options: ["Triangle", "Point", "Angle", "Circle"], answer: "Point" }
  ],
  level2: [
    { question: "Which Euclid's postulate is also known as the parallel postulate?", options: ["First", "Second", "Fourth", "Fifth"], answer: "Fifth" },
    { question: "What does Euclid's fifth postulate state?", options: ["A circle can be drawn with any radius", "If a line intersects two lines and makes interior angles less than 180°, the lines meet", "All right angles are equal", "A line can be extended indefinitely"], answer: "If a line intersects two lines and makes interior angles less than 180°, the lines meet" },
    { question: "Which of the following is an axiom mentioned in NCERT?", options: ["The whole is greater than the part", "All triangles are congruent", "A circle can be drawn", "All angles are equal"], answer: "The whole is greater than the part" },
    { question: "How many points are needed to define a line segment?", options: ["1", "2", "3", "4"], answer: "2" },
    { question: "Which axiom states that things equal to the same thing are equal to one another?", options: ["First", "Second", "Third", "Fourth"], answer: "First" },
    { question: "What is the implication of Euclid's fourth postulate?", options: ["All circles are equal", "All right angles are equal", "All lines are equal", "All points are equal"], answer: "All right angles are equal" },
    { question: "Which of the following is a correct statement about a point?", options: ["It has length and width", "It has no dimensions", "It has area", "It is a line"], answer: "It has no dimensions" },
    { question: "How many dimensions does a plane have in Euclidean geometry?", options: ["1", "2", "3", "0"], answer: "2" },
    { question: "Which axiom states that if equals are added to equals, the results are equal?", options: ["First", "Second", "Third", "Fourth"], answer: "Second" },
    { question: "What is true about a line in Euclidean geometry?", options: ["It has a fixed length", "It extends indefinitely in both directions", "It has one endpoint", "It is curved"], answer: "It extends indefinitely in both directions" },
    { question: "Which of the following is NOT an axiom in NCERT Chapter 5?", options: ["The whole is greater than the part", "Things equal to the same thing are equal", "All right angles are equal", "Equals added to equals are equal"], answer: "All right angles are equal" },
    { question: "How many points determine a unique plane?", options: ["2", "3", "4", "1"], answer: "3" },
    { question: "Which postulate allows you to extend a line segment indefinitely?", options: ["First", "Second", "Third", "Fourth"], answer: "Second" },
    { question: "What is the significance of Euclid's postulates?", options: ["They are theorems", "They form the basis of Euclidean geometry", "They are conjectures", "They are definitions"], answer: "They form the basis of Euclidean geometry" },
    { question: "Which axiom states that if equals are subtracted from equals, the results are equal?", options: ["First", "Second", "Third", "Fourth"], answer: "Third" },
    { question: "What is true about a ray in Euclidean geometry?", options: ["It has two endpoints", "It extends indefinitely in one direction", "It is a plane", "It has no endpoints"], answer: "It extends indefinitely in one direction" },
    { question: "Which of Euclid's postulates is used to draw a circle?", options: ["First", "Second", "Third", "Fourth"], answer: "Third" },
    { question: "What does the term 'undefined' mean in Euclidean geometry?", options: ["Terms that are proved", "Terms accepted without definition", "Terms that are theorems", "Terms that are false"], answer: "Terms accepted without definition" },
    { question: "Which axiom states that the whole is equal to the sum of its parts?", options: ["Fifth", "Sixth", "Seventh", "Fourth"], answer: "Seventh" },
    { question: "What is the role of axioms in geometry?", options: ["They are proven statements", "They are accepted as true without proof", "They are theorems", "They are postulates"], answer: "They are accepted as true without proof" }
  ],
  level3: [
    { question: "Which of the following statements is equivalent to Euclid's fifth postulate?", options: ["The sum of angles in a triangle is 180°", "A straight line can be drawn between two points", "All right angles are equal", "A circle can be drawn with any radius"], answer: "The sum of angles in a triangle is 180°" },
    { question: "If two lines are intersected by a transversal and the alternate interior angles are equal, what can be inferred?", options: ["The lines are perpendicular", "The lines are parallel", "The lines intersect", "The lines are curved"], answer: "The lines are parallel" },
    { question: "Which axiom would you use to prove that if a = b and b = c, then a = c?", options: ["First", "Second", "Third", "Fourth"], answer: "First" },
    { question: "What is the significance of Euclid's parallel postulate in non-Euclidean geometry?", options: ["It is always true", "It is modified or replaced", "It is a theorem", "It is an axiom"], answer: "It is modified or replaced" },
    { question: "If a line segment AB is extended beyond B, what is formed?", options: ["A point", "A ray", "A plane", "A circle"], answer: "A ray" },
    { question: "Which of the following is a consequence of Euclid's postulates?", options: ["All triangles are congruent", "The sum of angles in a triangle is 180°", "All lines are parallel", "All points are equal"], answer: "The sum of angles in a triangle is 180°" },
    { question: "What happens if Euclid's fifth postulate is not assumed?", options: ["Euclidean geometry remains unchanged", "Non-Euclidean geometries arise", "All postulates become theorems", "Geometry becomes undefined"], answer: "Non-Euclidean geometries arise" },
    { question: "Which axiom is used to justify that 2 + 3 = 3 + 2?", options: ["First", "Second", "Third", "Fifth"], answer: "Fifth" },
    { question: "If two points A and B lie on a plane, how many lines can pass through them?", options: ["One", "Two", "Infinite", "None"], answer: "One" },
    { question: "Which postulate is used to construct a right angle?", options: ["First", "Second", "Third", "Fourth"], answer: "Fourth" },
    { question: "What is the implication of the axiom 'the whole is greater than the part'?", options: ["A line is longer than a point", "A line segment is part of a line", "A plane contains all points", "A circle is larger than a point"], answer: "A line segment is part of a line" },
    { question: "Which of the following is a derived result from Euclid's postulates?", options: ["A point has no size", "A line extends indefinitely", "The angles of a triangle sum to 180°", "A circle has a center"], answer: "The angles of a triangle sum to 180°" },
    { question: "If a transversal intersects two parallel lines, what is true about corresponding angles?", options: ["They are equal", "They are supplementary", "They are complementary", "They are unequal"], answer: "They are equal" },
    { question: "Which axiom supports the statement that if a = b, then a + c = b + c?", options: ["First", "Second", "Third", "Fourth"], answer: "Second" },
    { question: "What is the role of undefined terms in Euclidean geometry?", options: ["They are proved", "They form the foundation for definitions", "They are theorems", "They are postulates"], answer: "They form the foundation for definitions" },
    { question: "Which of the following is NOT a consequence of Euclid's postulates?", options: ["Parallel lines never meet", "The sum of angles in a triangle is 180°", "All circles are congruent", "All right angles are equal"], answer: "All circles are congruent" },
    { question: "If three points are non-collinear, what do they determine?", options: ["A line", "A plane", "A circle", "A ray"], answer: "A plane" },
    { question: "Which axiom is used to justify that if a = b, then a - c = b - c?", options: ["First", "Second", "Third", "Fourth"], answer: "Third" },
    { question: "What is the significance of Euclid's Elements?", options: ["It introduced algebra", "It systematized geometry", "It defined calculus", "It proved all theorems"], answer: "It systematized geometry" },
    { question: "If two lines are parallel, what is true about their slopes in Euclidean geometry?", options: ["They are equal", "They are opposite", "They are reciprocal", "They are zero"], answer: "They are equal" }
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