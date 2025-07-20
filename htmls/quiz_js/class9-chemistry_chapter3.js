// Quiz data for Atoms and Molecules (Class 9 Chemistry) with 3 levels
const quizData = {
  level1: [
    { question: "What is an atom?", options: ["Smallest unit of a compound", "Smallest unit of an element", "A mixture", "A solution"], answer: "Smallest unit of an element" },
    { question: "Who proposed the atomic theory?", options: ["Einstein", "Dalton", "Bohr", "Rutherford"], answer: "Dalton" },
    { question: "What is a molecule?", options: ["Single atom", "Group of atoms", "Mixture of elements", "Compound only"], answer: "Group of atoms" },
    { question: "Which particle has a positive charge?", options: ["Electron", "Proton", "Neutron", "Photon"], answer: "Proton" },
    { question: "What is the charge of an electron?", options: ["Positive", "Negative", "Neutral", "Zero"], answer: "Negative" },
    { question: "Which subatomic particle has no charge?", options: ["Proton", "Electron", "Neutron", "Positron"], answer: "Neutron" },
    { question: "What is the atomicity of oxygen gas (O₂)?", options: ["1", "2", "3", "4"], answer: "2" },
    { question: "What is the symbol for hydrogen?", options: ["H", "He", "O", "N"], answer: "H" },
    { question: "What is the mass number of an atom?", options: ["Protons only", "Electrons only", "Protons + Neutrons", "Electrons + Neutrons"], answer: "Protons + Neutrons" },
    { question: "Which element has an atomic number of 1?", options: ["Helium", "Hydrogen", "Oxygen", "Carbon"], answer: "Hydrogen" },
    { question: "What is the atomicity of ozone (O₃)?", options: ["1", "2", "3", "4"], answer: "3" },
    { question: "Which gas is diatomic?", options: ["Helium", "Nitrogen", "Argon", "Neon"], answer: "Nitrogen" },
    { question: "What is the charge of a neutron?", options: ["Positive", "Negative", "Neutral", "Variable"], answer: "Neutral" },
    { question: "What is the smallest particle of a compound?", options: ["Atom", "Molecule", "Ion", "Element"], answer: "Molecule" },
    { question: "Which scientist discovered the electron?", options: ["Rutherford", "Thomson", "Bohr", "Chadwick"], answer: "Thomson" },
    { question: "What is the symbol for carbon?", options: ["C", "Ca", "Co", "Cr"], answer: "C" },
    { question: "How many protons are in an atom of helium?", options: ["1", "2", "3", "4"], answer: "2" },
    { question: "What is the atomic number?", options: ["Number of neutrons", "Number of protons", "Number of electrons", "Total mass"], answer: "Number of protons" },
    { question: "Which is a monatomic gas?", options: ["Oxygen", "Hydrogen", "Helium", "Nitrogen"], answer: "Helium" },
    { question: "What is the mass of an electron compared to a proton?", options: ["Equal", "Much less", "Much more", "Double"], answer: "Much less" }
  ],
  level2: [
    { question: "What is the molar mass of water (H₂O)?", options: ["16 g/mol", "18 g/mol", "20 g/mol", "22 g/mol"], answer: "18 g/mol" },
    { question: "How many atoms are in one molecule of CO₂?", options: ["2", "3", "4", "5"], answer: "3" },
    { question: "What is the valency of oxygen?", options: ["1", "2", "3", "4"], answer: "2" },
    { question: "What is the molecular formula of glucose?", options: ["C₆H₁₂O₆", "C₆H₁₀O₅", "C₅H₁₂O₆", "C₇H₁₄O₆"], answer: "C₆H₁₂O₆" },
    { question: "What is the atomic mass of carbon-12?", options: ["12 u", "14 u", "16 u", "18 u"], answer: "12 u" },
    { question: "How many neutrons are in an atom of carbon-14?", options: ["6", "7", "8", "14"], answer: "8" },
    { question: "What is the valency of sodium?", options: ["1", "2", "3", "4"], answer: "1" },
    { question: "What is the molecular mass of O₂?", options: ["16 u", "32 u", "48 u", "64 u"], answer: "32 u" },
    { question: "Which element has an atomic number of 6?", options: ["Nitrogen", "Carbon", "Oxygen", "Hydrogen"], answer: "Carbon" },
    { question: "What is the number of electrons in a neutral atom of oxygen?", options: ["6", "8", "10", "12"], answer: "8" },
    { question: "What is the formula of magnesium oxide?", options: ["MgO", "Mg₂O", "MgO₂", "Mg(OH)₂"], answer: "MgO" },
    { question: "How many moles are in 18g of water?", options: ["1 mole", "2 moles", "0.5 mole", "1.5 moles"], answer: "1 mole" },
    { question: "What is the atomic mass of oxygen?", options: ["12 u", "16 u", "14 u", "18 u"], answer: "16 u" },
    { question: "What is the charge of an ion formed by sodium?", options: ["+1", "-1", "+2", "0"], answer: "+1" },
    { question: "What is the number of protons in an atom of nitrogen?", options: ["5", "7", "8", "14"], answer: "7" },
    { question: "What is the molecular formula of ammonia?", options: ["NH₃", "N₂H₄", "NH₄", "N₂H₂"], answer: "NH₃" },
    { question: "What is the valency of chlorine?", options: ["1", "2", "3", "4"], answer: "1" },
    { question: "How many electrons are in the outermost shell of neon?", options: ["2", "8", "10", "18"], answer: "8" },
    { question: "What is the mass of 1 mole of CO₂?", options: ["44 g", "32 g", "28 g", "16 g"], answer: "44 g" },
    { question: "What is the atomic number of nitrogen?", options: ["5", "6", "7", "8"], answer: "7" }
  ],
  level3: [
    { question: "What is the number of atoms in 0.5 mole of O₂?", options: ["6.022 × 10²³", "3.011 × 10²³", "1.505 × 10²³", "12.044 × 10²³"], answer: "3.011 × 10²³" },
    { question: "What is the empirical formula of C₆H₁₂O₆?", options: ["CH₂O", "C₂H₄O₂", "C₃H₆O₃", "CH₃O"], answer: "CH₂O" },
    { question: "What is the mass of 2 moles of H₂SO₄?", options: ["98 g", "196 g", "49 g", "294 g"], answer: "196 g" },
    { question: "How many electrons are in a chloride ion (Cl⁻)?", options: ["17", "18", "16", "19"], answer: "18" },
    { question: "What is the molar volume of a gas at STP?", options: ["22.4 L", "24 L", "20 L", "25 L"], answer: "22.4 L" },
    { question: "What is the oxidation number of oxygen in most compounds?", options: ["-1", "-2", "+1", "+2"], answer: "-2" },
    { question: "What is the number of neutrons in an atom of oxygen-17?", options: ["8", "9", "10", "17"], answer: "9" },
    { question: "What is the molecular mass of HNO₃?", options: ["47 u", "63 u", "80 u", "98 u"], answer: "63 u" },
    { question: "How many moles are in 22.4 L of nitrogen gas at STP?", options: ["1 mole", "2 moles", "0.5 mole", "1.5 moles"], answer: "1 mole" },
    { question: "What is the valency of iron in Fe₂O₃?", options: ["2", "3", "4", "6"], answer: "3" },
    { question: "What is the number of atoms in 1 molecule of H₂SO₄?", options: ["5", "7", "8", "9"], answer: "7" },
    { question: "What is the charge of a magnesium ion (Mg²⁺)?", options: ["+1", "+2", "-1", "-2"], answer: "+2" },
    { question: "What is the atomic mass of chlorine-35?", options: ["35 u", "37 u", "17 u", "18 u"], answer: "35 u" },
    { question: "How many electrons are in the valence shell of sulfur?", options: ["4", "6", "8", "2"], answer: "6" },
    { question: "What is the formula of aluminum oxide?", options: ["AlO", "Al₂O₃", "AlO₂", "Al₃O₂"], answer: "Al₂O₃" },
    { question: "What is the mass of 0.2 moles of CO₂?", options: ["8.8 g", "17.6 g", "26.4 g", "44 g"], answer: "8.8 g" },
    { question: "What is the number of neutrons in carbon-13?", options: ["6", "7", "13", "8"], answer: "7" },
    { question: "What is the oxidation number of hydrogen in H₂O?", options: ["+1", "-1", "0", "+2"], answer: "+1" },
    { question: "How many moles are in 36 g of water?", options: ["1 mole", "2 moles", "0.5 mole", "1.5 moles"], answer: "2 moles" },
    { question: "What is the atomic mass of sulfur?", options: ["32 u", "16 u", "64 u", "48 u"], answer: "32 u" }
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