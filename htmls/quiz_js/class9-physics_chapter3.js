// Quiz data for Gravitation (Class 9 Physics) with 3 levels
const quizData = {
  level1: [
    {
      question: "What is the force that attracts objects towards Earth?",
      options: ["Gravity", "Friction", "Tension", "Normal Force"],
      answer: "Gravity"
    },
    {
      question: "The universal law of gravitation was given by:",
      options: ["Isaac Newton", "Albert Einstein", "Galileo Galilei", "Johannes Kepler"],
      answer: "Isaac Newton"
    },
    {
      question: "Gravitational force depends on:",
      options: ["mass and distance", "velocity and time", "force and energy", "acceleration and mass"],
      answer: "mass and distance"
    },
    {
      question: "The SI unit of gravitational force is:",
      options: ["Newton", "Joule", "Watt", "Pascal"],
      answer: "Newton"
    },
    {
      question: "The value of acceleration due to gravity on Earth is approximately:",
      options: ["9.8 m/s²", "10 m/s²", "5 m/s²", "15 m/s²"],
      answer: "9.8 m/s²"
    },
    {
      question: "Weight is the force due to:",
      options: ["gravity", "friction", "inertia", "momentum"],
      answer: "gravity"
    },
    {
      question: "The mass of an object is the same on:",
      options: ["Earth and Moon", "only Earth", "only Moon", "neither"],
      answer: "Earth and Moon"
    },
    {
      question: "The force of gravity decreases with:",
      options: ["increase in distance", "decrease in distance", "increase in mass", "decrease in mass"],
      answer: "increase in distance"
    },
    {
      question: "The weight of an object on the Moon is less because:",
      options: ["gravity is less", "mass is less", "distance is more", "force is more"],
      answer: "gravity is less"
    },
    {
      question: "Free fall is motion under:",
      options: ["gravity only", "friction only", "both forces", "no force"],
      answer: "gravity only"
    },
    {
      question: "The force between two objects depends on their:",
      options: ["masses and distance", "velocity and time", "acceleration and force", "energy and power"],
      answer: "masses and distance"
    },
    {
      question: "Gravitational force is a:",
      options: ["attractive force", "repulsive force", "both forces", "no force"],
      answer: "attractive force"
    },
    {
      question: "The weight of a body is zero at:",
      options: ["center of Earth", "surface of Earth", "Moon", "space"],
      answer: "center of Earth"
    },
    {
      question: "The motion of planets around the Sun is due to:",
      options: ["gravitational force", "frictional force", "magnetic force", "electric force"],
      answer: "gravitational force"
    },
    {
      question: "The value of 'G' (universal gravitational constant) is:",
      options: ["6.67 × 10⁻¹¹ N·m²/kg²", "9.8 m/s²", "6.67 N", "10⁻¹¹ m/s²"],
      answer: "6.67 × 10⁻¹¹ N·m²/kg²"
    },
    {
      question: "An object in free fall has:",
      options: ["constant acceleration", "zero acceleration", "variable speed", "no motion"],
      answer: "constant acceleration"
    },
    {
      question: "The weight of an object is measured in:",
      options: ["Newton", "Kilogram", "Joule", "Watt"],
      answer: "Newton"
    },
    {
      question: "Gravity acts along the:",
      options: ["vertical direction", "horizontal direction", "diagonal direction", "random direction"],
      answer: "vertical direction"
    },
    {
      question: "The force of gravity is weaker on the Moon because:",
      options: ["Moon's mass is less", "Earth's mass is more", "distance is more", "velocity is less"],
      answer: "Moon's mass is less"
    },
    {
      question: "An apple falls to the ground due to:",
      options: ["gravitational force", "frictional force", "normal force", "tensile force"],
      answer: "gravitational force"
    }
  ],
  level2: [
    {
      question: "Calculate weight of a 5 kg object on Earth (g = 9.8 m/s²).",
      options: ["49 N", "24.5 N", "98 N", "9.8 N"],
      answer: "49 N"
    },
    {
      question: "If distance between two masses doubles, gravitational force becomes:",
      options: ["1/4", "1/2", "2 times", "4 times"],
      answer: "1/4"
    },
    {
      question: "Weight of a 2 kg object on Moon (g = 1.6 m/s²) is:",
      options: ["3.2 N", "1.6 N", "4.8 N", "6.4 N"],
      answer: "3.2 N"
    },
    {
      question: "Gravitational force between two 10 kg masses 2 m apart (G = 6.67 × 10⁻¹¹) is:",
      options: ["1.67 × 10⁻¹⁰ N", "3.34 × 10⁻¹⁰ N", "6.67 × 10⁻¹⁰ N", "0 N"],
      answer: "1.67 × 10⁻¹⁰ N"
    },
    {
      question: "If mass of one object doubles, gravitational force becomes:",
      options: ["half", "double", "same", "quadruple"],
      answer: "double"
    },
    {
      question: "Free fall acceleration on Earth is:",
      options: ["9.8 m/s²", "1.6 m/s²", "5 m/s²", "10 m/s²"],
      answer: "9.8 m/s²"
    },
    {
      question: "Weight of a 10 kg object on Earth (g = 10 m/s²) is:",
      options: ["100 N", "50 N", "150 N", "200 N"],
      answer: "100 N"
    },
    {
      question: "If distance halves, gravitational force becomes:",
      options: ["4 times", "2 times", "1/2", "1/4"],
      answer: "4 times"
    },
    {
      question: "The force of gravity on a 3 kg object (g = 9.8 m/s²) is:",
      options: ["29.4 N", "19.6 N", "9.8 N", "39.2 N"],
      answer: "29.4 N"
    },
    {
      question: "Gravitational force is inversely proportional to:",
      options: ["square of distance", "distance", "mass", "velocity"],
      answer: "square of distance"
    },
    {
      question: "Weight on Jupiter (g = 24.8 m/s²) for 2 kg object is:",
      options: ["49.6 N", "24.8 N", "99.2 N", "12.4 N"],
      answer: "49.6 N"
    },
    {
      question: "If both masses double, gravitational force becomes:",
      options: ["2 times", "4 times", "8 times", "same"],
      answer: "4 times"
    },
    {
      question: "Time for an object to fall 4.9 m (g = 9.8 m/s²) is:",
      options: ["1 s", "2 s", "0.5 s", "1.5 s"],
      answer: "1 s"
    },
    {
      question: "Gravitational force between Earth and Moon depends on:",
      options: ["their masses and distance", "their velocities", "their accelerations", "their energies"],
      answer: "their masses and distance"
    },
    {
      question: "Weight of a 5 kg object on Earth (g = 9.8 m/s²) in space is:",
      options: ["0 N", "49 N", "9.8 N", "24.5 N"],
      answer: "0 N"
    },
    {
      question: "If distance increases to 3 times, gravitational force becomes:",
      options: ["1/9", "1/3", "3 times", "9 times"],
      answer: "1/9"
    },
    {
      question: "Acceleration due to gravity at equator is slightly:",
      options: ["less", "more", "same", "zero"],
      answer: "less"
    },
    {
      question: "Force of gravity on a 4 kg object (g = 10 m/s²) is:",
      options: ["40 N", "20 N", "60 N", "80 N"],
      answer: "40 N"
    },
    {
      question: "Gravitational force is negligible at:",
      options: ["large distances", "small distances", "Earth's surface", "Moon's surface"],
      answer: "large distances"
    },
    {
      question: "Time to fall 19.6 m (g = 9.8 m/s²) is:",
      options: ["2 s", "3 s", "4 s", "1 s"],
      answer: "2 s"
    }
  ],
  level3: [
    {
      question: "Calculate gravitational force between 5 kg and 10 kg masses 2 m apart (G = 6.67 × 10⁻¹¹).",
      options: ["8.34 × 10⁻¹⁰ N", "4.17 × 10⁻¹⁰ N", "1.67 × 10⁻⁹ N", "3.34 × 10⁻¹⁰ N"],
      answer: "8.34 × 10⁻¹⁰ N"
    },
    {
      question: "Weight of a 3 kg object on Earth (g = 9.8 m/s²) in orbit is:",
      options: ["0 N", "29.4 N", "9.8 N", "14.7 N"],
      answer: "0 N"
    },
    {
      question: "If distance triples, gravitational force becomes:",
      options: ["1/9", "1/3", "3 times", "9 times"],
      answer: "1/9"
    },
    {
      question: "Gravitational force if one mass is 20 kg, other is 10 kg, distance is 1 m (G = 6.67 × 10⁻¹¹):",
      options: ["1.334 × 10⁻⁹ N", "6.67 × 10⁻⁹ N", "3.34 × 10⁻⁹ N", "0 N"],
      answer: "1.334 × 10⁻⁹ N"
    },
    {
      question: "Time to fall 44.1 m (g = 9.8 m/s²) is:",
      options: ["3 s", "2 s", "4 s", "1 s"],
      answer: "3 s"
    },
    {
      question: "Weight on Mars (g = 3.7 m/s²) for 5 kg object is:",
      options: ["18.5 N", "9.25 N", "27.5 N", "37 N"],
      answer: "18.5 N"
    },
    {
      question: "If both masses halve, gravitational force becomes:",
      options: ["1/4", "1/2", "2 times", "4 times"],
      answer: "1/4"
    },
    {
      question: "Gravitational force if distance is 4 m between 15 kg and 10 kg (G = 6.67 × 10⁻¹¹):",
      options: ["2.50 × 10⁻¹¹ N", "1.25 × 10⁻¹¹ N", "5.00 × 10⁻¹¹ N", "0 N"],
      answer: "2.50 × 10⁻¹¹ N"
    },
    {
      question: "Acceleration due to gravity at 1000 m altitude (g = 9.8 m/s², R = 6400 km) is approximately:",
      options: ["9.76 m/s²", "9.8 m/s²", "9.84 m/s²", "9.6 m/s²"],
      answer: "9.76 m/s²"
    },
    {
      question: "Weight of a 2 kg object in free fall is:",
      options: ["0 N", "19.6 N", "9.8 N", "4.9 N"],
      answer: "0 N"
    },
    {
      question: "Gravitational force if mass1 = 50 kg, mass2 = 20 kg, distance = 5 m (G = 6.67 × 10⁻¹¹):",
      options: ["2.67 × 10⁻¹⁰ N", "1.33 × 10⁻¹⁰ N", "5.34 × 10⁻¹⁰ N", "0 N"],
      answer: "2.67 × 10⁻¹⁰ N"
    },
    {
      question: "Time to fall 78.4 m (g = 9.8 m/s²) is:",
      options: ["4 s", "3 s", "5 s", "2 s"],
      answer: "4 s"
    },
    {
      question: "If distance increases to 5 times, gravitational force becomes:",
      options: ["1/25", "1/5", "5 times", "25 times"],
      answer: "1/25"
    },
    {
      question: "Weight on Earth (g = 9.8 m/s²) for 8 kg object in space is:",
      options: ["0 N", "78.4 N", "9.8 N", "39.2 N"],
      answer: "0 N"
    },
    {
      question: "Gravitational force between Earth (6 × 10²⁴ kg) and Moon (7.4 × 10²² kg) at 3.84 × 10⁸ m (G = 6.67 × 10⁻¹¹):",
      options: ["1.98 × 10²⁰ N", "9.9 × 10¹⁹ N", "2.0 × 10²⁰ N", "0 N"],
      answer: "1.98 × 10²⁰ N"
    },
    {
      question: "Acceleration due to gravity at 2000 m altitude (g = 9.8 m/s², R = 6400 km) is:",
      options: ["9.72 m/s²", "9.8 m/s²", "9.6 m/s²", "9.5 m/s²"],
      answer: "9.72 m/s²"
    },
    {
      question: "If one mass triples and distance doubles, gravitational force becomes:",
      options: ["3/4", "3/2", "9/4", "3/8"],
      answer: "3/4"
    },
    {
      question: "Time to fall 24.5 m (g = 9.8 m/s²) with initial velocity 0 is:",
      options: ["2.5 s", "2 s", "1.5 s", "3 s"],
      answer: "2.5 s"
    },
    {
      question: "Gravitational force if masses are 30 kg and 40 kg, distance is 3 m (G = 6.67 × 10⁻¹¹):",
      options: ["8.89 × 10⁻¹⁰ N", "4.44 × 10⁻¹⁰ N", "1.78 × 10⁻⁹ N", "0 N"],
      answer: "8.89 × 10⁻¹⁰ N"
    },
    {
      question: "Weight of a 10 kg object on Earth (g = 9.8 m/s²) in orbit is:",
      options: ["0 N", "98 N", "9.8 N", "49 N"],
      answer: "0 N"
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