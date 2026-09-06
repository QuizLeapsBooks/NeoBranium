// ============================================
// NeoBranium Global Search Engine
// ============================================

const SEARCH_INDEX = [
  // ---- BLOG POSTS ----
  { category: 'Blog', icon: '📝', title: 'Competency-Based Questions: The 50% Shift in 2026 Boards', excerpt: 'CBSE increased competency-based questions to 50%. Learn to shift from rote learning to application excellence.', url: '/blog/blog.html#cbq-2026' },
  { category: 'Blog', icon: '📝', title: 'Double Board Exams: Understanding the New CBSE Two-Term System', excerpt: 'Two board exams in one year? Learn how this system reduces stress and gives you a second chance at success.', url: '/blog/blog.html#double-board' },
  { category: 'Blog', icon: '📝', title: 'Tackling Case Study Questions in Science & Maths', excerpt: 'Master the art of scanning information, identifying keywords, and connecting passages to theory.', url: '/blog/blog.html#case-study' },
  { category: 'Blog', icon: '📝', title: 'AI & Computational Thinking: Why They Are Your Superpower', excerpt: 'How to use AI ethically to accelerate your understanding rather than copying answers.', url: '/blog/blog.html#ai-education' },
  { category: 'Blog', icon: '📝', title: 'Effective Revision: Stop Memorizing, Start Practicing (Active Recall)', excerpt: 'Proven memory techniques: flashcards, blurting, and spaced repetition that outperform re-reading.', url: '/blog/blog.html#active-recall' },
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
  { category: 'Question', icon: '❓', title: 'A bullet of mass 20g moving at 200 m/s strikes a wooden block. Find block velocity and KE loss.', excerpt: 'Force & Laws of Motion • Class 10 Science • Hard', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Explain double circulation in humans. Why is separation of oxygenated/deoxygenated blood necessary?', excerpt: 'Life Processes • Class 10 Science • Hard', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: "What is Ohm's Law? State the factors on which resistance of a conductor depends.", excerpt: 'Electricity • Class 10 Science • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Define Redox reaction. Identify oxidized and reduced substances with example.', excerpt: 'Chemical Reactions and Equations • Class 10 Science • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'How is the sex of a child determined in humans?', excerpt: 'Heredity • Class 10 Science • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'If (x-2) is a factor of x³-3x²+kx+10, find k and all zeroes.', excerpt: 'Polynomials • Class 10 Mathematics • Hard', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Find the nature of roots of 2x²-4x+3=0 using discriminant.', excerpt: 'Quadratic Equations • Class 10 Mathematics • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Prove that √2 is irrational.', excerpt: 'Real Numbers • Class 10 Mathematics • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: "State Newton's three laws of motion with one example each.", excerpt: 'Force & Laws of Motion • Class 9 Science • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: '2g CaCO₃ and Mg ribbon react with dil HCl. Write equations, find CO₂ volume at STP.', excerpt: 'Atoms and Molecules • Class 9 Science • Hard', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Differentiate between aerobic and anaerobic respiration with examples.', excerpt: 'Tissues • Class 9 Science • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: "What are the postulates of Dalton's Atomic Theory? State its limitations.", excerpt: 'Structure of the Atom • Class 9 Science • Easy', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Factorize: x³-23x²+142x-120', excerpt: 'Polynomials • Class 9 Mathematics • Hard', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Prove that angles opposite to equal sides of an isosceles triangle are equal.', excerpt: 'Triangles • Class 9 Mathematics • Medium', url: '/IQ/top-question.html' },
  { category: 'Question', icon: '❓', title: 'Find the area of triangle with vertices A(1,2), B(4,0), C(0,3) using coordinate geometry.', excerpt: 'Coordinate Geometry • Class 9 Mathematics • Medium', url: '/IQ/top-question.html' },

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

  // ---- EXPECTED QUESTIONS ----
  { category: 'Expected Questions', icon: '🎯', title: 'Most Expected Questions Hub - Class 9 & 10 CBSE Board Exam', excerpt: 'Chapter-wise most expected questions and stepwise solutions for Class 9 and 10.', url: '/IQ/expected-questions.html' },
  { category: 'Expected Questions', icon: '🎯', title: 'Class 10 Chemical Reactions: Most Expected Board Questions', excerpt: 'Balance reactions, types of chemical reactions, redox, corrosion with detailed solutions.', url: '/IQ/class10-science/chapter-1-chemical-reactions.html' },
  { category: 'Expected Questions', icon: '🎯', title: 'Class 10 Life Processes: Most Expected Board Questions', excerpt: 'Double circulation, nephron structure, photosynthesis, digestion detailed solutions.', url: '/IQ/class10-science/chapter-5-life-processes.html' },
  { category: 'Expected Questions', icon: '🎯', title: 'Class 10 Electricity: Most Expected Board Questions', excerpt: "Ohm's law, equivalent resistance in series/parallel, Joule's heating law numericals.", url: '/IQ/class10-science/chapter-11-electricity.html' },
  { category: 'Expected Questions', icon: '🎯', title: 'Class 10 Real Numbers: Most Expected Board Questions', excerpt: 'Fundamental Theorem of Arithmetic, proving irrationality of √2, √3, √5.', url: '/IQ/class10-maths/chapter-1-real-numbers.html' },
  { category: 'Expected Questions', icon: '🎯', title: 'Class 10 Quadratic Equations: Most Expected Board Questions', excerpt: 'Nature of roots, discriminant D=b²-4ac, word problems on speed and age.', url: '/IQ/class10-maths/chapter-4-quadratic-equations.html' },
  { category: 'Expected Questions', icon: '🎯', title: 'Class 10 Trigonometry: Most Expected Board Questions', excerpt: 'Trigonometric identities, values table proofs, angle of elevation/depression.', url: '/IQ/class10-maths/chapter-8-introduction-to-trigonometry.html' },
  { category: 'Expected Questions', icon: '🎯', title: 'Class 9 Matter in Our Surroundings: Most Expected Questions', excerpt: 'States of matter, latent heat of vaporization/fusion, evaporation factors.', url: '/IQ/class9-science/chapter-1-matter-surroundings.html' },
  { category: 'Expected Questions', icon: '🎯', title: 'Class 9 Number Systems: Most Expected Questions', excerpt: 'Rational numbers between two numbers, rationalizing denominators, laws of exponents.', url: '/IQ/class9-maths/chapter-1-number-systems.html' },
];

// Category color map
const CATEGORY_COLORS = {
  'Blog': '#8b5cf6',
  'Question': '#f59e0b',
  'Class 9 Notes': '#10b981',
  'Class 10 Notes': '#0ea5e9',
  'Expected Questions': '#f59e0b',
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

// Removed highlightMatch function for security reasons, logic moved to renderResults

function renderResults(box, results, query) {
  box.innerHTML = '';
  if (results.length === 0) {
    box.innerHTML = '';
    const noResults = document.createElement('div');
    noResults.className = 'search-no-results';

    const icon = document.createElement('i');
    icon.className = 'fas fa-search';
    icon.style.fontSize = '1.5rem';
    icon.style.color = '#cbd5e1';
    icon.style.marginBottom = '0.5rem';
    icon.style.display = 'block';

    const text = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = query;
    text.textContent = 'No results for "';
    text.appendChild(strong);
    text.appendChild(document.createTextNode('"'));

    noResults.appendChild(icon);
    noResults.appendChild(text);
    box.appendChild(noResults);

    box.classList.add('active');
    return;
  }

  results.forEach(item => {
    const color = CATEGORY_COLORS[item.category] || '#2563eb';
    const a = document.createElement('a');
    a.className = 'search-result-item';
    a.href = item.url;
    
    const catSpan = document.createElement('span');
    catSpan.className = 'search-result-category';
    catSpan.style.color = color;
    catSpan.textContent = `${item.icon} ${item.category}`;
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'search-result-title';
    
    // Safer highlight
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
    const parts = item.title.split(regex);
    parts.forEach(part => {
      if (part.toLowerCase() === query.toLowerCase()) {
        const mark = document.createElement('mark');
        mark.style.cssText = 'background:rgba(37,99,235,0.15);color:#2563eb;border-radius:3px;padding:0 2px;';
        mark.textContent = part;
        titleSpan.appendChild(mark);
      } else {
        titleSpan.appendChild(document.createTextNode(part));
      }
    });

    const excerptSpan = document.createElement('span');
    excerptSpan.className = 'search-result-excerpt';
    excerptSpan.textContent = item.excerpt;

    a.appendChild(catSpan);
    a.appendChild(titleSpan);
    a.appendChild(excerptSpan);
    
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
