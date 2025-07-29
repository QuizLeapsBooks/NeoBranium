// Quiz data for Surface Areas and Volumes (Class 9 Mathematics) with 3 levels
const quizData = {
  level1: [
    { question: "What is the total surface area of a cube with side 4 cm?", options: ["64 cm²", "96 cm²", "48 cm²", "16 cm²"], answer: "96 cm²" },
    { question: "What is the volume of a cuboid with length 5 cm, breadth 3 cm, and height 2 cm?", options: ["30 cm³", "60 cm³", "15 cm³", "10 cm³"], answer: "30 cm³" },
    { question: "What is the curved surface area of a cylinder with radius 7 cm and height 10 cm? (Use π = 22/7)", options: ["440 cm²", "220 cm²", "880 cm²", "154 cm²"], answer: "440 cm²" },
    { question: "What is the volume of a sphere with radius 3 cm? (Use π = 22/7)", options: ["36π cm³", "108π cm³", "27π cm³", "4π cm³"], answer: "36π cm³" },
    { question: "What is the total surface area of a cone with radius 6 cm and height 8 cm? (Use π = 22/7)", options: ["282.6 cm²", "188.4 cm²", "376.8 cm²", "94.2 cm²"], answer: "282.6 cm²" },
    { question: "What is the formula for the volume of a cylinder?", options: ["πr²h", "2πrh", "4/3πr³", "πr²"], answer: "πr²h" },
    { question: "What is the curved surface area of a hemisphere with radius 7 cm? (Use π = 22/7)", options: ["308 cm²", "154 cm²", "616 cm²", "462 cm²"], answer: "308 cm²" },
    { question: "What is the volume of a cube with side 5 cm?", options: ["125 cm³", "25 cm³", "100 cm³", "150 cm³"], answer: "125 cm³" },
    { question: "What is the lateral surface area of a cuboid with length 6 cm, breadth 4 cm, and height 3 cm?", options: ["60 cm²", "72 cm²", "48 cm²", "84 cm²"], answer: "60 cm²" },
    { question: "What is the total surface area of a sphere with radius 4 cm? (Use π = 22/7)", options: ["64π cm²", "32π cm²", "16π cm²", "48π cm²"], answer: "64π cm²" },
    { question: "What is the volume of a cone with radius 3 cm and height 4 cm? (Use π = 22/7)", options: ["12π cm³", "36π cm³", "9π cm³", "18π cm³"], answer: "12π cm³" },
    { question: "What is the curved surface area of a cone with radius 5 cm and height 12 cm? (Use π = 22/7)", options: ["130π cm²", "65π cm²", "195π cm²", "260π cm²"], answer: "65π cm²" },
    { question: "What is the total surface area of a cylinder with radius 5 cm and height 10 cm? (Use π = 22/7)", options: ["1100 cm²", "550 cm²", "220 cm²", "770 cm²"], answer: "550 cm²" },
    { question: "What is the volume of a hemisphere with radius 6 cm? (Use π = 22/7)", options: ["144π cm³", "72π cm³", "288π cm³", "36π cm³"], answer: "144π cm³" },
    { question: "What is the lateral surface area of a cylinder with radius 4 cm and height 7 cm? (Use π = 22/7)", options: ["176 cm²", "88 cm²", "352 cm²", "112 cm²"], answer: "176 cm²" },
    { question: "What is the total surface area of a cuboid with length 8 cm, breadth 6 cm, and height 4 cm?", options: ["208 cm²", "192 cm²", "160 cm²", "224 cm²"], answer: "208 cm²" },
    { question: "What is the volume of a sphere with radius 7 cm? (Use π = 22/7)", options: ["343π cm³", "686π cm³", "154π cm³", "98π cm³"], answer: "1437.33 cm³" },
    { question: "What is the curved surface area of a cone with radius 7 cm and height 24 cm? (Use π = 22/7)", options: ["550 cm²", "275 cm²", "825 cm²", "1100 cm²"], answer: "550 cm²" },
    { question: "What is the volume of a cuboid with dimensions 10 cm × 5 cm × 3 cm?", options: ["150 cm³", "180 cm³", "120 cm³", "200 cm³"], answer: "150 cm³" },
    { question: "What is the total surface area of a hemisphere with radius 3 cm? (Use π = 22/7)", options: ["27π cm²", "18π cm²", "36π cm²", "9π cm²"], answer: "27π cm²" }
  ],
  level2: [
    { question: "What is the total surface area of a cylinder with radius 7 cm and height 10 cm? (Use π = 22/7)", options: ["704 cm²", "616 cm²", "880 cm²", "528 cm²"], answer: "704 cm²" },
    { question: "What is the volume of a cone with radius 6 cm and height 8 cm? (Use π = 22/7)", options: ["96π cm³", "192π cm³", "48π cm³", "288π cm³"], answer: "96π cm³" },
    { question: "A cube has a volume of 64 cm³. What is its total surface area?", options: ["96 cm²", "64 cm²", "48 cm²", "128 cm²"], answer: "96 cm²" },
    { question: "What is the curved surface area of a hemisphere with radius 5 cm? (Use π = 22/7)", options: ["50π cm²", "100π cm²", "25π cm²", "75π cm²"], answer: "50π cm²" },
    { question: "What is the volume of a cylinder with radius 4 cm and height 9 cm? (Use π = 22/7)", options: ["144π cm³", "288π cm³", "72π cm³", "108π cm³"], answer: "144π cm³" },
    { question: "A cuboid has a total surface area of 148 cm² and dimensions 6 cm × 5 cm × h cm. What is the height h?", options: ["4 cm", "5 cm", "6 cm", "3 cm"], answer: "4 cm" },
    { question: "What is the total surface area of a cone with radius 4 cm and height 3 cm? (Use π = 22/7)", options: ["80 cm²", "60 cm²", "100 cm²", "40π cm²"], answer: "80 cm²" },
    { question: "What is the volume of a sphere with radius 6 cm? (Use π = 22/7)", options: ["288π cm³", "144π cm³", "864π cm³", "576π cm³"], answer: "288π cm³" },
    { question: "What is the lateral surface area of a cuboid with dimensions 7 cm × 4 cm × 5 cm?", options: ["110 cm²", "140 cm²", "94 cm²", "80 cm²"], answer: "110 cm²" },
    { question: "A cylinder has a volume of 616 cm³ and radius 7 cm. What is its height? (Use π = 22/7)", options: ["4 cm", "6 cm", "8 cm", "10 cm"], answer: "4 cm" },
    { question: "What is the total surface area of a hemisphere with radius 7 cm? (Use π = 22/7)", options: ["462 cm²", "308 cm²", "231 cm²", "154 cm²"], answer: "462 cm²" },
    { question: "What is the volume of a cuboid with dimensions 12 cm × 5 cm × 4 cm?", options: ["240 cm³", "180 cm³", "300 cm³", "200 cm³"], answer: "240 cm³" },
    { question: "What is the curved surface area of a cylinder with radius 3 cm and height 14 cm? (Use π = 22/7)", options: ["132 cm²", "264 cm²", "88 cm²", "176 cm²"], answer: "264 cm²" },
    { question: "A cone has a volume of 100π cm³ and height 12 cm. What is its radius? (Use π = 22/7)", options: ["5 cm", "4 cm", "3 cm", "6 cm"], answer: "5 cm" },
    { question: "What is the total surface area of a cube with volume 125 cm³?", options: ["150 cm²", "100 cm²", "125 cm²", "75 cm²"], answer: "150 cm²" },
    { question: "What is the volume of a hemisphere with radius 4 cm? (Use π = 22/7)", options: ["32π cm³", "64π cm³", "128π cm³", "16π cm³"], answer: "64π cm³" },
    { question: "What is the curved surface area of a cone with radius 6 cm and height 8 cm? (Use π = 22/7)", options: ["60π cm²", "120π cm²", "30π cm²", "90π cm²"], answer: "60π cm²" },
    { question: "A cuboid has a volume of 120 cm³ and dimensions 5 cm × 4 cm × h cm. What is the height h?", options: ["6 cm", "5 cm", "4 cm", "3 cm"], answer: "6 cm" },
    { question: "What is the total surface area of a cylinder with radius 4 cm and height 6 cm? (Use π = 22/7)", options: ["352 cm²", "256 cm²", "160 cm²", "208 cm²"], answer: "352 cm²" },
    { question: "What is the volume of a cone with radius 5 cm and height 12 cm? (Use π = 22/7)", options: ["100π cm³", "200π cm³", "50π cm³", "150π cm³"], answer: "100π cm³" }
  ],
  level3: [
    { question: "A cone with radius 6 cm and height 8 cm is cut by a plane parallel to its base at a height of 4 cm from the base. What is the volume of the smaller cone formed? (Use π = 22/7)", options: ["12π cm³", "24π cm³", "8π cm³", "16π cm³"], answer: "12π cm³" },
    { question: "A cylindrical tank with radius 7 cm and height 10 cm is filled with water. A sphere of radius 3.5 cm is submerged in it. What is the new height of water? (Use π = 22/7)", options: ["10.33 cm", "11 cm", "10.67 cm", "12 cm"], answer: "10.67 cm" },
    { question: "A cuboid with dimensions 10 cm × 8 cm × 6 cm has a cylindrical hole of radius 2 cm drilled through its height. What is the remaining volume?", options: ["480 - 24π cm³", "480 - 16π cm³", "480 - 32π cm³", "480 - 48π cm³"], answer: "480 - 24π cm³" },
    { question: "A hemisphere of radius 6 cm is placed on top of a cylinder of radius 6 cm and height 8 cm. What is the total surface area of the composite solid? (Use π = 22/7)", options: ["288π cm²", "216π cm²", "252π cm²", "324π cm²"], answer: "252π cm²" },
    { question: "A cone with radius 5 cm and height 12 cm is filled with water to half its height. What is the volume of water? (Use π = 22/7)", options: ["25π cm³", "50π cm³", "75π cm³", "100π cm³"], answer: "25π cm³" },
    { question: "A cube with side 10 cm has a hemispherical depression of radius 3 cm on one face. What is the volume of the remaining solid? (Use π = 22/7)", options: ["1000 - 18π cm³", "1000 - 36π cm³", "1000 - 9π cm³", "1000 - 27π cm³"], answer: "1000 - 18π cm³" },
    { question: "A cylindrical vessel with radius 7 cm and height 15 cm is filled with water. A cone with radius 3.5 cm and height 6 cm is submerged. What is the rise in water level? (Use π = 22/7)", options: ["0.5 cm", "1 cm", "0.75 cm", "1.5 cm"], answer: "0.5 cm" },
    { question: "A solid consists of a cylinder with radius 4 cm and height 10 cm, with a hemisphere of radius 4 cm on one end. What is the total surface area? (Use π = 22/7)", options: ["208π cm²", "192π cm²", "176π cm²", "224π cm²"], answer: "208π cm²" },
    { question: "A cone with radius 6 cm and height 9 cm is cut by a plane parallel to its base at one-third of its height from the base. What is the curved surface area of the smaller cone? (Use π = 22/7)", options: ["20π cm²", "15π cm²", "30π cm²", "10π cm²"], answer: "15π cm²" },
    { question: "A cuboid with dimensions 12 cm × 8 cm × 6 cm has two cylindrical holes of radius 2 cm drilled through its length. What is the remaining volume?", options: ["576 - 64π cm³", "576 - 32π cm³", "576 - 48π cm³", "576 - 96π cm³"], answer: "576 - 64π cm³" },
    { question: "A sphere of radius 5 cm is melted and recast into a cone with radius 5 cm. What is the height of the cone? (Use π = 22/7)", options: ["20 cm", "15 cm", "10 cm", "25 cm"], answer: "20 cm" },
    { question: "A cylindrical tank with radius 10 cm and height 14 cm is filled with water. Three spheres of radius 2 cm each are submerged. What is the new water level? (Use π = 22/7)", options: ["14.16 cm", "14.32 cm", "14.48 cm", "14.64 cm"], answer: "14.32 cm" },
    { question: "A cone with radius 8 cm and height 15 cm is filled with water. A sphere of radius 4 cm is submerged. What is the volume of water displaced? (Use π = 22/7)", options: ["256π/3 cm³", "128π/3 cm³", "512π/3 cm³", "64π/3 cm³"], answer: "256π/3 cm³" },
    { question: "A solid consists of a cylinder with radius 5 cm and height 10 cm, topped with a cone of radius 5 cm and height 6 cm. What is the total volume? (Use π = 22/7)", options: ["300π cm³", "350π cm³", "400π cm³", "450π cm³"], answer: "350π cm³" },
    { question: "A cuboid with dimensions 15 cm × 10 cm × 5 cm has a hemispherical depression of radius 2.5 cm on one face. What is the remaining volume?", options: ["750 - 25π/3 cm³", "750 - 50π/3 cm³", "750 - 100π/3 cm³", "750 - 125π/3 cm³"], answer: "750 - 25π/3 cm³" },
    { question: "A cylinder with radius 6 cm and height 12 cm is cut by a plane parallel to its base at a height of 4 cm from the base. What is the volume of the smaller cylinder formed?", options: ["288π cm³", "96π cm³", "144π cm³", "72π cm³"], answer: "96π cm³" },
    { question: "A cone with radius 7 cm and height 24 cm is filled with water to one-third of its height. What is the volume of water? (Use π = 22/7)", options: ["98π cm³", "49π cm³", "147π cm³", "196π cm³"], answer: "49π cm³" },
    { question: "A solid consists of a hemisphere of radius 5 cm on top of a cylinder of radius 5 cm and height 8 cm. What is the total surface area? (Use π = 22/7)", options: ["225π cm²", "200π cm²", "175π cm²", "250π cm²"], answer: "225π cm²" },
    { question: "A cuboid with dimensions 10 cm × 6 cm × 4 cm has a cylindrical hole of radius 1 cm drilled through its height. What is the remaining volume?", options: ["240 - 4π cm³", "240 - 8π cm³", "240 - 12π cm³", "240 - 16π cm³"], answer: "240 - 4π cm³" },
    { question: "A sphere of radius 6 cm is melted and recast into a cylinder with radius 4 cm. What is the height of the cylinder? (Use π = 22/7)", options: ["16 cm", "18 cm", "20 cm", "22 cm"], answer: "18 cm" }
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