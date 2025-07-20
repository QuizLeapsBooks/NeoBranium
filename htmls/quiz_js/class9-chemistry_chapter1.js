// Quiz data for Matter in Our Surroundings (Class 9 Chemistry) with 3 levels
const quizData = {
    level1: [
        { question: "What is matter?", options: ["Anything that has mass and occupies space", "Only gases", "Only liquids", "Only solids"], answer: "Anything that has mass and occupies space" },
        { question: "Which state of matter has no definite shape?", options: ["Solid", "Liquid", "Gas", "All of these"], answer: "Gas" },
        { question: "What is the freezing point of water?", options: ["0°C", "100°C", "50°C", "25°C"], answer: "0°C" },
        { question: "Which of these is a physical property of matter?", options: ["Density", "Combustibility", "Reactivity", "Toxicity"], answer: "Density" },
        { question: "What happens to matter when heated?", options: ["It contracts", "It expands", "It disappears", "It remains the same"], answer: "It expands" },
        { question: "Which state of matter has the least kinetic energy?", options: ["Solid", "Liquid", "Gas", "Plasma"], answer: "Solid" },
        { question: "What is the boiling point of water at standard pressure?", options: ["0°C", "100°C", "50°C", "25°C"], answer: "100°C" },
        { question: "Which of these is not a state of matter?", options: ["Solid", "Liquid", "Energy", "Gas"], answer: "Energy" },
        { question: "What is the process of changing liquid to gas called?", options: ["Melting", "Evaporation", "Freezing", "Condensation"], answer: "Evaporation" },
        { question: "Which has the highest density among the states of matter?", options: ["Gas", "Liquid", "Solid", "All are equal"], answer: "Solid" },
        { question: "What is the movement of particles in a gas?", options: ["Very slow", "Moderate", "Very fast", "Stationary"], answer: "Very fast" },
        { question: "Which factor affects the state of matter?", options: ["Temperature", "Color", "Taste", "Smell"], answer: "Temperature" },
        { question: "What is the process of changing gas to liquid?", options: ["Evaporation", "Condensation", "Sublimation", "Melting"], answer: "Condensation" },
        { question: "Which state of matter can be compressed easily?", options: ["Solid", "Liquid", "Gas", "All of these"], answer: "Gas" },
        { question: "What is the main component of air?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: "Nitrogen" },
        { question: "Which has the weakest intermolecular forces?", options: ["Solid", "Liquid", "Gas", "Plasma"], answer: "Gas" },
        { question: "What is the state of water at room temperature?", options: ["Solid", "Liquid", "Gas", "Plasma"], answer: "Liquid" },
        { question: "Which process changes solid directly to gas?", options: ["Melting", "Sublimation", "Condensation", "Evaporation"], answer: "Sublimation" },
        { question: "What is the effect of pressure on gases?", options: ["Increases volume", "Decreases volume", "No effect", "Increases density only"], answer: "Decreases volume" },
        { question: "Which has the most orderly arrangement of particles?", options: ["Gas", "Liquid", "Solid", "Plasma"], answer: "Solid" }
    ],
    level2: [
        { question: "What is the latent heat of fusion?", options: ["Heat required to melt a solid", "Heat required to boil a liquid", "Heat required to freeze a liquid", "Heat required to evaporate a gas"], answer: "Heat required to melt a solid" },
        { question: "Which gas is most abundant in the atmosphere?", options: ["Oxygen", "Nitrogen", "Argon", "Carbon dioxide"], answer: "Nitrogen" },
        { question: "What happens to the volume of a gas when pressure increases?", options: ["Increases", "Decreases", "Remains the same", "Doubles"], answer: "Decreases" },
        { question: "Which process involves the absorption of heat?", options: ["Freezing", "Condensation", "Evaporation", "Deposition"], answer: "Evaporation" },
        { question: "What is the effect of cooling on the kinetic energy of particles?", options: ["Increases", "Decreases", "Remains the same", "Becomes zero"], answer: "Decreases" },
        { question: "Which state of matter has the strongest intermolecular forces?", options: ["Gas", "Liquid", "Solid", "Plasma"], answer: "Solid" },
        { question: "What is the process of changing solid to liquid?", options: ["Melting", "Freezing", "Sublimation", "Condensation"], answer: "Melting" },
        { question: "Which factor does not affect the rate of evaporation?", options: ["Humidity", "Surface area", "Color of the liquid", "Temperature"], answer: "Color of the liquid" },
        { question: "What is the state of dry ice at room temperature?", options: ["Solid", "Liquid", "Gas", "Plasma"], answer: "Solid" },
        { question: "Which has the highest rate of diffusion?", options: ["Solid", "Liquid", "Gas", "All are equal"], answer: "Gas" },
        { question: "What is the effect of increasing pressure on the boiling point?", options: ["Decreases", "Increases", "No effect", "Becomes zero"], answer: "Increases" },
        { question: "Which property allows matter to change its state?", options: ["Mass", "Volume", "Density", "Heat energy"], answer: "Heat energy" },
        { question: "What is the state of matter of oxygen at -200°C?", options: ["Gas", "Liquid", "Solid", "Plasma"], answer: "Solid" },
        { question: "Which process releases heat?", options: ["Melting", "Evaporation", "Condensation", "Sublimation"], answer: "Condensation" },
        { question: "What is the effect of humidity on evaporation?", options: ["Increases", "Decreases", "No effect", "Doubles"], answer: "Decreases" },
        { question: "Which has the least intermolecular space?", options: ["Gas", "Liquid", "Solid", "Plasma"], answer: "Solid" },
        { question: "What is the process of gas changing to solid?", options: ["Deposition", "Sublimation", "Condensation", "Freezing"], answer: "Deposition" },
        { question: "Which gas turns lime water milky?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], answer: "Carbon dioxide" },
        { question: "What is the effect of surface area on evaporation?", options: ["Decreases", "Increases", "No effect", "Halves"], answer: "Increases" },
        { question: "Which state of matter has particles with maximum freedom?", options: ["Solid", "Liquid", "Gas", "Plasma"], answer: "Gas" }
    ],
    level3: [
        { question: "What is the latent heat of vaporization?", options: ["Heat to melt ice", "Heat to boil water", "Heat to freeze water", "Heat to condense steam"], answer: "Heat to boil water" },
        { question: "What is the approximate percentage of nitrogen in air?", options: ["21%", "78%", "1%", "0.03%"], answer: "78%" },
        { question: "How does pressure affect the melting point of ice?", options: ["Increases", "Decreases", "No effect", "Doubles"], answer: "Decreases" },
        { question: "What is the critical temperature of a substance?", options: ["Temperature above which it cannot be liquefied", "Temperature below which it freezes", "Temperature at which it boils", "Temperature at which it melts"], answer: "Temperature above which it cannot be liquefied" },
        { question: "Which gas law relates pressure and volume?", options: ["Charles' Law", "Boyle's Law", "Gay-Lussac's Law", "Avogadro's Law"], answer: "Boyle's Law" },
        { question: "What is the effect of altitude on boiling point?", options: ["Increases", "Decreases", "No effect", "Becomes zero"], answer: "Decreases" },
        { question: "Which process involves the direct conversion of solid to gas without melting?", options: ["Sublimation", "Evaporation", "Condensation", "Freezing"], answer: "Sublimation" },
        { question: "What is the molar volume of an ideal gas at STP?", options: ["22.4 L", "24 L", "20 L", "25 L"], answer: "22.4 L" },
        { question: "Which factor increases the rate of diffusion in gases?", options: ["Increase in pressure", "Decrease in temperature", "Increase in temperature", "Decrease in volume"], answer: "Increase in temperature" },
        { question: "What is the state of matter of carbon dioxide at -78°C and high pressure?", options: ["Gas", "Liquid", "Solid", "Plasma"], answer: "Solid" },
        { question: "Which property remains constant during a phase change?", options: ["Temperature", "Pressure", "Volume", "Density"], answer: "Temperature" },
        { question: "What is the effect of adding salt to water on its boiling point?", options: ["Decreases", "Increases", "No effect", "Halves"], answer: "Increases" },
        { question: "Which gas law relates volume and temperature?", options: ["Boyle's Law", "Charles' Law", "Avogadro's Law", "Dalton's Law"], answer: "Charles' Law" },
        { question: "What is the process of liquid changing to solid?", options: ["Freezing", "Melting", "Evaporation", "Sublimation"], answer: "Freezing" },
        { question: "Which has the highest vapor pressure at room temperature?", options: ["Water", "Mercury", "Alcohol", "Oil"], answer: "Alcohol" },
        { question: "What is the effect of intermolecular forces on boiling point?", options: ["Increases with stronger forces", "Decreases with stronger forces", "No effect", "Becomes zero"], answer: "Increases with stronger forces" },
        { question: "Which gas is used in fire extinguishers?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"], answer: "Carbon dioxide" },
        { question: "What is the state of matter of helium at -270°C?", options: ["Gas", "Liquid", "Solid", "Plasma"], answer: "Solid" },
        { question: "Which process is endothermic?", options: ["Condensation", "Freezing", "Evaporation", "Deposition"], answer: "Evaporation" },
        { question: "What is the effect of humidity on the rate of evaporation?", options: ["Increases", "Decreases", "No effect", "Doubles"], answer: "Decreases" }
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