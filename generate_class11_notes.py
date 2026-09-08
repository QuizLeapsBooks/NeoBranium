import os

SUBJECTS = [
    {
        "file": "notes-chemistry-class11.html",
        "name": "Chemistry",
        "color": "#10b981",
        "icon": "fa-flask",
        "chapters": [
            "Some Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements and Periodicity",
            "Chemical Bonding and Molecular Structure", "States of Matter", "Thermodynamics", "Equilibrium",
            "Redox Reactions", "Hydrogen", "The s-Block Elements", "The p-Block Elements",
            "Organic Chemistry — Some Basic Principles", "Hydrocarbons", "Environmental Chemistry"
        ]
    },
    {
        "file": "notes-mathematics-class11.html",
        "name": "Mathematics",
        "color": "#3b82f6",
        "icon": "fa-square-root-alt",
        "chapters": [
            "Sets", "Relations and Functions", "Trigonometric Functions", "Principle of Mathematical Induction",
            "Complex Numbers and Quadratic Equations", "Linear Inequalities", "Permutations and Combinations",
            "Binomial Theorem", "Sequences and Series", "Straight Lines", "Conic Sections",
            "Introduction to Three Dimensional Geometry", "Limits and Derivatives", "Statistics", "Probability"
        ]
    },
    {
        "file": "notes-biology-class11.html",
        "name": "Biology",
        "color": "#10b981",
        "icon": "fa-leaf",
        "chapters": [
            "The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom",
            "Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Structural Organisation in Animals",
            "Cell: The Unit of Life", "Biomolecules", "Cell Cycle and Cell Division", "Transport in Plants",
            "Mineral Nutrition", "Photosynthesis in Higher Plants", "Respiration in Plants",
            "Plant Growth and Development", "Digestion and Absorption", "Breathing and Exchange of Gases",
            "Body Fluids and Circulation", "Excretory Products and their Elimination", "Locomotion and Movement",
            "Neural Control and Coordination", "Chemical Coordination and Integration"
        ]
    },
    {
        "file": "notes-accountancy-class11.html",
        "name": "Accountancy",
        "color": "#8b5cf6",
        "icon": "fa-calculator",
        "chapters": [
            "Introduction to Accounting", "Theory Base of Accounting", "Recording of Transactions — I",
            "Recording of Transactions — II", "Bank Reconciliation Statement", "Trial Balance and Rectification of Errors",
            "Depreciation, Provisions and Reserves", "Bills of Exchange", "Financial Statements — I",
            "Financial Statements — II", "Accounts from Incomplete Records", "Applications of Computers in Accounting"
        ]
    },
    {
        "file": "notes-business-studies-class11.html",
        "name": "Business Studies",
        "color": "#f59e0b",
        "icon": "fa-briefcase",
        "chapters": [
            "Business, Trade and Commerce", "Forms of Business Organisation", "Private, Public and Global Enterprises",
            "Business Services", "Emerging Modes of Business", "Social Responsibilities of Business and Business Ethics",
            "Formation of a Company", "Sources of Business Finance", "Small Business", "Internal Trade", "International Business"
        ]
    },
    {
        "file": "notes-economics-class11.html",
        "name": "Economics",
        "color": "#10b981",
        "icon": "fa-chart-line",
        "chapters": [
            "Indian Economy on the Eve of Independence", "Indian Economy 1950-1990", "Liberalisation, Privatisation and Globalisation",
            "Poverty", "Human Capital Formation in India", "Rural Development", "Employment", "Infrastructure",
            "Environment and Sustainable Development", "Comparative Development Experiences",
            "Introduction to Statistics", "Collection of Data", "Organisation of Data", "Presentation of Data",
            "Measures of Central Tendency", "Measures of Dispersion", "Correlation", "Index Numbers", "Use of Statistical Tools"
        ]
    },
    {
        "file": "notes-history-class11.html",
        "name": "History",
        "color": "#dc2626",
        "icon": "fa-hourglass-half",
        "chapters": [
            "From the Beginning of Time", "Early Societies", "An Empire Across Three Continents",
            "The Central Islamic Lands", "Nomadic Empires", "The Three Orders", "Changing Cultural Traditions",
            "Confrontation of Cultures", "The Industrial Revolution", "Displacing Indigenous Peoples", "Paths to Modernisation"
        ]
    },
    {
        "file": "notes-political-science-class11.html",
        "name": "Political Science",
        "color": "#2563eb",
        "icon": "fa-balance-scale",
        "chapters": [
            "Constitution: Why and How?", "Rights in the Indian Constitution", "Election and Representation",
            "Executive", "Legislature", "Judiciary", "Federalism", "Local Governments",
            "Constitution as a Living Document", "The Philosophy of the Constitution",
            "Political Theory: An Introduction", "Freedom", "Equality", "Social Justice",
            "Rights", "Citizenship", "Nationalism", "Secularism", "Peace", "Development"
        ]
    },
    {
        "file": "notes-geography-class11.html",
        "name": "Geography",
        "color": "#059669",
        "icon": "fa-globe-asia",
        "chapters": [
            "Geography as a Discipline", "The Origin and Evolution of the Earth", "Interior of the Earth",
            "Distribution of Oceans and Continents", "Minerals and Rocks", "Geomorphic Processes",
            "Landforms and their Evolution", "Composition and Structure of Atmosphere",
            "Solar Radiation, Heat Balance and Temperature", "Atmospheric Circulation and Weather Systems",
            "Water in the Atmosphere", "World Climate and Climate Change", "Water (Oceans)",
            "Movements of Ocean Water", "Life on the Earth", "Biodiversity and Conservation",
            "India-Location", "Structure and Physiography", "Drainage System", "Climate",
            "Natural Vegetation", "Soils", "Natural Hazards and Disasters"
        ]
    },
    {
        "file": "notes-sociology-class11.html",
        "name": "Sociology",
        "color": "#6366f1",
        "icon": "fa-users",
        "chapters": [
            "Sociology and Society", "Terms, Concepts and their Use in Sociology", "Understanding Social Institutions",
            "Culture and Socialisation", "Doing Sociology: Research Methods",
            "Social Structure, Stratification and Social Processes", "Social Change and Social Order",
            "Environment and Society", "Tribal Society", "Social Control and Deviance"
        ]
    }
]

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="canonical" href="https://neobranium.web.app/Notes/{file}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Class 11 {name} Notes | NCERT CBSE 2026-27 | NeoBranium</title>
  <meta name="description" content="Complete Class 11 {name} notes aligned with CBSE 2026-27 NCERT syllabus.">
  <meta name="robots" content="index, follow">
  
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
  <link rel="stylesheet" href="../index_css.css">
  <link rel="stylesheet" href="notes.css">
  <style>
    .subject-accent {{ color: {color}; }}
    .coming-soon-section {{
      background: #f8fafc;
      border: 2px dashed #cbd5e1;
      border-radius: 16px;
      padding: 2rem;
      text-align: center;
      color: #64748b;
      margin: 2rem 0;
    }}
    .coming-soon-section .cs-icon {{ font-size: 2rem; margin-bottom: 0.5rem; }}
  </style>
</head>
<body>
  <div class="free-access-banner">
    <span class="badge"><i class="fas fa-sparkles"></i> 100% Free Access</span>
    <span class="banner-text">All Class 11 Notes are fully open — No Sign-In Required!</span>
  </div>

  <div id="preloader">
    <img src="/online-graduation_16847316.png" alt="NeoBranium Logo" class="preloader-logo" />
    <div class="loader"></div>
  </div>

  <header>
    <div class="header-container">
      <div class="logo" onclick="window.location.href='../index.html'">
        <img src="/online-graduation_16847316.png" alt="NeoBranium Logo">
        <span>NeoBranium</span>
      </div>
      <div class="header-search">
        <i class="fas fa-search"></i>
        <input type="text" id="globalSearchInput" placeholder="Search Class 11 notes..." autocomplete="off">
        <div id="globalSearchResults" class="search-results-dropdown"></div>
      </div>
      <button class="menu-toggle" aria-label="Toggle navigation" aria-expanded="false">☰</button>
      <nav class="nav-menu">
        <a href="../index.html">Home</a>
        <div class="nav-item">
          <a href="{file}" class="active">Notes <i class="fas fa-chevron-down" style="font-size: 0.7rem;"></i></a>
          <div class="dropdown-menu">
            <div class="dropdown-submenu"><h5>Class 9</h5><ul><li><a href="notes-science-class9.html">Science</a></li><li><a href="notes-math-class9.html">Mathematics</a></li></ul></div>
            <div class="dropdown-submenu" style="border-top: 1px solid var(--border-color); margin-top: 0.5rem; padding-top: 1rem;"><h5>Class 10</h5><ul><li><a href="notes-science-class10.html">Science</a></li><li><a href="notes-math-class10.html">Mathematics</a></li></ul></div>
            <div class="dropdown-submenu" style="border-top: 1px solid var(--border-color); margin-top: 0.5rem; padding-top: 1rem;"><h5>Class 11</h5><ul><li><a href="class11-notes.html">All Subjects →</a></li><li><a href="notes-physics-class11.html">Physics</a></li><li><a href="notes-chemistry-class11.html">Chemistry</a></li><li><a href="notes-mathematics-class11.html">Mathematics</a></li><li><a href="notes-biology-class11.html">Biology</a></li></ul></div>
          </div>
        </div>
        <a href="../IQ/top-question.html">Top Questions</a>
        <a href="../IQ/expected-questions.html">Expected Questions</a>
        <a href="../blog/blog.html">Blog</a>
        <a href="../htmls/sign.html" class="login-btn">Login / Sign Up</a>
      </nav>
    </div>
  </header>

  <main class="notes-page">
    <aside class="notes-sidebar">
      <div class="sidebar-content">
        <h3><i class="fas {icon} subject-accent"></i> {name} Class 11</h3>
        <ul>
{sidebar_links}
        </ul>
      </div>
    </aside>
    
    <div class="notes-container">
      <nav class="breadcrumb">
        <a href="../index.html">Home</a> / <a href="class11-notes.html">Class 11</a> / {name}
      </nav>

{chapter_sections}

    </div>
  </main>

  <footer class="chapter-summary-footer">
    <div class="footer-chapter-container">
      <h2 class="footer-chapter-heading"><i class="fas fa-book-open"></i> Complete Chapter Index – Class 11 {name}</h2>
      <p class="footer-chapter-subheading">Quick jump to any chapter | CBSE Board 2026-27</p>
      
      <div class="chapter-summary-grid">
{jump_cards}
      </div>
      
      <div class="footer-container" style="margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 2rem;">
        <div class="footer-brand">
          <div class="logo">
            <img src="/online-graduation_16847316.png" alt="NeoBranium Logo">
            <span>NeoBranium</span>
          </div>
          <p>A next-gen learning platform for students of all classes.</p>
        </div>
        <div class="footer-links">
          <h4>Quick Links</h4>
          <ul>
            <li><a href="../index.html">Home</a></li>
            <li><a href="class11-notes.html">Class 11 Notes</a></li>
            <li><a href="notes-science-class10.html">Class 10 Notes</a></li>
            <li><a href="../IQ/expected-questions.html">Expected Questions</a></li>
            <li><a href="../blog/blog.html">Blog</a></li>
          </ul>
        </div>
        <div class="footer-bottom">
          <p>&copy; 2026 NeoBranium. All rights reserved.</p>
        </div>
      </div>
    </div>
  </footer>

  <script>
    window.addEventListener('load', () => {{
      const preloader = document.getElementById('preloader');
      setTimeout(() => {{
        if (preloader) {{
          preloader.style.opacity = '0';
          setTimeout(() => preloader.style.display = 'none', 500);
        }}
      }}, 1000);
    }});
  </script>
  <script src="/search.js"></script>
</body>
</html>
"""

for sub in SUBJECTS:
    sidebar_links = "\n".join([f'          <li><a href="#ch{i+1}">{i+1}. {ch}</a></li>' for i, ch in enumerate(sub["chapters"])])
    
    chapter_sections = ""
    for i, ch in enumerate(sub["chapters"]):
        chapter_sections += f"""      <section id="ch{i+1}" class="chapter-section">
        <h2>Chapter {i+1}: {ch}</h2>
        <div class="coming-soon-section">
          <div class="cs-icon">🚧</div>
          <h3>Detailed Notes Coming Soon</h3>
          <p>This chapter is currently being updated for the latest CBSE 2026-27 syllabus.</p>
        </div>
      </section>
      <hr>
"""
    
    jump_cards = "\n".join([f'        <a href="#ch{i+1}" class="chapter-jump-card"><div class="card-icon"><i class="fas {sub["icon"]}"></i></div><div class="card-info"><h4>{i+1}. {ch}</h4><span class="jump-badge">Read</span></div></a>' for i, ch in enumerate(sub["chapters"])])
    
    html = TEMPLATE.format(
        file=sub["file"],
        name=sub["name"],
        color=sub["color"],
        icon=sub["icon"],
        sidebar_links=sidebar_links,
        chapter_sections=chapter_sections,
        jump_cards=jump_cards
    )
    
    filepath = os.path.join('/home/shubham_singh/Documents/NeoBranium/Notes', sub["file"])
    with open(filepath, 'w') as f:
        f.write(html)
    print(f"Generated {filepath}")

