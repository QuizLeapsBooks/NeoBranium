// Quiz data for Probability (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "A die is thrown once. What is the probability of getting a 6?", options: ["1/6", "1/3", "1/2", "1/4"], answer: "1/6" },
    { question: "A coin is tossed once. What is the probability of getting heads?", options: ["1/2", "1/3", "1/4", "1"], answer: "1/2" },
    { question: "In a deck of 52 cards, what is the probability of drawing an ace?", options: ["1/13", "1/52", "4/52", "1/4"], answer: "1/13" },
    { question: "A bag contains 5 red and 3 blue balls. What is the probability of drawing a red ball?", options: ["5/8", "3/8", "5/3", "3/5"], answer: "5/8" },
    { question: "A die is thrown 100 times, and a 3 appears 20 times. What is the empirical probability of getting a 3?", options: ["1/5", "1/6", "3/10", "1/3"], answer: "1/5" },
    { question: "What is the probability of an impossible event?", options: ["0", "1", "1/2", "1/3"], answer: "0" },
    { question: "What is the probability of a certain event?", options: ["1", "0", "1/2", "1/4"], answer: "1" },
    { question: "A coin is tossed twice. What is the probability of getting two heads?", options: ["1/4", "1/2", "1/3", "1/6"], answer: "1/4" },
    { question: "In a deck of 52 cards, what is the probability of drawing a heart?", options: ["1/4", "1/13", "1/52", "1/2"], answer: "1/4" },
    { question: "A bag contains 4 white and 6 black balls. What is the probability of drawing a white ball?", options: ["2/5", "3/5", "4/10", "6/10"], answer: "2/5" },
    { question: "A die is thrown 50 times, and a 5 appears 10 times. What is the empirical probability of getting a 5?", options: ["1/5", "1/6", "1/10", "1/4"], answer: "1/5" },
    { question: "A coin is tossed three times. What is the probability of getting at least one head?", options: ["7/8", "1/8", "3/8", "1/2"], answer: "7/8" },
    { question: "In a deck of 52 cards, what is the probability of drawing a king?", options: ["1/13", "1/52", "4/52", "1/4"], answer: "1/13" },
    { question: "A bag contains 2 red, 3 blue, and 5 green balls. What is the probability of drawing a blue ball?", options: ["3/10", "2/10", "5/10", "1/3"], answer: "3/10" },
    { question: "A die is thrown 200 times, and an even number appears 90 times. What is the empirical probability of getting an even number?", options: ["9/20", "1/2", "3/4", "2/5"], answer: "9/20" },
    { question: "A coin is tossed once. What is the probability of getting tails?", options: ["1/2", "1/3", "1/4", "1"], answer: "1/2" },
    { question: "In a deck of 52 cards, what is the probability of drawing a spade?", options: ["1/4", "1/13", "1/52", "1/2"], answer: "1/4" },
    { question: "A bag contains 6 red and 4 blue balls. What is the probability of drawing a red ball?", options: ["3/5", "2/5", "6/10", "4/10"], answer: "3/5" },
    { question: "A die is thrown 100 times, and a 1 appears 15 times. What is the empirical probability of getting a 1?", options: ["3/20", "1/6", "1/5", "1/10"], answer: "3/20" },
    { question: "A coin is tossed twice. What is the probability of getting at least one tail?", options: ["3/4", "1/4", "1/2", "1/3"], answer: "3/4" }
  ],
  level2: [
    { question: "A die is thrown twice. What is the probability of getting a sum of 7?", options: ["1/6", "1/12", "1/9", "1/3"], answer: "1/6" },
    { question: "A bag contains 3 red, 4 blue, and 5 green balls. What is the probability of drawing a red or blue ball?", options: ["7/12", "5/12", "3/12", "4/12"], answer: "7/12" },
    { question: "Two coins are tossed. What is the probability of getting exactly one head?", options: ["1/2", "1/4", "3/4", "1/3"], answer: "1/2" },
    { question: "In a deck of 52 cards, what is the probability of drawing a red card?", options: ["1/2", "1/4", "1/13", "1/26"], answer: "1/2" },
    { question: "A die is thrown 150 times, and a number greater than 4 appears 50 times. What is the empirical probability?", options: ["1/3", "1/2", "1/4", "2/3"], answer: "1/3" },
    { question: "A bag contains 2 white, 3 black, and 4 red balls. What is the probability of drawing a white or red ball?", options: ["2/3", "5/9", "4/9", "7/9"], answer: "2/3" },
    { question: "Three coins are tossed. What is the probability of getting exactly two heads?", options: ["3/8", "1/2", "1/4", "1/8"], answer: "3/8" },
    { question: "In a deck of 52 cards, what is the probability of drawing a face card (jack, queen, or king)?", options: ["3/13", "1/4", "1/13", "4/13"], answer: "3/13" },
    { question: "A die is thrown twice. What is the probability of getting a sum less than 5?", options: ["1/12", "1/9", "1/6", "1/4"], answer: "1/12" },
    { question: "A bag contains 5 red and 7 blue balls. What is the probability of drawing two red balls one after the other without replacement?", options: ["5/33", "10/33", "2/9", "1/6"], answer: "5/33" },
    { question: "Two coins are tossed. What is the probability of getting at least one head?", options: ["3/4", "1/4", "1/2", "1/3"], answer: "3/4" },
    { question: "In a deck of 52 cards, what is the probability of drawing a black ace?", options: ["1/26", "1/13", "1/52", "2/52"], answer: "1/26" },
    { question: "A die is thrown 200 times, and a prime number appears 80 times. What is the empirical probability?", options: ["2/5", "3/5", "1/3", "1/2"], answer: "2/5" },
    { question: "A bag contains 3 red, 2 blue, and 5 green balls. What is the probability of drawing a green ball?", options: ["1/2", "3/10", "2/5", "1/5"], answer: "1/2" },
    { question: "Three coins are tossed. What is the probability of getting at most one head?", options: ["1/2", "3/8", "1/4", "1/8"], answer: "1/2" },
    { question: "In a deck of 52 cards, what is the probability of drawing a diamond or a king?", options: ["4/13", "17/52", "16/52", "1/4"], answer: "4/13" },
    { question: "A die is thrown twice. What is the probability of getting a sum of 10?", options: ["1/12", "1/9", "1/6", "1/18"], answer: "1/12" },
    { question: "A bag contains 4 red and 6 blue balls. What is the probability of drawing two blue balls one after the other with replacement?", options: ["9/25", "3/5", "2/5", "36/100"], answer: "9/25" },
    { question: "Two coins are tossed. What is the probability of getting no heads?", options: ["1/4", "1/2", "3/4", "1/3"], answer: "1/4" },
    { question: "In a deck of 52 cards, what is the probability of drawing a queen or a heart?", options: ["4/13", "17/52", "16/52", "1/4"], answer: "4/13" }
  ],
  level3: [
    { question: "A bag contains 3 red, 4 blue, and 5 green balls. Two balls are drawn without replacement. What is the probability that both are of the same color?", options: ["17/66", "19/66", "7/22", "5/12"], answer: "17/66" },
    { question: "A die is thrown twice. What is the probability that the sum is divisible by 3 and greater than 6?", options: ["1/9", "2/9", "1/6", "1/12"], answer: "1/9" },
    { question: "In a deck of 52 cards, two cards are drawn without replacement. What is the probability that both are aces?", options: ["1/221", "1/169", "1/156", "1/132"], answer: "1/221" },
    { question: "A point is chosen randomly inside a square of side 4 cm. What is the probability that it lies within a circle of radius 2 cm inscribed in the square?", options: ["π/4", "π/8", "1/2", "1/4"], answer: "π/4" },
    { question: "Three coins are tossed. What is the probability of getting exactly two heads given that at least one head appears?", options: ["3/7", "1/2", "3/8", "1/3"], answer: "3/7" },
    { question: "A bag contains 5 red and 3 blue balls. Two balls are drawn with replacement. What is the probability that they are of different colors?", options: ["15/32", "5/8", "3/8", "1/2"], answer: "15/32" },
    { question: "Two dice are thrown. What is the probability that the product of the numbers is even?", options: ["3/4", "1/2", "1/4", "2/3"], answer: "3/4" },
    { question: "In a deck of 52 cards, three cards are drawn without replacement. What is the probability that all three are of the same suit?", options: ["44/850", "33/850", "22/850", "11/850"], answer: "44/850" },
    { question: "A point is chosen randomly inside a rectangle of dimensions 6 cm × 4 cm. What is the probability that it lies within a triangle formed by vertices (0,0), (6,0), and (0,4)?", options: ["1/2", "1/3", "1/4", "2/3"], answer: "1/2" },
    { question: "A bag contains 4 red, 3 blue, and 2 green balls. Three balls are drawn without replacement. What is the probability that all are of different colors?", options: ["8/21", "4/21", "2/7", "1/3"], answer: "8/21" },
    { question: "Two dice are thrown. What is the probability that the sum is 8 given that both numbers are even?", options: ["1/5", "2/5", "1/3", "1/4"], answer: "1/5" },
    { question: "In a deck of 52 cards, two cards are drawn with replacement. What is the probability that one is a king and the other is a queen?", options: ["8/169", "4/169", "16/169", "2/169"], answer: "8/169" },
    { question: "A point is chosen randomly on a line segment of length 10 cm. What is the probability that it lies within the middle 4 cm?", options: ["2/5", "1/5", "3/5", "4/5"], answer: "2/5" },
    { question: "A bag contains 6 red and 4 blue balls. Two balls are drawn without replacement. What is the probability that the second ball is blue given that the first is red?", options: ["4/9", "2/5", "1/3", "3/5"], answer: "4/9" },
    { question: "Three dice are thrown. What is the probability that the sum is 9?", options: ["25/216", "27/216", "23/216", "29/216"], answer: "25/216" },
    { question: "In a deck of 52 cards, two cards are drawn without replacement. What is the probability that one is a heart and the other is a spade?", options: ["13/102", "25/204", "1/4", "13/51"], answer: "13/102" },
    { question: "A point is chosen randomly inside a circle of radius 5 cm. What is the probability that it lies within a concentric circle of radius 3 cm?", options: ["9/25", "3/5", "16/25", "4/5"], answer: "9/25" },
    { question: "A bag contains 2 red, 3 blue, and 4 green balls. Two balls are drawn without replacement. What is the probability that at least one is red?", options: ["7/18", "11/18", "5/9", "4/9"], answer: "7/18" },
    { question: "Two coins are tossed, and a die is thrown. What is the probability of getting two heads and a number greater than 4?", options: ["1/12", "1/6", "1/4", "1/8"], answer: "1/12" },
    { question: "In a deck of 52 cards, three cards are drawn without replacement. What is the probability that exactly two are kings?", options: ["3/5525", "6/5525", "9/5525", "12/5525"], answer: "6/5525" }
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