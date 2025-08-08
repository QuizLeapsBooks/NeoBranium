const quizData = {
  level1: [
    {
      question: "What is the SI unit of electric current?",
      options: ["Volt", "Ampere", "Ohm", "Watt"],
      answer: "Ampere"
    },
    {
      question: "What is electric current?",
      options: ["Flow of charge", "Flow of voltage", "Flow of resistance", "Flow of power"],
      answer: "Flow of charge"
    },
    {
      question: "Which device measures electric current?",
      options: ["Voltmeter", "Ammeter", "Ohmmeter", "Wattmeter"],
      answer: "Ammeter"
    },
    {
      question: "The SI unit of potential difference is:",
      options: ["Ampere", "Volt", "Ohm", "Joule"],
      answer: "Volt"
    },
    {
      question: "What does Ohm’s law relate?",
      options: ["Current and power", "Voltage and current", "Resistance and power", "Charge and time"],
      answer: "Voltage and current"
    },
    {
      question: "What is the SI unit of resistance?",
      options: ["Volt", "Ohm", "Ampere", "Watt"],
      answer: "Ohm"
    },
    {
      question: "A good conductor has:",
      options: ["High resistance", "Low resistance", "Zero resistance", "Infinite resistance"],
      answer: "Low resistance"
    },
    {
      question: "The formula for Ohm’s law is:",
      options: ["V = IR", "I = VR", "R = VI", "P = VI"],
      answer: "V = IR"
    },
    {
      question: "Which device measures potential difference?",
      options: ["Ammeter", "Voltmeter", "Ohmmeter", "Galvanometer"],
      answer: "Voltmeter"
    },
    {
      question: "Resistance of a conductor depends on:",
      options: ["Length", "Area", "Material", "All of these"],
      answer: "All of these"
    },
    {
      question: "Electric current is measured in:",
      options: ["Coulombs per second", "Volts per second", "Ohms per meter", "Watts per second"],
      answer: "Coulombs per second"
    },
    {
      question: "A wire with high resistance allows:",
      options: ["High current", "Low current", "No current", "Constant current"],
      answer: "Low current"
    },
    {
      question: "The unit of electric power is:",
      options: ["Joule", "Watt", "Volt", "Ampere"],
      answer: "Watt"
    },
    {
      question: "The formula for electric power is:",
      options: ["P = VI", "P = V/I", "P = IR", "P = V/R"],
      answer: "P = VI"
    },
    {
      question: "A fuse is used to:",
      options: ["Increase current", "Measure voltage", "Protect circuit", "Reduce resistance"],
      answer: "Protect circuit"
    },
    {
      question: "In a series circuit, the current is:",
      options: ["Divided", "Same throughout", "Zero", "Doubled"],
      answer: "Same throughout"
    },
    {
      question: "In a parallel circuit, the voltage is:",
      options: ["Divided", "Same across branches", "Zero", "Doubled"],
      answer: "Same across branches"
    },
    {
      question: "Resistance of a conductor increases with:",
      options: ["Decrease in length", "Increase in temperature", "Increase in area", "Decrease in temperature"],
      answer: "Increase in temperature"
    },
    {
      question: "A fuse wire has:",
      options: ["High melting point", "Low melting point", "No melting point", "High resistance"],
      answer: "Low melting point"
    },
    {
      question: "1 kWh is equal to:",
      options: ["3.6 × 10^6 J", "3.6 × 10^3 J", "3.6 × 10^9 J", "3.6 × 10^5 J"],
      answer: "3.6 × 10^6 J"
    }
  ],
  level2: [
    {
      question: "A current of 5 A flows through a 10 Ω resistor. What is the voltage?",
      options: ["50 V", "25 V", "10 V", "5 V"],
      answer: "50 V"
    },
    {
      question: "A 12 V battery is connected to a 3 Ω resistor. What is the current?",
      options: ["4 A", "3 A", "6 A", "2 A"],
      answer: "4 A"
    },
    {
      question: "A 100 W bulb operates at 220 V. What is the current?",
      options: ["0.45 A", "0.55 A", "1 A", "2 A"],
      answer: "0.45 A"
    },
    {
      question: "A 6 Ω resistor has 12 V across it. What is the power dissipated?",
      options: ["24 W", "12 W", "36 W", "48 W"],
      answer: "24 W"
    },
    {
      question: "Two resistors of 5 Ω and 5 Ω are in series. Total resistance is:",
      options: ["10 Ω", "2.5 Ω", "25 Ω", "5 Ω"],
      answer: "10 Ω"
    },
    {
      question: "Two resistors of 8 Ω and 8 Ω are in parallel. Equivalent resistance is:",
      options: ["4 Ω", "8 Ω", "16 Ω", "2 Ω"],
      answer: "4 Ω"
    },
    {
      question: "A current of 3 A flows for 10 s. What is the charge passed?",
      options: ["30 C", "10 C", "3 C", "60 C"],
      answer: "30 C"
    },
    {
      question: "A 60 W bulb runs for 5 hours. What is the energy consumed?",
      options: ["0.3 kWh", "0.6 kWh", "1 kWh", "0.1 kWh"],
      answer: "0.3 kWh"
    },
    {
      question: "A wire’s length doubles and area halves. Resistance changes by:",
      options: ["4 times", "2 times", "0.5 times", "No change"],
      answer: "4 times"
    },
    {
      question: "A 220 V appliance draws 2 A. What is its resistance?",
      options: ["110 Ω", "220 Ω", "55 Ω", "440 Ω"],
      answer: "110 Ω"
    },
    {
      question: "A 4 Ω resistor has 8 A current. What is the voltage?",
      options: ["32 V", "16 V", "8 V", "4 V"],
      answer: "32 V"
    },
    {
      question: "Three 3 Ω resistors are in series. Total resistance is:",
      options: ["9 Ω", "3 Ω", "1 Ω", "6 Ω"],
      answer: "9 Ω"
    },
    {
      question: "A 100 W bulb at 200 V draws current of:",
      options: ["0.5 A", "1 A", "2 A", "0.25 A"],
      answer: "0.5 A"
    },
    {
      question: "Two 6 Ω resistors in parallel have equivalent resistance of:",
      options: ["3 Ω", "6 Ω", "12 Ω", "2 Ω"],
      answer: "3 Ω"
    },
    {
      question: "A 10 Ω resistor with 2 A current dissipates power of:",
      options: ["20 W", "40 W", "10 W", "80 W"],
      answer: "40 W"
    },
    {
      question: "A 2 kW heater runs for 1 hour. Energy consumed is:",
      options: ["2 kWh", "1 kWh", "4 kWh", "0.5 kWh"],
      answer: "2 kWh"
    },
    {
      question: "A wire’s resistance is 5 Ω. If its length triples, new resistance is:",
      options: ["15 Ω", "5 Ω", "1.67 Ω", "45 Ω"],
      answer: "15 Ω"
    },
    {
      question: "Two resistors of 4 Ω and 12 Ω in parallel have equivalent resistance:",
      options: ["3 Ω", "16 Ω", "8 Ω", "2 Ω"],
      answer: "3 Ω"
    },
    {
      question: "A 12 V battery supplies 3 A. What is the power delivered?",
      options: ["36 W", "12 W", "9 W", "48 W"],
      answer: "36 W"
    },
    {
      question: "A 5 Ω resistor with 10 V across it has current of:",
      options: ["2 A", "5 A", "10 A", "1 A"],
      answer: "2 A"
    }
  ],
  level3: [
    {
      question: "Three resistors of 2 Ω, 4 Ω, and 8 Ω are in series. Total resistance is:",
      options: ["14 Ω", "8 Ω", "16 Ω", "4 Ω"],
      answer: "14 Ω"
    },
    {
      question: "Two resistors of 6 Ω and 12 Ω in parallel. Equivalent resistance is:",
      options: ["4 Ω", "18 Ω", "2 Ω", "8 Ω"],
      answer: "4 Ω"
    },
    {
      question: "A 200 W bulb at 220 V runs for 2 hours. Energy consumed is:",
      options: ["0.4 kWh", "0.2 kWh", "0.8 kWh", "1 kWh"],
      answer: "0.4 kWh"
    },
    {
      question: "A 12 V battery supplies 2 A through a resistor. Resistance is:",
      options: ["6 Ω", "4 Ω", "12 Ω", "3 Ω"],
      answer: "6 Ω"
    },
    {
      question: "Power dissipated in a 4 Ω resistor with 3 A current is:",
      options: ["36 W", "12 W", "18 W", "48 W"],
      answer: "36 W"
    },
    {
      question: "A wire’s resistance is 10 Ω. If its area doubles, new resistance is:",
      options: ["5 Ω", "10 Ω", "20 Ω", "2.5 Ω"],
      answer: "5 Ω"
    },
    {
      question: "A 1 kW heater at 220 V draws current of:",
      options: ["4.55 A", "2.27 A", "9.09 A", "1.14 A"],
      answer: "4.55 A"
    },
    {
      question: "Three 9 Ω resistors in parallel. Equivalent resistance is:",
      options: ["3 Ω", "9 Ω", "27 Ω", "4.5 Ω"],
      answer: "3 Ω"
    },
    {
      question: "A 10 V battery supplies 2 A through two 2 Ω resistors in series. Total resistance is:",
      options: ["4 Ω", "2 Ω", "8 Ω", "1 Ω"],
      answer: "4 Ω"
    },
    {
      question: "A 3 Ω resistor in series with a parallel combination of 6 Ω and 6 Ω. Total resistance is:",
      options: ["6 Ω", "9 Ω", "4.5 Ω", "12 Ω"],
      answer: "6 Ω"
    },
    {
      question: "A 220 V appliance uses 880 W. Resistance is:",
      options: ["55 Ω", "110 Ω", "27.5 Ω", "220 Ω"],
      answer: "55 Ω"
    },
    {
      question: "A 4 A current flows for 15 s. Charge passed is:",
      options: ["60 C", "30 C", "15 C", "120 C"],
      answer: "60 C"
    },
    {
      question: "A 100 W bulb at 100 V runs for 10 hours. Energy used is:",
      options: ["1 kWh", "0.5 kWh", "2 kWh", "0.1 kWh"],
      answer: "1 kWh"
    },
    {
      question: "A wire’s resistance is 16 Ω. If its length halves and area doubles, new resistance is:",
      options: ["4 Ω", "8 Ω", "16 Ω", "32 Ω"],
      answer: "4 Ω"
    },
    {
      question: "A circuit has a 4 Ω and 8 Ω resistor in parallel, in series with a 2 Ω resistor. Total resistance is:",
      options: ["4.67 Ω", "6 Ω", "14 Ω", "8 Ω"],
      answer: "4.67 Ω"
    },
    {
      question: "A 12 V battery supplies 5 A through a resistor. Power dissipated is:",
      options: ["60 W", "30 W", "120 W", "15 W"],
      answer: "60 W"
    },
    {
      question: "A 1.5 kW appliance at 220 V runs for 2 hours. Energy is:",
      options: ["3 kWh", "1.5 kWh", "6 kWh", "0.75 kWh"],
      answer: "3 kWh"
    },
    {
      question: "A 8 Ω resistor has 16 V across it. Current is:",
      options: ["2 A", "4 A", "1 A", "8 A"],
      answer: "2 A"
    },
    {
      question: "A wire’s resistance is 12 Ω. If its length doubles and area triples, new resistance is:",
      options: ["8 Ω", "4 Ω", "24 Ω", "6 Ω"],
      answer: "8 Ω"
    },
    {
      question: "A 220 V battery supplies 2 kW to a circuit. Current is:",
      options: ["9.09 A", "4.55 A", "18.18 A", "2.27 A"],
      answer: "9.09 A"
    }
  ]
};

// Render quiz
function renderQuiz(level) {
  const quizContainer = document.getElementById("quizContainer");
  quizContainer.innerHTML = "";
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
        selected.parentElement.style.color = "var(--highlight-color)";
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
  renderQuiz("level1");
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