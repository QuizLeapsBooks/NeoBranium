/**
 * js/paper-syllabus-data.js
 *
 * Locally maintained class, subject, and chapter catalog for the NeoBranium Paper Generator.
 * It is not independently verified against a current official curriculum edition.
 */

// This is the version of the locally maintained chapter catalog, not an
// assertion that every entry matches a current official board syllabus.
export const SYLLABUS_VERSION = "NeoBranium curriculum catalog (version not independently verified)";

export const EXAM_MODES = {
  cbse: {
    id: "cbse",
    label: "CBSE / Board Exam",
    badge: "CBSE-style evaluation",
    description: "Practice evaluation using CBSE-style step marking; this is not an official CBSE marking scheme.",
    evaluationRules: [
      "Follow step-wise marking: award marks for intermediate steps, formulas, and working.",
      "Check final answers with correct standard SI units where applicable.",
      "Award partial credit for correct reasoning even if final arithmetic has minor slips.",
      "Accept alternative valid methods recognized by NCERT/CBSE guidelines.",
      "Ensure questions adhere strictly to the prescribed class NCERT syllabus."
    ]
  },
  school: {
    id: "school",
    label: "School Examination",
    badge: "School Standard",
    description: "Prescribed school exam format. Encourages conceptual clarity, definitions, step marks, and clean presentation without requiring college-level rigor.",
    evaluationRules: [
      "Award step marks for structured calculations and stated formulas.",
      "Reward relevant keywords, definitions, and proper diagrams/labels.",
      "Do not penalize students for omitting advanced notations not taught in school.",
      "Differentiate minor calculation slips from fundamental concept errors."
    ]
  },
  competitive: {
    id: "competitive",
    label: "Competitive / Foundation",
    badge: "Olympiad / JEE / NEET Foundation",
    description: "Higher Order Thinking Skills (HOTS), multi-step problem solving, objective accuracy, and deeper conceptual application within class boundaries.",
    evaluationRules: [
      "Strict evaluation of conceptual correctness and numerical accuracy.",
      "For objective/MCQ questions, award marks only if the selected option or final value is correct.",
      "Check for tricky edge cases, significant figures, and multi-concept synthesis.",
      "No step marks for purely objective questions unless multi-part reasoning is requested."
    ]
  },
  practice: {
    id: "practice",
    label: "Practice / Formative Test",
    badge: "Diagnostic Practice",
    description: "Diagnostic assessment providing constructive feedback, identifying misconceptions, and suggesting corrections.",
    evaluationRules: [
      "Provide encouraging, constructive feedback explaining why an answer is incomplete or wrong.",
      "Identify the specific missing concept or NCERT section.",
      "Highlight what was done right before detailing what needs improvement."
    ]
  }
};


export function getQuestionDifficultyGuidance(examMode, difficulty) {
  const difficultyGuidance = {
    Easy: `
      Use foundational questions, but do not make the paper trivial.
      Test conceptual clarity, interpretation, basic application, and
      the ability to connect concepts. Include some questions that
      require students to think before answering. Avoid excessive
      definition-based and direct-recall questions.
    `,
    Medium: `
      Set a demanding but balanced standard. Give substantial weight
      to conceptual application, unfamiliar situations, analytical
      interpretation, multi-step calculations, and logical reasoning.
      Questions should require students to apply concepts independently,
      not merely reproduce memorised examples. Include meaningful HOTS
      questions throughout the paper.
    `,
    Hard: `
      Set a highly challenging examination standard comparable to
      demanding recent CBSE board-level questions and above-average
      school examination papers. Strongly emphasize higher-order
      thinking, unfamiliar real-world contexts, multi-concept
      applications, multi-step numerical problems, analytical reasoning,
      data interpretation, and questions requiring students to justify
      conclusions. Use challenging but fair variations of familiar
      concepts. Avoid predictable textbook-repetition questions.
    `,
    Mixed: `
      Create a carefully balanced but challenging paper. Include
      foundational questions, moderate application questions, and
      substantial higher-order reasoning questions. The challenging
      section must contain genuinely non-routine problems, unfamiliar
      contexts, analytical interpretation, and multi-step applications.
      Do not let easy direct-recall questions dominate the paper.
    `
  }[difficulty] || `
    Use a challenging balance of conceptual understanding,
    application, analytical reasoning, and multi-step problem solving.
  `;

  const modeGuidance = {
    cbse: `
      Follow the evolving competency-based standards and question
      patterns of recent CBSE board examinations. Do not rely on
      outdated, predominantly memory-based paper patterns.

      PRIORITY QUESTION TYPES:
      - Competency-based questions requiring application of concepts
        in unfamiliar but syllabus-relevant situations.
      - Case-study and source-based questions with meaningful
        sub-questions that test interpretation and reasoning.
      - Assertion-reason questions with logically designed statements
        and scientifically or mathematically valid reasoning.
      - Multi-step numerical and mathematical problems requiring
        selection and application of appropriate concepts.
      - Data, graph, table, diagram, experiment, and observation-based
        interpretation wherever relevant to the subject.
      - Questions requiring comparison, inference, evaluation,
        justification, prediction, and identification of errors.
      - Questions connecting multiple concepts or chapters when
        permitted by the prescribed syllabus.
      - Questions that test whether students can transfer learned
        concepts to new situations rather than reproduce memorised
        answers.

      DIFFICULTY STANDARD:
      Raise the overall intellectual demand of the paper. Even
      straightforward questions should test actual understanding.
      Include challenging application and HOTS questions across
      different sections, not only in the final section.
      Make case-based questions genuinely analytical rather than
      converting simple textbook facts into lengthy passages.

      For numerical subjects, use non-routine but solvable problems,
      multiple reasoning steps, correct units, and realistic data.
      For science, emphasize experimental reasoning, observations,
      cause-effect relationships, diagrams, and scientific inference.
      For mathematics, emphasize conceptual flexibility, unfamiliar
      problem structures, connected concepts, and multi-step solutions.
      For social science, emphasize source interpretation, chronology,
      map/data analysis, evidence-based conclusions, and connections
      between concepts.
      For languages, emphasize comprehension, inference, analytical
      interpretation, and application of grammar and writing skills.

      QUALITY RULES:
      Every question must remain strictly within the prescribed
      class-wise CBSE syllabus and current subject curriculum.
      Do not introduce higher-class concepts merely to increase
      difficulty. Avoid ambiguous wording, artificial tricks,
      excessive calculations, obscure facts, and misleading options.
      Ensure every question has a defensible answer and that marks,
      expected answer length, and difficulty are proportionate.

      The paper should challenge a well-prepared student while
      remaining fair and appropriate for the selected class.
    `,

    competitive: `
      Set a rigorous competitive-examination and foundation-level
      standard within the prescribed class syllabus. Emphasize HOTS,
      non-routine problems, multi-concept connections, mathematical
      reasoning, conceptual depth, and carefully designed distractors.

      Include problems that require students to discover the correct
      approach rather than directly apply an obvious formula.
      Challenge students through reasoning and depth, not tricks,
      obscure facts, or unnecessarily lengthy calculations.

      Never introduce concepts or methods from higher grades unless
      explicitly included in the prescribed syllabus.
    `,

    school: `
      Create a rigorous school-examination paper that goes beyond
      basic textbook recall. Test conceptual clarity, application,
      analytical interpretation, reasoning, and multi-step problem
      solving. Keep the challenge appropriate to the selected class
      and difficulty while maintaining clear and fair questions.
    `,

    practice: `
      Create a high-quality diagnostic practice paper that identifies
      conceptual gaps and tests genuine understanding. Include
      application, unfamiliar contexts, analytical reasoning,
      multi-step questions, and a meaningful range of difficulty.
      Avoid repetitive questions and superficial recall-only testing.
    `
  }[examMode] || '';

  return `${difficultyGuidance}\n${modeGuidance}`;
}


export function getEvaluationRules(examMode, questions = []) {
  const config = EXAM_MODES[examMode] || EXAM_MODES.cbse;
  if (examMode === 'competitive' && questions.every(question => ['mcq', 'objective'].includes(question.type))) {
    return [...config.evaluationRules, 'Award no step marks for these objective questions. Apply negative marking only when a per-question negative mark value exists in this paper record.'];
  }
  if (examMode === 'school') {
    return [...config.evaluationRules, 'Use the school-specific instructions and rubric recorded with this paper when available; otherwise apply general school-style practice feedback.'];
  }
  if (examMode === 'practice') {
    return [...config.evaluationRules, 'Treat all marks as diagnostic practice marks, not as an official examination score.'];
  }
  return config.evaluationRules;
}

export const CURRICULUM_DATA = {
  "10": {
    subjects: {
      "Mathematics": {
        chapters: [
          "Real Numbers",
          "Polynomials",
          "Pair of Linear Equations in Two Variables",
          "Quadratic Equations",
          "Arithmetic Progressions",
          "Triangles",
          "Coordinate Geometry",
          "Introduction to Trigonometry",
          "Some Applications of Trigonometry",
          "Circles",
          "Areas Related to Circles",
          "Surface Areas and Volumes",
          "Statistics",
          "Probability"
        ]
      },
      "Science": {
        chapters: [
          "Chemical Reactions and Equations",
          "Acids, Bases and Salts",
          "Metals and Non-metals",
          "Carbon and its Compounds",
          "Life Processes",
          "Control and Coordination",
          "How do Organisms Reproduce?",
          "Heredity",
          "Light – Reflection and Refraction",
          "The Human Eye and the Colourful World",
          "Electricity",
          "Magnetic Effects of Electric Current",
          "Our Environment"
        ]
      },
      "Social Science": {
        chapters: [
          "The Rise of Nationalism in Europe",
          "Nationalism in India",
          "The Making of a Global World",
          "The Age of Industrialisation",
          "Print Culture and the Modern World",
          "Resources and Development",
          "Forest and Wildlife Resources",
          "Water Resources",
          "Agriculture",
          "Minerals and Energy Resources",
          "Manufacturing Industries",
          "Lifelines of National Economy",
          "Power Sharing",
          "Federalism",
          "Gender, Religion and Caste",
          "Political Parties",
          "Outcomes of Democracy",
          "Development",
          "Sectors of the Indian Economy",
          "Money and Credit",
          "Globalisation and the Indian Economy"
        ]
      },
      "English": {
        chapters: [
          "A Letter to God",
          "Nelson Mandela: Long Walk to Freedom",
          "Two Stories about Flying",
          "From the Diary of Anne Frank",
          "Glimpses of India",
          "Mijbil the Otter",
          "Madam Rides the Bus",
          "The Sermon at Benares",
          "The Proposal",
          "Grammar & Reading Comprehension"
        ]
      }
    }
  },
  "9": {
    subjects: {
      "Mathematics": {
        chapters: [
          "Number Systems",
          "Polynomials",
          "Coordinate Geometry",
          "Linear Equations in Two Variables",
          "Introduction to Euclid's Geometry",
          "Lines and Angles",
          "Triangles",
          "Quadrilaterals",
          "Circles",
          "Heron's Formula",
          "Surface Areas and Volumes",
          "Statistics"
        ]
      },
      "Science": {
        chapters: [
          "Matter in Our Surroundings",
          "Is Matter Around Us Pure?",
          "Atoms and Molecules",
          "Structure of the Atom",
          "The Fundamental Unit of Life",
          "Tissues",
          "Motion",
          "Force and Laws of Motion",
          "Gravitation",
          "Work and Energy",
          "Sound",
          "Improvement in Food Resources"
        ]
      },
      "Social Science": {
        chapters: [
          "The French Revolution",
          "Socialism in Europe and the Russian Revolution",
          "Nazism and the Rise of Hitler",
          "India – Size and Location",
          "Physical Features of India",
          "Drainage",
          "Climate",
          "Natural Vegetation and Wildlife",
          "What is Democracy? Why Democracy?",
          "Constitutional Design",
          "Electoral Politics",
          "Working of Institutions",
          "The Story of Village Palampur",
          "People as Resource",
          "Poverty as a Challenge"
        ]
      }
    }
  },
  "11": {
    subjects: {
      "Physics": {
        chapters: [
          "Units and Measurements",
          "Motion in a Straight Line",
          "Motion in a Plane",
          "Laws of Motion",
          "Work, Energy and Power",
          "System of Particles and Rotational Motion",
          "Gravitation",
          "Mechanical Properties of Solids",
          "Mechanical Properties of Fluids",
          "Thermal Properties of Matter",
          "Thermodynamics",
          "Kinetic Theory",
          "Oscillations",
          "Waves"
        ]
      },
      "Chemistry": {
        chapters: [
          "Some Basic Concepts of Chemistry",
          "Structure of Atom",
          "Classification of Elements and Periodicity in Properties",
          "Chemical Bonding and Molecular Structure",
          "Chemical Thermodynamics",
          "Equilibrium",
          "Redox Reactions",
          "Organic Chemistry – Some Basic Principles and Techniques",
          "Hydrocarbons"
        ]
      },
      "Mathematics": {
        chapters: [
          "Sets",
          "Relations and Functions",
          "Trigonometric Functions",
          "Complex Numbers and Quadratic Equations",
          "Linear Inequalities",
          "Permutations and Combinations",
          "Binomial Theorem",
          "Sequences and Series",
          "Straight Lines",
          "Conic Sections",
          "Introduction to Three Dimensional Geometry",
          "Limits and Derivatives",
          "Statistics",
          "Probability"
        ]
      },
      "Biology": {
        chapters: [
          "The Living World",
          "Biological Classification",
          "Plant Kingdom",
          "Animal Kingdom",
          "Morphology of Flowering Plants",
          "Anatomy of Flowering Plants",
          "Structural Organisation in Animals",
          "Cell: The Unit of Life",
          "Biomolecules",
          "Cell Cycle and Cell Division",
          "Photosynthesis in Higher Plants",
          "Respiration in Plants",
          "Plant Growth and Development",
          "Breathing and Exchange of Gases",
          "Body Fluids and Circulation",
          "Excretory Products and their Elimination",
          "Locomotion and Movement",
          "Neural Control and Coordination",
          "Chemical Coordination and Integration"
        ]
      }
    }
  },
  "12": {
    subjects: {
      "Physics": {
        chapters: [
          "Electric Charges and Fields",
          "Electrostatic Potential and Capacitance",
          "Current Electricity",
          "Moving Charges and Magnetism",
          "Magnetism and Matter",
          "Electromagnetic Induction",
          "Alternating Current",
          "Electromagnetic Waves",
          "Ray Optics and Optical Instruments",
          "Wave Optics",
          "Dual Nature of Radiation and Matter",
          "Atoms",
          "Nuclei",
          "Semiconductor Electronics: Materials, Devices and Simple Circuits"
        ]
      },
      "Chemistry": {
        chapters: [
          "Solutions",
          "Electrochemistry",
          "Chemical Kinetics",
          "The d- and f-Block Elements",
          "Coordination Compounds",
          "Haloalkanes and Haloarenes",
          "Alcohols, Phenols and Ethers",
          "Aldehydes, Ketones and Carboxylic Acids",
          "Amines",
          "Biomolecules"
        ]
      },
      "Mathematics": {
        chapters: [
          "Relations and Functions",
          "Inverse Trigonometric Functions",
          "Matrices",
          "Determinants",
          "Continuity and Differentiability",
          "Application of Derivatives",
          "Integrals",
          "Application of Integrals",
          "Differential Equations",
          "Vector Algebra",
          "Three Dimensional Geometry",
          "Linear Programming",
          "Probability"
        ]
      },
      "Biology": {
        chapters: [
          "Sexual Reproduction in Flowering Plants",
          "Human Reproduction",
          "Reproductive Health",
          "Principles of Inheritance and Variation",
          "Molecular Basis of Inheritance",
          "Evolution",
          "Human Health and Disease",
          "Microbes in Human Welfare",
          "Biotechnology: Principles and Processes",
          "Biotechnology and its Applications",
          "Organisms and Populations",
          "Ecosystem",
          "Biodiversity and Conservation"
        ]
      }
    }
  },
  "8": {
    subjects: {
      "Mathematics": {
        chapters: [
          "Rational Numbers",
          "Linear Equations in One Variable",
          "Understanding Quadrilaterals",
          "Data Handling",
          "Square and Square Roots",
          "Cube and Cube Roots",
          "Comparing Quantities",
          "Algebraic Expressions and Identities",
          "Mensuration",
          "Exponents and Powers",
          "Direct and Inverse Proportions",
          "Factorisation",
          "Introduction to Graphs"
        ]
      },
      "Science": {
        chapters: [
          "Crop Production and Management",
          "Microorganisms: Friend and Foe",
          "Coal and Petroleum",
          "Combustion and Flame",
          "Conservation of Plants and Animals",
          "Reproduction in Animals",
          "Reaching the Age of Adolescence",
          "Force and Pressure",
          "Friction",
          "Sound",
          "Chemical Effects of Electric Current",
          "Some Natural Phenomena",
          "Light"
        ]
      }
    }
  },
  "7": {
    subjects: {
      "Mathematics": {
        chapters: [
          "Integers",
          "Fractions and Decimals",
          "Data Handling",
          "Simple Equations",
          "Lines and Angles",
          "The Triangle and its Properties",
          "Comparing Quantities",
          "Rational Numbers",
          "Perimeter and Area",
          "Algebraic Expressions",
          "Exponents and Powers",
          "Symmetry"
        ]
      },
      "Science": {
        chapters: [
          "Nutrition in Plants",
          "Nutrition in Animals",
          "Heat",
          "Acids, Bases and Salts",
          "Physical and Chemical Changes",
          "Respiration in Organisms",
          "Transportation in Animals and Plants",
          "Reproduction in Plants",
          "Motion and Time",
          "Electric Current and its Effects",
          "Light",
          "Forests: Our Lifeline"
        ]
      }
    }
  },
  "6": {
    subjects: {
      "Mathematics": {
        chapters: [
          "Knowing Our Numbers",
          "Whole Numbers",
          "Playing with Numbers",
          "Basic Geometrical Ideas",
          "Understanding Elementary Shapes",
          "Integers",
          "Fractions",
          "Decimals",
          "Data Handling",
          "Mensuration",
          "Algebra",
          "Ratio and Proportion"
        ]
      },
      "Science": {
        chapters: [
          "Components of Food",
          "Sorting Materials into Groups",
          "Separation of Substances",
          "Getting to Know Plants",
          "Body Movements",
          "The Living Organisms — Characteristics and Habitats",
          "Motion and Measurement of Distances",
          "Light, Shadows and Reflections",
          "Electricity and Circuits",
          "Fun with Magnets",
          "Air Around Us"
        ]
      }
    }
  }
};

/**
 * Validates whether a given class, subject, and chapter fit within the curriculum boundaries.
 */
export function validateCurriculumScope(classVal, subject, chapter) {
  const cStr = String(classVal).trim();
  const classData = CURRICULUM_DATA[cStr];
  if (!classData) {
    return { valid: false, note: `Class ${cStr} is not in the locally cataloged curriculum.` };
  }

  const subjects = classData.subjects;
  // Case-insensitive match
  const matchedSubjectKey = Object.keys(subjects).find(
    s => s.toLowerCase() === subject.trim().toLowerCase()
  );

  if (!matchedSubjectKey) {
    return { valid: false, note: `Subject ${subject} is not in the locally cataloged curriculum for Class ${cStr}.` };
  }

  const chapters = subjects[matchedSubjectKey].chapters;
  if (!chapter || chapter.trim().toLowerCase() === 'full syllabus' || chapter.trim().toLowerCase() === 'all chapters') {
    return { valid: true, matchedSubject: matchedSubjectKey, isFullSyllabus: true };
  }

  const matchedChapter = chapters.find(
    ch => ch.toLowerCase() === chapter.trim().toLowerCase()
  );

  return {
    valid: Boolean(matchedChapter),
    matchedSubject: matchedSubjectKey,
    matchedChapter: matchedChapter || null,
    isStandardChapter: Boolean(matchedChapter)
  };
}
