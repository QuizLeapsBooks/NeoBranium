// ============================================
// NeoBranium Global Search Engine
// ============================================

const SEARCH_INDEX = [
  // ---- BLOG POSTS ----
  { category: 'Blog', icon: '📝', title: 'Beyond the Grades: What to do when you feel like giving up', excerpt: 'A letter to every student who feels the weight of the world on their shoulders.', url: '/blog/blog.html#resilience' },
  { category: 'Blog', icon: '📝', title: 'The Spark Within: Finding your true passion through curiosity', excerpt: 'How one question changed everything. Discover how to ignite your own flame.', url: '/blog/blog.html#passion' },
  { category: 'Blog', icon: '📝', title: 'The Beauty of Falling: Why failure is your best teacher', excerpt: 'Every setback is a setup for a comeback. Learn why your losses are wins.', url: '/blog/blog.html#failure' },
  { category: 'Blog', icon: '📝', title: 'Matter in Our Surroundings: Simplified', excerpt: 'Everything around us is matter. Solid, Liquid, Gas — states and diffusion.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Mastering Linear Equations in Two Variables', excerpt: 'An equation like ax + by + c = 0. Let\'s master the straight line graph.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: "Newton's Laws of Motion: Made Easy", excerpt: 'Why do we fall forward when a bus stops? Newton had the answers!', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'How to Score 95% in Class 10 Boards', excerpt: 'It\'s not about studying 15 hours. Study smart with this roadmap.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Atoms and Molecules: The Building Blocks', excerpt: 'Atomic mass, Valency, Mole Concept — the tiny world explained.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Everything You Need to Know About Polynomials', excerpt: 'Zeroes, Remainder Theorem, Factor Theorem — all simplified.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Life Processes: How Our Body Works', excerpt: 'Nutrition, Respiration, Transportation, Excretion — the 4 pillars of life.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Trigonometry: No More Fear!', excerpt: 'Sin, Cos, Tan — just ratios of sides. Learn the table hack.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Gravitation: Why Things Fall Down', excerpt: 'Gravity, Free Fall, Mass vs Weight. Newton\'s apple story.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'The Perfect Study Timetable for Students', excerpt: 'A flexible, realistic schedule using the Pomodoro technique.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Chemical Reactions and Equations: Balancing Act', excerpt: 'Rusting, curdling — types and how to balance chemical equations.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Probability: Predicting the Unpredictable', excerpt: 'Favorable outcomes / Total outcomes. Dice, Cards explained.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Tissues: Teamwork in the Body', excerpt: 'Plant and Animal tissues — meristematic, epithelial, connective.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Work, Energy and Power: The Trio', excerpt: 'W=Fs, KE=½mv², PE=mgh. Real-life physics simplified.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Common Mistakes Students Make in Exams', excerpt: 'Silly errors cost marks. Time management, units and reading questions.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Statistics Basics: Mean, Median, Mode', excerpt: 'Central tendencies and the empirical formula simplified.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Acids, Bases and Salts: The pH Balance', excerpt: 'Why is lemon sour and soap bitter? pH scale, indicators, salts.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Light: Mirrors and Lenses Simplified', excerpt: 'Mirror formula, Lens formula, Refractive index explained.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Solving Quadratic Equations Like a Pro', excerpt: 'Factorization, quadratic formula, discriminant D = b²-4ac.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Control and Coordination: The Human Brain', excerpt: 'Nervous system, hormones, reflex action and plant coordination.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Arithmetic Progressions: Finding the Pattern', excerpt: 'nth term = a+(n-1)d. Sum of n terms. Real-life AP examples.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Electricity: Circuits and Ohm\'s Law', excerpt: 'V=IR, Series vs Parallel, Joule\'s Law of Heating.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Surface Areas and Volumes: 3D Geometry', excerpt: 'Cylinder, Cone, Sphere formulas — CSA vs TSA.', url: '/blog/blog.html' },
  { category: 'Blog', icon: '📝', title: 'Magnetic Effects of Current: Motor and Generator', excerpt: "Fleming's Left-Hand and Right-Hand Rules. Solenoid and electromagnet.", url: '/blog/blog.html' },

  // ---- TOP QUESTIONS ----
  { category: 'Question', icon: '❓', title: "State Newton's Second Law of Motion and derive F = ma.", excerpt: 'Force & Laws of Motion • Class 9 Science • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Solve the quadratic equation: x² - 5x + 6 = 0', excerpt: 'Quadratic Equations • Class 10 Mathematics • Easy', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'A stone is dropped from 20m. Find the time to reach the ground. (g=10m/s²)', excerpt: 'Gravitation • Class 9 Science • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Prove that √2 is an irrational number.', excerpt: 'Real Numbers • Class 10 Mathematics • Hard', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Explain the process of double circulation in humans.', excerpt: 'Life Processes • Class 10 Science • Hard', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Find the mean of the first 5 prime numbers.', excerpt: 'Statistics • Class 9 Mathematics • Easy', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'What is the difference between Xylem and Phloem?', excerpt: 'Tissues • Class 9 Science • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Calculate the TSA of a cylinder with radius 7cm and height 10cm.', excerpt: 'Surface Areas and Volumes • Class 10 Mathematics • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Why does the sky appear blue?', excerpt: 'Human Eye and Colourful World • Class 10 Science • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Solve by substitution: x + y = 14, x - y = 4', excerpt: 'Linear Equations in Two Variables • Class 10 Mathematics • Easy', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Differentiate between Mass and Weight.', excerpt: 'Gravitation • Class 9 Science • Easy', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Find sin 60° cos 30° + sin 30° cos 60°.', excerpt: 'Introduction to Trigonometry • Class 10 Mathematics • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: "Explain Bohr's model of an atom.", excerpt: 'Structure of the Atom • Class 9 Science • Hard', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'A bag has 5 red and 3 blue balls. Find P(Red).', excerpt: 'Probability • Class 9 Mathematics • Easy', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'What is the function of Mitochondria?', excerpt: 'Fundamental Unit of Life • Class 9 Science • Easy', url: '/IQ/top-question.html' },

  // ---- CLASS 9 NOTES ----
  { category: 'Class 9 Notes', icon: '📖', title: 'Matter in Our Surroundings', excerpt: 'States of matter, diffusion, evaporation, sublimation, latent heat.', url: '/Notes/notes-science-class9.html#ch1' },
  { category: 'Class 9 Notes', icon: '📖', title: 'Is Matter Around Us Pure?', excerpt: 'Mixtures, solutions, colloids, Tyndall effect, elements and compounds.', url: '/Notes/notes-science-class9.html#ch2' },
  { category: 'Class 9 Notes', icon: '📖', title: 'Atoms and Molecules', excerpt: 'Dalton\'s theory, mole concept, Avogadro number, valency.', url: '/Notes/notes-science-class9.html#ch3' },
  { category: 'Class 9 Notes', icon: '📖', title: 'Structure of the Atom', excerpt: "Thomson's, Rutherford's, Bohr's models, isotopes, isobars.", url: '/Notes/notes-science-class9.html#ch4' },
  { category: 'Class 9 Notes', icon: '📖', title: 'The Fundamental Unit of Life (Cell)', excerpt: 'Cell theory, organelles, mitosis, meiosis, osmosis, plasmolysis.', url: '/Notes/notes-science-class9.html#bio-ch1' },
  { category: 'Class 9 Notes', icon: '📖', title: 'Tissues', excerpt: 'Plant tissues: meristematic, permanent. Animal tissues: epithelial, connective, muscular, nervous.', url: '/Notes/notes-science-class9.html#bio-ch2' },
  { category: 'Class 9 Notes', icon: '📖', title: 'Diversity in Living Organisms', excerpt: 'Five kingdom classification, binomial nomenclature, Plantae, Animalia.', url: '/Notes/notes-science-class9.html#bio-ch3' },
  { category: 'Class 9 Notes', icon: '📖', title: 'Why Do We Fall Ill?', excerpt: 'Health, acute vs chronic disease, infectious disease, immunization, antibiotics.', url: '/Notes/notes-science-class9.html#bio-ch4' },
  { category: 'Class 9 Notes', icon: '📖', title: 'Natural Resources', excerpt: 'Atmosphere, greenhouse effect, ozone layer, nitrogen cycle, soil.', url: '/Notes/notes-science-class9.html#bio-ch5' },
  { category: 'Class 9 Notes', icon: '📖', title: 'Motion', excerpt: 'Distance, displacement, speed, velocity, acceleration, equations of motion.', url: '/Notes/notes-science-class9.html#phy-ch1' },
  { category: 'Class 9 Notes', icon: '📖', title: 'Force and Laws of Motion', excerpt: "Newton's 3 laws, inertia, momentum, F=ma, conservation of momentum.", url: '/Notes/notes-science-class9.html#phy-ch2' },
  { category: 'Class 9 Notes', icon: '📖', title: 'Gravitation', excerpt: "Universal law of gravitation, free fall, g, Archimedes' principle, buoyancy.", url: '/Notes/notes-science-class9.html#phy-ch3' },
  { category: 'Class 9 Notes', icon: '📖', title: 'Work and Energy', excerpt: 'W=Fs, kinetic energy, potential energy, law of conservation of energy, power.', url: '/Notes/notes-science-class9.html#phy-ch4' },

  // ---- CLASS 10 NOTES ----
  { category: 'Class 10 Notes', icon: '📖', title: 'Chemical Reactions and Equations', excerpt: 'Balancing, combination, decomposition, displacement, redox, corrosion, rancidity.', url: '/Notes/notes-science-class10.html#ch1' },
  { category: 'Class 10 Notes', icon: '📖', title: 'Acids, Bases and Salts', excerpt: 'pH scale, neutralisation, chlor-alkali process, baking soda, washing soda, plaster of Paris.', url: '/Notes/notes-science-class10.html#ch2' },
  { category: 'Class 10 Notes', icon: '📖', title: 'Metals and Non-metals', excerpt: 'Reactivity series, ionic compounds, metallurgy, roasting, calcination, electrolytic refining.', url: '/Notes/notes-science-class10.html#ch3' },
  { category: 'Class 10 Notes', icon: '📖', title: 'Carbon and its Compounds', excerpt: 'Covalent bonding, tetravalency, catenation, hydrocarbons, esterification, soaps vs detergents.', url: '/Notes/notes-science-class10.html#ch4' },
  { category: 'Class 10 Notes', icon: '📖', title: 'Life Processes', excerpt: 'Nutrition, respiration, transportation (double circulation), excretion, nephron, villi.', url: '/Notes/notes-science-class10.html#bio-ch1' },
  { category: 'Class 10 Notes', icon: '📖', title: 'Control and Coordination', excerpt: 'Nervous system, brain, reflex action, plant hormones, endocrine glands, insulin.', url: '/Notes/notes-science-class10.html#bio-ch2' },
  { category: 'Class 10 Notes', icon: '📖', title: 'How do Organisms Reproduce?', excerpt: 'Asexual and sexual reproduction, budding, spore formation, human reproduction.', url: '/Notes/notes-science-class10.html#bio-ch3' },
  { category: 'Class 10 Notes', icon: '📖', title: 'Heredity', excerpt: "Mendel's laws, monohybrid cross, sex determination, genotype vs phenotype.", url: '/Notes/notes-science-class10.html#bio-ch4' },
  { category: 'Class 10 Notes', icon: '📖', title: 'Our Environment', excerpt: 'Ecosystem, food chain, 10% law, ozone depletion, biomagnification, 3 Rs.', url: '/Notes/notes-science-class10.html#bio-ch5' },
  { category: 'Class 10 Notes', icon: '📖', title: 'Light - Reflection and Refraction', excerpt: 'Mirror formula, lens formula, refractive index, concave/convex, power of lens.', url: '/Notes/notes-science-class10.html#phy-ch1' },
  { category: 'Class 10 Notes', icon: '📖', title: 'The Human Eye and the Colourful World', excerpt: 'Myopia, hypermetropia, presbyopia, dispersion, Tyndall effect, rainbow, blue sky.', url: '/Notes/notes-science-class10.html#phy-ch2' },
  { category: 'Class 10 Notes', icon: '📖', title: 'Electricity', excerpt: "Ohm's law V=IR, resistance, series/parallel circuits, Joule's heating law, power.", url: '/Notes/notes-science-class10.html#phy-ch3' },
  { category: 'Class 10 Notes', icon: '📖', title: 'Magnetic Effects of Electric Current', excerpt: "Fleming's rules, solenoid, electromagnet, electric motor, domestic circuits, earthing.", url: '/Notes/notes-science-class10.html#phy-ch4' },
];

// Category color map
const CATEGORY_COLORS = {
  'Blog': '#8b5cf6',
  'Question': '#f59e0b',
  'Class 9 Notes': '#10b981',
  'Class 10 Notes': '#0ea5e9',
};

function initGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  const resultsBox = document.getElementById('globalSearchResults');
  if (!input || !resultsBox) return;

  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = input.value.trim();
      if (query.length < 2) {
        hideResults(resultsBox);
        return;
      }
      const results = performSearch(query);
      renderResults(resultsBox, results, query);
    }, 250);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) {
      resultsBox.classList.add('active');
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !resultsBox.contains(e.target)) {
      hideResults(resultsBox);
    }
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideResults(resultsBox);
      input.blur();
    }
  });
}

function performSearch(query) {
  const q = query.toLowerCase();
  return SEARCH_INDEX.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.excerpt.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q)
  ).slice(0, 8); // Max 8 results
}

function highlightMatch(text, query) {
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark style="background:rgba(37,99,235,0.15);color:#2563eb;border-radius:3px;padding:0 2px;">$1</mark>');
}

function renderResults(box, results, query) {
  box.innerHTML = '';
  if (results.length === 0) {
    box.innerHTML = `<div class="search-no-results">
      <i class="fas fa-search" style="font-size:1.5rem;color:#cbd5e1;margin-bottom:0.5rem;display:block;"></i>
      No results for "<strong>${query}</strong>"
    </div>`;
    box.classList.add('active');
    return;
  }

  results.forEach(item => {
    const color = CATEGORY_COLORS[item.category] || '#2563eb';
    const a = document.createElement('a');
    a.className = 'search-result-item';
    a.href = item.url;
    a.innerHTML = `
      <span class="search-result-category" style="color:${color};">${item.icon} ${item.category}</span>
      <span class="search-result-title">${highlightMatch(item.title, query)}</span>
      <span class="search-result-excerpt">${item.excerpt}</span>
    `;
    a.addEventListener('click', () => {
      setTimeout(() => hideResults(box), 100);
    });
    box.appendChild(a);
  });

  box.classList.add('active');
}

function hideResults(box) {
  box.classList.remove('active');
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initGlobalSearch);
