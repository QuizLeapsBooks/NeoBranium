// Quiz data for Structure of the Atom (Class 9 Chemistry) with 3 levels
const quizData = {
  level1: [
    { question: "What is the center of an atom called?", options: ["Nucleus", "Electron cloud", "Orbit", "Shell"], answer: "Nucleus" },
    { question: "Who discovered the nucleus?", options: ["Thomson", "Rutherford", "Bohr", "Chadwick"], answer: "Rutherford" },
    { question: "What are the negatively charged particles in an atom?", options: ["Protons", "Neutrons", "Electrons", "Positrons"], answer: "Electrons" },
    { question: "Where are protons located in an atom?", options: ["Orbit", "Nucleus", "Shell", "Electron cloud"], answer: "Nucleus" },
    { question: "What is the charge of a proton?", options: ["Negative", "Neutral", "Positive", "Zero"], answer: "Positive" },
    { question: "Who proposed the planetary model of the atom?", options: ["Dalton", "Bohr", "Rutherford", "Thomson"], answer: "Bohr" },
    { question: "What is the mass of an electron compared to a proton?", options: ["Equal", "Much less", "Much more", "Half"], answer: "Much less" },
    { question: "Which subatomic particle determines the atomic number?", options: ["Electron", "Proton", "Neutron", "Positron"], answer: "Proton" },
    { question: "What is the maximum number of electrons in the first shell?", options: ["2", "8", "18", "32"], answer: "2" },
    { question: "Which model described the atom as a plum pudding?", options: ["Dalton’s model", "Thomson’s model", "Bohr’s model", "Rutherford’s model"], answer: "Thomson’s model" },
    { question: "What is the charge of the nucleus?", options: ["Negative", "Neutral", "Positive", "Variable"], answer: "Positive" },
    { question: "Who discovered the neutron?", options: ["Rutherford", "Chadwick", "Bohr", "Thomson"], answer: "Chadwick" },
    { question: "What is the maximum number of electrons in the second shell?", options: ["2", "8", "18", "32"], answer: "8" },
    { question: "Which part of the atom has most of its mass?", options: ["Electron cloud", "Nucleus", "Orbit", "Shell"], answer: "Nucleus" },
    { question: "What is the charge of a neutron?", options: ["Positive", "Negative", "Neutral", "Variable"], answer: "Neutral" },
    { question: "Which scientist’s experiment used gold foil?", options: ["Thomson", "Rutherford", "Bohr", "Chadwick"], answer: "Rutherford" },
    { question: "What are the orbits around the nucleus called?", options: ["Shells", "Clouds", "Rings", "Layers"], answer: "Shells" },
    { question: "Which particle is lightest?", options: ["Proton", "Neutron", "Electron", "Nucleus"], answer: "Electron" },
    { question: "What is the atomic number of an element?", options: ["Number of neutrons", "Number of protons", "Total mass", "Number of electrons"], answer: "Number of protons" },
    { question: "Which model has electrons in fixed orbits?", options: ["Thomson’s model", "Rutherford’s model", "Bohr’s model", "Dalton’s model"], answer: "Bohr’s model" }
  ],
  level2: [
    { question: "What is the maximum number of electrons in the third shell?", options: ["8", "18", "32", "50"], answer: "18" },
    { question: "How many electrons can the fourth shell hold?", options: ["18", "32", "50", "72"], answer: "32" },
    { question: "What is the mass number of an atom with 8 protons and 8 neutrons?", options: ["8", "16", "24", "32"], answer: "16" },
    { question: "What is an isotope?", options: ["Same protons, different neutrons", "Different protons, same neutrons", "Same electrons, different protons", "Different atoms"], answer: "Same protons, different neutrons" },
    { question: "Which isotope of carbon is used for dating?", options: ["Carbon-12", "Carbon-13", "Carbon-14", "Carbon-16"], answer: "Carbon-14" },
    { question: "What is the electron configuration of sodium (Na)?", options: ["2, 8, 1", "2, 8, 2", "2, 7", "2, 8, 3"], answer: "2, 8, 1" },
    { question: "What is the valency of an element with 7 electrons in its outermost shell?", options: ["1", "2", "3", "7"], answer: "1" },
    { question: "Which subatomic particle orbits the nucleus?", options: ["Proton", "Neutron", "Electron", "Positron"], answer: "Electron" },
    { question: "What is the number of neutrons in an atom of chlorine-37?", options: ["17", "20", "37", "54"], answer: "20" },
    { question: "What did Rutherford’s gold foil experiment prove?", options: ["Atoms are indivisible", "Nucleus is positively charged", "Electrons are negatively charged", "Neutrons exist"], answer: "Nucleus is positively charged" },
    { question: "What is the electronic configuration of oxygen?", options: ["2, 6", "2, 8", "2, 4", "2, 8, 2"], answer: "2, 6" },
    { question: "How many protons are in an atom of oxygen-16?", options: ["8", "16", "24", "32"], answer: "8" },
    { question: "What is the mass of a proton in atomic mass units?", options: ["1 u", "0.0005 u", "1836 u", "0 u"], answer: "1 u" },
    { question: "Which shell is filled after the first shell in an atom?", options: ["K", "L", "M", "N"], answer: "L" },
    { question: "What is the number of electrons in a neutral atom of carbon?", options: ["6", "12", "14", "18"], answer: "6" },
    { question: "Which model introduced the concept of energy levels?", options: ["Thomson’s model", "Rutherford’s model", "Bohr’s model", "Chadwick’s model"], answer: "Bohr’s model" },
    { question: "What is the atomic number of an element with 10 electrons in a neutral atom?", options: ["8", "10", "18", "20"], answer: "10" },
    { question: "What is the charge of an alpha particle?", options: ["+2", "-1", "0", "-2"], answer: "+2" },
    { question: "How many electrons are in the valence shell of magnesium?", options: ["2", "8", "10", "12"], answer: "2" },
    { question: "What is the number of neutrons in an atom of helium-4?", options: ["2", "4", "6", "8"], answer: "2" }
  ],
  level3: [
    { question: "What is the electron configuration of chlorine (Cl)?", options: ["2, 8, 7", "2, 8, 8", "2, 7, 8", "2, 8, 6"], answer: "2, 8, 7" },
    { question: "What is the number of neutrons in an isotope of carbon-13?", options: ["6", "7", "13", "19"], answer: "7" },
    { question: "What is the mass number of an atom with 12 protons and 13 neutrons?", options: ["12", "13", "25", "1"], answer: "25" },
    { question: "What is the maximum number of electrons in the M shell?", options: ["8", "18", "32", "50"], answer: "18" },
    { question: "What is the charge of a beta particle?", options: ["+1", "-1", "0", "+2"], answer: "-1" },
    { question: "How many electrons are in the K, L, and M shells of argon?", options: ["2, 8, 8", "2, 8, 10", "2, 6, 8", "2, 8, 6"], answer: "2, 8, 8" },
    { question: "What is the atomic mass of an isotope with 15 protons and 16 neutrons?", options: ["15 u", "16 u", "31 u", "32 u"], answer: "31 u" },
    { question: "What did Chadwick’s experiment discover?", options: ["Proton", "Neutron", "Electron", "Nucleus"], answer: "Neutron" },
    { question: "What is the electron configuration of calcium (Ca)?", options: ["2, 8, 8, 2", "2, 8, 7, 2", "2, 8, 8, 1", "2, 8, 6, 2"], answer: "2, 8, 8, 2" },
    { question: "What is the number of electrons in the valence shell of phosphorus?", options: ["3", "5", "7", "15"], answer: "5" },
    { question: "What is the charge of a gamma ray?", options: ["+1", "-1", "0", "+2"], answer: "0" },
    { question: "How many protons are in an atom of phosphorus-31?", options: ["15", "16", "31", "46"], answer: "15" },
    { question: "What is the number of neutrons in an atom of uranium-238?", options: ["92", "146", "238", "330"], answer: "146" },
    { question: "What is the electronic configuration of aluminum?", options: ["2, 8, 3", "2, 8, 2", "2, 7, 3", "2, 8, 1"], answer: "2, 8, 3" },
    { question: "What is the mass of a neutron compared to an electron?", options: ["Equal", "Much less", "Much more", "Half"], answer: "Much more" },
    { question: "What is the number of electrons in the valence shell of sulfur?", options: ["4", "6", "8", "16"], answer: "6" },
    { question: "What is the atomic number of an element with 2 electrons in its K shell and 8 in its L shell?", options: ["8", "10", "18", "20"], answer: "10" },
    { question: "What is the number of neutrons in an atom of potassium-39?", options: ["19", "20", "39", "58"], answer: "20" },
    { question: "What is the charge of an ion formed by chlorine?", options: ["+1", "-1", "+2", "0"], answer: "-1" },
    { question: "What is the maximum number of electrons in the N shell?", options: ["18", "32", "50", "72"], answer: "32" }
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