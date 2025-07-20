// Quiz data for Is Matter Around Us Pure (Class 9 Chemistry) with 3 levels
const quizData = {
  level1: [
    { question: "What is a pure substance?", options: ["A mixture of two substances", "A single type of particle", "A solution", "A compound only"], answer: "A single type of particle" },
    { question: "Which of these is a mixture?", options: ["Water", "Salt", "Air", "Sugar"], answer: "Air" },
    { question: "What is the simplest form of matter?", options: ["Mixture", "Element", "Compound", "Solution"], answer: "Element" },
    { question: "Which is a homogeneous mixture?", options: ["Sand and water", "Salt water", "Oil and water", "Soil"], answer: "Salt water" },
    { question: "What is a solution?", options: ["A solid substance", "A homogeneous mixture", "A heterogeneous mixture", "A pure element"], answer: "A homogeneous mixture" },
    { question: "Which of these is a compound?", options: ["Oxygen", "Water", "Nitrogen", "Helium"], answer: "Water" },
    { question: "What separates the components of a mixture?", options: ["Chemical reaction", "Physical methods", "Heat", "Pressure"], answer: "Physical methods" },
    { question: "Which is a heterogeneous mixture?", options: ["Sugar solution", "Air", "Milk", "Salt solution"], answer: "Milk" },
    { question: "What is the solute in a salt solution?", options: ["Salt", "Water", "Air", "Sugar"], answer: "Salt" },
    { question: "Which method is used to separate salt from water?", options: ["Filtration", "Evaporation", "Distillation", "Sublimation"], answer: "Evaporation" },
    { question: "What is a suspension?", options: ["A clear solution", "A mixture where particles settle", "A gas", "A pure substance"], answer: "A mixture where particles settle" },
    { question: "Which is an example of a colloid?", options: ["Sugar solution", "Milk", "Salt water", "Pure water"], answer: "Milk" },
    { question: "What is the solvent in a sugar solution?", options: ["Sugar", "Water", "Air", "Salt"], answer: "Water" },
    { question: "Which process separates colors in ink?", options: ["Filtration", "Chromatography", "Distillation", "Evaporation"], answer: "Chromatography" },
    { question: "What is the Tyndall effect?", options: ["Scattering of light by particles", "Boiling of water", "Freezing of liquid", "Dissolving of salt"], answer: "Scattering of light by particles" },
    { question: "Which is not a property of a solution?", options: ["Homogeneous", "Transparent", "Settles on standing", "Stable"], answer: "Settles on standing" },
    { question: "What is a saturated solution?", options: ["No more solute can dissolve", "More solute can dissolve", "A gas solution", "A solid mixture"], answer: "No more solute can dissolve" },
    { question: "Which method separates immiscible liquids?", options: ["Filtration", "Distillation", "Separating funnel", "Evaporation"], answer: "Separating funnel" },
    { question: "What is an alloy?", options: ["A pure metal", "A mixture of metals", "A compound", "A solution"], answer: "A mixture of metals" },
    { question: "Which is a physical change?", options: ["Burning of paper", "Dissolving sugar in water", "Rusting of iron", "Cooking food"], answer: "Dissolving sugar in water" }
  ],
  level2: [
    { question: "What is the difference between a compound and a mixture?", options: ["Compounds are homogeneous, mixtures are not", "Compounds can be separated, mixtures cannot", "Compounds have fixed composition, mixtures do not", "Mixtures are pure, compounds are not"], answer: "Compounds have fixed composition, mixtures do not" },
    { question: "Which is an example of a suspension?", options: ["Salt water", "Mud water", "Sugar solution", "Air"], answer: "Mud water" },
    { question: "What is the process of separating a mixture using a filter?", options: ["Distillation", "Filtration", "Chromatography", "Evaporation"], answer: "Filtration" },
    { question: "Which gas is responsible for the Tyndall effect in air?", options: ["Oxygen", "Nitrogen", "Dust particles", "Carbon dioxide"], answer: "Dust particles" },
    { question: "What is the concentration of a solution?", options: ["Amount of solvent", "Amount of solute in a given solvent", "Amount of mixture", "Amount of water"], answer: "Amount of solute in a given solvent" },
    { question: "Which method separates two miscible liquids with different boiling points?", options: ["Filtration", "Distillation", "Chromatography", "Sublimation"], answer: "Distillation" },
    { question: "What is a true solution?", options: ["Particles settle on standing", "Particles are less than 1 nm", "Particles are visible", "Particles do not scatter light"], answer: "Particles are less than 1 nm" },
    { question: "Which is an example of a compound?", options: ["Air", "Sea water", "Carbon dioxide", "Soil"], answer: "Carbon dioxide" },
    { question: "What happens when a saturated solution is heated?", options: ["More solute dissolves", "Less solute dissolves", "No change", "Solution evaporates"], answer: "More solute dissolves" },
    { question: "Which is a physical method to separate a mixture?", options: ["Burning", "Electrolysis", "Centrifugation", "Decomposition"], answer: "Centrifugation" },
    { question: "What is the dispersed phase in a colloid?", options: ["Solvent", "Solute", "Dispersed particles", "Solution"], answer: "Dispersed particles" },
    { question: "Which mixture shows the Tyndall effect?", options: ["Salt solution", "Milk", "Sugar solution", "Water"], answer: "Milk" },
    { question: "What is the purpose of adding common salt to water in winter?", options: ["To increase boiling point", "To lower freezing point", "To increase density", "To make it pure"], answer: "To lower freezing point" },
    { question: "Which is a heterogeneous mixture of two liquids?", options: ["Vinegar", "Oil and water", "Alcohol and water", "Sugar syrup"], answer: "Oil and water" },
    { question: "What is the process of separating a mixture using a centrifuge?", options: ["Distillation", "Centrifugation", "Filtration", "Chromatography"], answer: "Centrifugation" },
    { question: "Which is not a characteristic of a colloid?", options: ["Particles are visible", "Scatters light", "Stable", "Particles are 1-1000 nm"], answer: "Particles are visible" },
    { question: "What is the solvent in brass (an alloy)?", options: ["Copper", "Zinc", "Tin", "Nickel"], answer: "Copper" },
    { question: "Which method separates a mixture based on density?", options: ["Filtration", "Distillation", "Centrifugation", "Chromatography"], answer: "Centrifugation" },
    { question: "What is the effect of temperature on solubility of solids?", options: ["Decreases", "Increases", "No effect", "Becomes zero"], answer: "Increases" },
    { question: "Which is an example of a homogeneous alloy?", options: ["Steel", "Sand and water", "Oil and vinegar", "Mud"], answer: "Steel" }
  ],
  level3: [
    { question: "What is the molarity of a solution with 1 mole of solute in 2 liters of solution?", options: ["0.5 M", "1 M", "2 M", "0.25 M"], answer: "0.5 M" },
    { question: "Which law explains the behavior of gases in a mixture?", options: ["Dalton's Law of Partial Pressures", "Boyle's Law", "Charles' Law", "Avogadro's Law"], answer: "Dalton's Law of Partial Pressures" },
    { question: "What is the percentage by mass of a solution with 10g solute in 90g solvent?", options: ["10%", "9.09%", "11.11%", "8.33%"], answer: "10%" },
    { question: "Which technique separates components based on their solubility?", options: ["Filtration", "Fractional distillation", "Chromatography", "Centrifugation"], answer: "Chromatography" },
    { question: "What is the effect of pressure on the solubility of gases?", options: ["Decreases", "Increases", "No effect", "Becomes zero"], answer: "Increases" },
    { question: "Which is a method to determine the purity of a substance?", options: ["Melting point test", "Boiling point test", "Both A and B", "Density test"], answer: "Both A and B" },
    { question: "What is the mole fraction of a component in a binary mixture?", options: ["Mass of component / Total mass", "Moles of component / Total moles", "Volume of component / Total volume", "None of these"], answer: "Moles of component / Total moles" },
    { question: "Which gas shows the Tyndall effect when mixed with water vapor?", options: ["Oxygen", "Nitrogen", "Smoke", "Carbon dioxide"], answer: "Smoke" },
    { question: "What is the process of separating a mixture using a magnet?", options: ["Magnetic separation", "Filtration", "Distillation", "Chromatography"], answer: "Magnetic separation" },
    { question: "Which factor affects the solubility of a solid in a liquid?", options: ["Pressure", "Temperature", "Both A and B", "Neither A nor B"], answer: "Temperature" },
    { question: "What is the normality of a 1 M H₂SO₄ solution?", options: ["1 N", "2 N", "0.5 N", "4 N"], answer: "2 N" },
    { question: "Which mixture can be separated by sublimation?", options: ["Salt and water", "Iodine and sand", "Sugar and water", "Oil and water"], answer: "Iodine and sand" },
    { question: "What is the effect of adding a non-volatile solute to a solvent?", options: ["Increases boiling point", "Decreases boiling point", "No effect", "Increases freezing point"], answer: "Increases boiling point" },
    { question: "Which is an example of a suspension that can be filtered?", options: ["Milk", "Chalk water", "Fog", "Gel"], answer: "Chalk water" },
    { question: "What is the principle behind fractional distillation?", options: ["Difference in boiling points", "Difference in density", "Difference in solubility", "Difference in color"], answer: "Difference in boiling points" },
    { question: "Which gas is used to detect leaks in a system?", options: ["Helium", "Nitrogen", "Oxygen", "Carbon dioxide"], answer: "Helium" },
    { question: "What is the mass percentage of a solution with 5g solute in 50g solution?", options: ["10%", "5%", "15%", "20%"], answer: "10%" },
    { question: "Which method separates a mixture based on particle size?", options: ["Sieving", "Distillation", "Centrifugation", "Chromatography"], answer: "Sieving" },
    { question: "What is the effect of temperature on the solubility of gases?", options: ["Increases", "Decreases", "No effect", "Doubles"], answer: "Decreases" },
    { question: "Which is a characteristic of a true solution?", options: ["Particles settle", "Particles are 100 nm", "Does not scatter light", "Visible to naked eye"], answer: "Does not scatter light" }
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

  // Toggle sidebar
  document.querySelector('.navbar-toggler').addEventListener('click', function () {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('main');
    sidebar.classList.toggle('active');
    main.classList.toggle('shifted');
  });

  // Responsive adjustment
  window.addEventListener('resize', function () {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('main');
    if (window.innerWidth >= 1024) {
      sidebar.classList.remove('active');
      main.classList.remove('shifted');
      main.style.marginLeft = '250px';
    } else if (window.innerWidth >= 768) {
      main.style.marginLeft = sidebar.classList.contains('active') ? '0' : '200px';
    } else {
      main.style.marginLeft = '0';
    }
  });

  // Initial load adjustment
  window.addEventListener('load', function () {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('main');
    if (window.innerWidth >= 1024) {
      main.style.marginLeft = '250px';
    } else if (window.innerWidth >= 768) {
      main.style.marginLeft = '200px';
    } else {
      main.style.marginLeft = '0';
    }
  });
});