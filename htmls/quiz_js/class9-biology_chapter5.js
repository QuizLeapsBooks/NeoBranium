// Quiz data for Natural Resources (Class 9 Biology) with 3 levels
const quizData = {
  level1: [
    {
      question: "What is the primary source of energy for Earth?",
      options: ["Sun", "Wind", "Water", "Coal"],
      answer: "Sun"
    },
    {
      question: "Which gas makes up the majority of the atmosphere?",
      options: ["Nitrogen", "Oxygen", "Carbon Dioxide", "Argon"],
      answer: "Nitrogen"
    },
    {
      question: "What is the main source of freshwater?",
      options: ["Rivers and Lakes", "Oceans", "Groundwater", "Rain"],
      answer: "Rivers and Lakes"
    },
    {
      question: "Which resource is renewable?",
      options: ["Solar Energy", "Coal", "Petroleum", "Natural Gas"],
      answer: "Solar Energy"
    },
    {
      question: "What is the process by which plants make food?",
      options: ["Photosynthesis", "Respiration", "Transpiration", "Digestion"],
      answer: "Photosynthesis"
    },
    {
      question: "Which gas is essential for respiration?",
      options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"],
      answer: "Oxygen"
    },
    {
      question: "What is the largest natural reservoir of carbon?",
      options: ["Oceans", "Soil", "Forests", "Atmosphere"],
      answer: "Oceans"
    },
    {
      question: "Which resource is non-renewable?",
      options: ["Oil", "Wind", "Solar", "Tidal"],
      answer: "Oil"
    },
    {
      question: "What is the main source of soil formation?",
      options: ["Weathering of rocks", "Volcanic eruptions", "Rainfall", "Wind"],
      answer: "Weathering of rocks"
    },
    {
      question: "Which process releases carbon dioxide into the atmosphere?",
      options: ["Respiration", "Photosynthesis", "Evaporation", "Condensation"],
      answer: "Respiration"
    },
    {
      question: "What is the primary source of energy for the water cycle?",
      options: ["Sun", "Wind", "Earth's core", "Moon"],
      answer: "Sun"
    },
    {
      question: "Which gas is a greenhouse gas?",
      options: ["Carbon Dioxide", "Oxygen", "Nitrogen", "Helium"],
      answer: "Carbon Dioxide"
    },
    {
      question: "What is the main component of natural gas?",
      options: ["Methane", "Ethane", "Propane", "Butane"],
      answer: "Methane"
    },
    {
      question: "Which resource is formed from dead plants and animals?",
      options: ["Fossil Fuels", "Solar Energy", "Wind Energy", "Hydropower"],
      answer: "Fossil Fuels"
    },
    {
      question: "What is the process of water loss from plants?",
      options: ["Transpiration", "Photosynthesis", "Respiration", "Evaporation"],
      answer: "Transpiration"
    },
    {
      question: "Which layer of the atmosphere contains the ozone layer?",
      options: ["Stratosphere", "Troposphere", "Mesosphere", "Thermosphere"],
      answer: "Stratosphere"
    },
    {
      question: "What is the primary source of oxygen in the atmosphere?",
      options: ["Plants", "Animals", "Volcanoes", "Oceans"],
      answer: "Plants"
    },
    {
      question: "Which resource is used to generate hydroelectric power?",
      options: ["Water", "Wind", "Sun", "Coal"],
      answer: "Water"
    },
    {
      question: "What is the main cause of soil erosion?",
      options: ["Deforestation", "Irrigation", "Fertilization", "Cultivation"],
      answer: "Deforestation"
    },
    {
      question: "Which gas helps in the formation of acid rain?",
      options: ["Sulfur Dioxide", "Oxygen", "Nitrogen", "Argon"],
      answer: "Sulfur Dioxide"
    }
  ],
  level2: [
    {
      question: "Which cycle involves the movement of water between Earth and the atmosphere?",
      options: ["Water Cycle", "Carbon Cycle", "Nitrogen Cycle", "Oxygen Cycle"],
      answer: "Water Cycle"
    },
    {
      question: "What is the role of decomposers in the nitrogen cycle?",
      options: ["Break down dead matter", "Fix nitrogen", "Release oxygen", "Absorb carbon"],
      answer: "Break down dead matter"
    },
    {
      question: "Which process converts nitrogen gas into compounds plants can use?",
      options: ["Nitrogen Fixation", "Denitrification", "Ammonification", "Nitrification"],
      answer: "Nitrogen Fixation"
    },
    {
      question: "What is the main source of energy for the carbon cycle?",
      options: ["Sun", "Wind", "Geothermal", "Tides"],
      answer: "Sun"
    },
    {
      question: "Which resource is depleted by excessive mining?",
      options: ["Minerals", "Wind", "Solar", "Rain"],
      answer: "Minerals"
    },
    {
      question: "What is the primary cause of the greenhouse effect?",
      options: ["Burning fossil fuels", "Plant growth", "Water evaporation", "Soil erosion"],
      answer: "Burning fossil fuels"
    },
    {
      question: "Which layer of the atmosphere is closest to Earth?",
      options: ["Troposphere", "Stratosphere", "Mesosphere", "Thermosphere"],
      answer: "Troposphere"
    },
    {
      question: "What is the role of forests in the water cycle?",
      options: ["Regulate water flow", "Produce oxygen only", "Store carbon only", "Prevent erosion"],
      answer: "Regulate water flow"
    },
    {
      question: "Which gas is released during the combustion of coal?",
      options: ["Carbon Dioxide", "Oxygen", "Nitrogen", "Hydrogen"],
      answer: "Carbon Dioxide"
    },
    {
      question: "What is the main source of groundwater recharge?",
      options: ["Rainfall", "Rivers", "Oceans", "Lakes"],
      answer: "Rainfall"
    },
    {
      question: "Which process returns nitrogen to the atmosphere?",
      options: ["Denitrification", "Nitrogen Fixation", "Ammonification", "Nitrification"],
      answer: "Denitrification"
    },
    {
      question: "What is the primary source of energy for wind power?",
      options: ["Sun", "Moon", "Earth's core", "Ocean currents"],
      answer: "Sun"
    },
    {
      question: "Which resource is affected by overgrazing?",
      options: ["Soil", "Water", "Air", "Minerals"],
      answer: "Soil"
    },
    {
      question: "What is the role of the ozone layer?",
      options: ["Protects from UV rays", "Regulates temperature", "Produces oxygen", "Stores water"],
      answer: "Protects from UV rays"
    },
    {
      question: "Which gas is a major component of the biogeochemical cycle?",
      options: ["Carbon Dioxide", "Helium", "Neon", "Krypton"],
      answer: "Carbon Dioxide"
    },
    {
      question: "What is the main cause of water pollution?",
      options: ["Industrial waste", "Rainfall", "Wind", "Photosynthesis"],
      answer: "Industrial waste"
    },
    {
      question: "Which resource is conserved by rainwater harvesting?",
      options: ["Water", "Soil", "Air", "Minerals"],
      answer: "Water"
    },
    {
      question: "What is the role of bacteria in the nitrogen cycle?",
      options: ["Convert nitrogen compounds", "Produce oxygen", "Store carbon", "Decompose water"],
      answer: "Convert nitrogen compounds"
    },
    {
      question: "Which process involves the movement of carbon through living organisms?",
      options: ["Carbon Cycle", "Water Cycle", "Nitrogen Cycle", "Oxygen Cycle"],
      answer: "Carbon Cycle"
    },
    {
      question: "What is the primary source of energy for tidal power?",
      options: ["Moon", "Sun", "Wind", "Earth's core"],
      answer: "Moon"
    }
  ],
  level3: [
    {
      question: "Which cycle is most affected by deforestation?",
      options: ["Carbon Cycle", "Water Cycle", "Nitrogen Cycle", "Oxygen Cycle"],
      answer: "Carbon Cycle"
    },
    {
      question: "What is the role of legumes in the nitrogen cycle?",
      options: ["Nitrogen fixation", "Denitrification", "Ammonification", "Nitrification"],
      answer: "Nitrogen fixation"
    },
    {
      question: "Which process releases nitrogen compounds into the soil?",
      options: ["Ammonification", "Nitrogen Fixation", "Denitrification", "Photosynthesis"],
      answer: "Ammonification"
    },
    {
      question: "What is the main sink for atmospheric carbon dioxide?",
      options: ["Oceans", "Forests", "Soil", "Rocks"],
      answer: "Oceans"
    },
    {
      question: "Which resource is most depleted by urbanization?",
      options: ["Land", "Water", "Air", "Minerals"],
      answer: "Land"
    },
    {
      question: "What is the primary cause of ozone layer depletion?",
      options: ["CFCs", "Carbon Dioxide", "Methane", "Oxygen"],
      answer: "CFCs"
    },
    {
      question: "Which layer of the atmosphere contains the ionosphere?",
      options: ["Thermosphere", "Stratosphere", "Troposphere", "Mesosphere"],
      answer: "Thermosphere"
    },
    {
      question: "What is the role of phytoplankton in the carbon cycle?",
      options: ["Absorb carbon dioxide", "Release oxygen", "Fix nitrogen", "Decompose water"],
      answer: "Absorb carbon dioxide"
    },
    {
      question: "Which gas is released during volcanic eruptions?",
      options: ["Carbon Dioxide", "Helium", "Nitrogen", "Argon"],
      answer: "Carbon Dioxide"
    },
    {
      question: "What is the main source of mineral depletion?",
      options: ["Mining", "Rainfall", "Wind erosion", "Photosynthesis"],
      answer: "Mining"
    },
    {
      question: "Which process converts ammonia into nitrites?",
      options: ["Nitrification", "Denitrification", "Nitrogen Fixation", "Ammonification"],
      answer: "Nitrification"
    },
    {
      question: "What is the primary source of energy for geothermal power?",
      options: ["Earth's core", "Sun", "Moon", "Wind"],
      answer: "Earth's core"
    },
    {
      question: "Which resource is conserved by afforestation?",
      options: ["Soil", "Water", "Air", "Minerals"],
      answer: "Soil"
    },
    {
      question: "What is the role of the carbon cycle in climate change?",
      options: ["Regulates CO2 levels", "Increases oxygen", "Reduces water", "Stores nitrogen"],
      answer: "Regulates CO2 levels"
    },
    {
      question: "Which gas contributes to global warming?",
      options: ["Methane", "Oxygen", "Nitrogen", "Helium"],
      answer: "Methane"
    },
    {
      question: "What is the main cause of air pollution?",
      options: ["Vehicle emissions", "Rainfall", "Plant growth", "Wind"],
      answer: "Vehicle emissions"
    },
    {
      question: "Which resource is replenished by the rock cycle?",
      options: ["Minerals", "Water", "Air", "Soil"],
      answer: "Minerals"
    },
    {
      question: "What is the role of fungi in the carbon cycle?",
      options: ["Decompose organic matter", "Fix nitrogen", "Produce oxygen", "Absorb water"],
      answer: "Decompose organic matter"
    },
    {
      question: "Which process involves the movement of nitrogen through the ecosystem?",
      options: ["Nitrogen Cycle", "Water Cycle", "Carbon Cycle", "Oxygen Cycle"],
      answer: "Nitrogen Cycle"
    },
    {
      question: "What is the primary source of energy for the oxygen cycle?",
      options: ["Sun", "Moon", "Earth's core", "Wind"],
      answer: "Sun"
    }
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
    const sidebar = document.queryselector('.sidebar');
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