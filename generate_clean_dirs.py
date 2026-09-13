import os

NAV = '''<div class="free-access-banner">
    <span class="badge"><i class="fas fa-sparkles"></i> 100% Free Access</span>
    <span class="banner-text">All Class 9 &amp; 10 Notes, Solved Questions, and Study Blogs are fully open — No Sign-In Required!</span>
  </div>

  <!-- Preloader -->
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
        <input type="text" id="globalSearchInput" placeholder="Search notes..." autocomplete="off">
        <div id="globalSearchResults" class="search-results-dropdown"></div>
      </div>
      <button class="menu-toggle" aria-label="Toggle navigation" aria-expanded="false">☰</button>
      <nav class="nav-menu">
        <a href="../index.html">Home</a>
        <div class="nav-item">
          <a href="detailed-notes.html" class="active">Notes <i class="fas fa-chevron-down" style="font-size: 0.7rem;"></i></a>
          <div class="dropdown-menu">
            <div class="dropdown-submenu"><h5>Class 9</h5><ul><li><a href="class9-science-dir.html">Science</a></li><li><a href="class9-maths-dir.html">Mathematics</a></li></ul></div>
            <div class="dropdown-submenu" style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:1rem;"><h5>Class 10</h5><ul><li><a href="class-wise-notes.html">Science</a></li><li><a href="class10-maths-dir.html">Mathematics</a></li></ul></div>
            <div class="dropdown-submenu" style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:1rem;"><h5>Class 11</h5><ul><li><a href="class11-physics-dir.html">Physics</a></li><li><a href="class11-chemistry-dir.html">Chemistry</a></li><li><a href="class11-maths-dir.html">Mathematics</a></li></ul></div>
            <div class="dropdown-submenu" style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:1rem;"><h5>Class 12</h5><ul><li><a href="class12-physics-dir.html">Physics</a></li><li><a href="class12-chemistry-dir.html">Chemistry</a></li><li><a href="class12-maths-dir.html">Mathematics</a></li></ul></div>
          </div>
        </div>
        <a href="../IQ/top-question.html">TopQs</a>
        <a href="../IQ/expected-questions.html">Expected Questions</a>
        <a href="../blog/blog.html">Blog</a>
        <a href="../htmls/sign.html" class="login-btn">Login / Sign Up</a>
      </nav>
    </div>
  </header>'''

def make_page(filename, title, class_label, subject, color, icon, chapters):
    """
    chapters is a list of dicts: {num, name, url}
    url='#' => Coming Soon
    """
    cards_html = ''
    for ch in chapters:
        if ch['url'] == '#':
            btn = '<span class="cs-badge"><i class="fas fa-clock"></i> Coming Soon</span>'
            card_cls = 'chapter-card coming-soon-card'
        else:
            btn = f'<a href="{ch["url"]}" class="read-link"><i class="fas fa-eye"></i> Read Full Notes <i class="fas fa-arrow-right"></i></a>'
            card_cls = 'chapter-card'
        cards_html += f'''        <div class="{card_cls}">
          <div class="card-header">
            <h3>Ch {ch["num"]}: {ch["name"]}</h3>
            <span class="chapter-number" style="background:{color}20;color:{color};">{subject}</span>
          </div>
          <div class="card-footer">
            {btn}
          </div>
        </div>\n'''

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} | NeoBranium</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
  <link rel="stylesheet" href="../index_css.css">
  <style>
    .directory-hero {{
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      padding: 3rem 2rem;
      text-align: center;
      margin-top: 1rem;
      border-radius: 24px;
      margin-bottom: 2rem;
    }}
    .directory-hero h1 {{ font-size: 2.2rem; margin-bottom: 0.5rem; }}
    .directory-hero p {{ color: #94a3b8; font-size: 1rem; }}
    .subject-badge {{
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: {color}20; color: {color}; border: 1px solid {color}40;
      padding: 0.3rem 0.9rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600;
      margin-bottom: 0.8rem;
    }}
    .back-btn {{
      display: inline-flex; align-items: center; gap: 0.5rem;
      color: #64748b; text-decoration: none; font-size: 0.9rem;
      margin: 1rem 0; transition: color 0.2s;
    }}
    .back-btn:hover {{ color: {color}; }}
    .chapters-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-top: 1rem;
    }}
    .chapter-card {{
      background: white; border-radius: 16px; overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;
      transition: all 0.3s ease; text-decoration: none; display: block;
    }}
    .chapter-card:hover {{
      transform: translateY(-4px); box-shadow: 0 12px 28px rgba(0,0,0,0.11);
      border-color: {color}50;
    }}
    .coming-soon-card {{ opacity: 0.75; cursor: default; }}
    .coming-soon-card:hover {{ transform: none; box-shadow: 0 4px 15px rgba(0,0,0,0.07); border-color: #e2e8f0; }}
    .card-header {{
      padding: 1.2rem 1.5rem; display: flex; justify-content: space-between;
      align-items: center; border-bottom: 1px solid #f1f5f9; background: #f8fafc;
    }}
    .card-header h3 {{ font-size: 1rem; font-weight: 700; margin: 0; color: #0f172a; }}
    .chapter-number {{
      padding: 0.2rem 0.7rem; border-radius: 20px;
      font-size: 0.72rem; font-weight: 600;
    }}
    .card-footer {{
      padding: 0.9rem 1.5rem; display: flex; justify-content: flex-end; align-items: center;
    }}
    .read-link {{
      color: {color}; font-size: 0.82rem; font-weight: 600;
      display: flex; align-items: center; gap: 0.4rem; text-decoration: none;
    }}
    .read-link .fa-arrow-right {{ font-size: 0.7rem; transition: transform 0.2s; }}
    .chapter-card:hover .read-link .fa-arrow-right {{ transform: translateX(4px); }}
    .cs-badge {{
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: #f1f5f9; color: #94a3b8; font-size: 0.8rem;
      padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: 600;
    }}
    @media (max-width: 768px) {{
      .directory-hero h1 {{ font-size: 1.5rem; }}
      .chapters-grid {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  {NAV}

  <main>
    <div class="notes-container" style="max-width:1200px;margin:0 auto;padding:2rem;">
      <a href="detailed-notes.html" class="back-btn"><i class="fas fa-arrow-left"></i> Back to Detailed Notes</a>

      <div class="directory-hero">
        <div class="subject-badge"><i class="{icon}"></i> {subject}</div>
        <h1>{title}</h1>
        <p>Select a chapter to access detailed notes. More chapters coming soon!</p>
      </div>

      <div class="chapters-grid">
{cards_html}      </div>
    </div>
  </main>

  <script>
    window.addEventListener('load', () => {{
      const preloader = document.getElementById('preloader');
      setTimeout(() => {{
        if (preloader) {{ preloader.style.opacity = '0'; setTimeout(() => preloader.style.display = 'none', 500); }}
      }}, 800);
    }});
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    if (menuToggle) menuToggle.addEventListener('click', () => {{ navMenu.classList.toggle('active'); menuToggle.setAttribute('aria-expanded', navMenu.classList.contains('active')); }});
  </script>
  <script src="/search.js"></script>
</body>
</html>'''
    with open(f'Notes/{filename}', 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'Created Notes/{filename}')

# ===== CLASS 9 SCIENCE =====
make_page('class9-science-dir.html', 'Class 9 Science — Chapter Notes', 'Class 9', 'Science', '#10b981', 'fas fa-flask', [
    {'num':1, 'name':'Matter in Our Surroundings', 'url':'#'},
    {'num':2, 'name':'Is Matter Around Us Pure', 'url':'#'},
    {'num':3, 'name':'Atoms and Molecules', 'url':'#'},
    {'num':4, 'name':'Structure of the Atom', 'url':'#'},
    {'num':5, 'name':'The Fundamental Unit of Life', 'url':'#'},
    {'num':6, 'name':'Tissues', 'url':'#'},
    {'num':7, 'name':'Diversity in Living Organisms', 'url':'#'},
    {'num':8, 'name':'Motion', 'url':'#'},
    {'num':9, 'name':'Force and Laws of Motion', 'url':'#'},
    {'num':10, 'name':'Gravitation', 'url':'#'},
    {'num':11, 'name':'Work and Energy', 'url':'#'},
    {'num':12, 'name':'Sound', 'url':'#'},
])

# ===== CLASS 9 MATHS =====
make_page('class9-maths-dir.html', 'Class 9 Mathematics — Chapter Notes', 'Class 9', 'Mathematics', '#8b5cf6', 'fas fa-square-root-alt', [
    {'num':1, 'name':'Number Systems', 'url':'#'},
    {'num':2, 'name':'Polynomials', 'url':'#'},
    {'num':3, 'name':'Coordinate Geometry', 'url':'#'},
    {'num':4, 'name':'Linear Equations in Two Variables', 'url':'#'},
    {'num':5, 'name':'Introduction to Euclid\'s Geometry', 'url':'#'},
    {'num':6, 'name':'Lines and Angles', 'url':'#'},
    {'num':7, 'name':'Triangles', 'url':'#'},
    {'num':8, 'name':'Quadrilaterals', 'url':'#'},
    {'num':9, 'name':'Circles', 'url':'#'},
    {'num':10, 'name':'Heron\'s Formula', 'url':'#'},
    {'num':11, 'name':'Surface Areas and Volumes', 'url':'#'},
    {'num':12, 'name':'Statistics', 'url':'#'},
])

# ===== CLASS 10 SCIENCE (actual URLs from class-wise-notes) =====
make_page('class10-science-dir.html', 'Class 10 Science — Chapter Notes', 'Class 10', 'Science', '#10b981', 'fas fa-flask', [
    {'num':1,  'name':'Chemical Reactions & Equations',           'url':'/Notes/10-CH1.html'},
    {'num':2,  'name':'Acids, Bases and Salts',                   'url':'/Notes/10-CH2.html'},
    {'num':3,  'name':'Metals and Non-metals',                    'url':'/Notes/10-CH3.html'},
    {'num':4,  'name':'Carbon and its Compounds',                 'url':'/Notes/10-CH4.html'},
    {'num':5,  'name':'Life Processes',                           'url':'/Notes/10-BI1.html'},
    {'num':6,  'name':'Control and Coordination',                 'url':'/Notes/10-BI2.html'},
    {'num':7,  'name':'How do Organisms Reproduce?',              'url':'/Notes/10-BI3.html'},
    {'num':8,  'name':'Heredity',                                 'url':'/Notes/10-BI4.html'},
    {'num':9,  'name':'Light — Reflection and Refraction',        'url':'/Notes/10-PH1.html'},
    {'num':10, 'name':'The Human Eye and the Colourful World',    'url':'/Notes/10-PH2.html'},
    {'num':11, 'name':'Electricity',                              'url':'/Notes/10-PH3.html'},
    {'num':12, 'name':'Magnetic Effects of Electric Current',     'url':'/Notes/10-PH4.html'},
    {'num':13, 'name':'Our Environment',                          'url':'/Notes/10-PH5.html'},
])

# ===== CLASS 10 MATHS =====
make_page('class10-maths-dir.html', 'Class 10 Mathematics — Chapter Notes', 'Class 10', 'Mathematics', '#8b5cf6', 'fas fa-square-root-alt', [
    {'num':1, 'name':'Real Numbers', 'url':'#'},
    {'num':2, 'name':'Polynomials', 'url':'#'},
    {'num':3, 'name':'Pair of Linear Equations in Two Variables', 'url':'#'},
    {'num':4, 'name':'Quadratic Equations', 'url':'#'},
    {'num':5, 'name':'Arithmetic Progressions', 'url':'#'},
    {'num':6, 'name':'Triangles', 'url':'#'},
    {'num':7, 'name':'Coordinate Geometry', 'url':'#'},
    {'num':8, 'name':'Introduction to Trigonometry', 'url':'#'},
    {'num':9, 'name':'Some Applications of Trigonometry', 'url':'#'},
    {'num':10,'name':'Circles', 'url':'#'},
    {'num':11,'name':'Areas Related to Circles', 'url':'#'},
    {'num':12,'name':'Surface Areas and Volumes', 'url':'#'},
    {'num':13,'name':'Statistics', 'url':'#'},
    {'num':14,'name':'Probability', 'url':'#'},
])

# ===== CLASS 11 PHYSICS =====
make_page('class11-physics-dir.html', 'Class 11 Physics — Chapter Notes', 'Class 11', 'Physics', '#f59e0b', 'fas fa-atom', [
    {'num':1, 'name':'Units and Measurements', 'url':'#'},
    {'num':2, 'name':'Motion in a Straight Line', 'url':'#'},
    {'num':3, 'name':'Motion in a Plane', 'url':'#'},
    {'num':4, 'name':'Laws of Motion', 'url':'#'},
    {'num':5, 'name':'Work, Energy and Power', 'url':'#'},
    {'num':6, 'name':'System of Particles and Rotational Motion', 'url':'#'},
    {'num':7, 'name':'Gravitation', 'url':'#'},
    {'num':8, 'name':'Mechanical Properties of Solids', 'url':'#'},
    {'num':9, 'name':'Mechanical Properties of Fluids', 'url':'#'},
    {'num':10,'name':'Thermal Properties of Matter', 'url':'#'},
    {'num':11,'name':'Thermodynamics', 'url':'#'},
    {'num':12,'name':'Kinetic Theory', 'url':'#'},
    {'num':13,'name':'Oscillations', 'url':'#'},
    {'num':14,'name':'Waves', 'url':'#'},
])

# ===== CLASS 11 CHEMISTRY =====
make_page('class11-chemistry-dir.html', 'Class 11 Chemistry — Chapter Notes', 'Class 11', 'Chemistry', '#10b981', 'fas fa-flask', [
    {'num':1, 'name':'Some Basic Concepts of Chemistry', 'url':'#'},
    {'num':2, 'name':'Structure of Atom', 'url':'#'},
    {'num':3, 'name':'Classification of Elements and Periodicity', 'url':'#'},
    {'num':4, 'name':'Chemical Bonding and Molecular Structure', 'url':'#'},
    {'num':5, 'name':'States of Matter', 'url':'#'},
    {'num':6, 'name':'Thermodynamics', 'url':'#'},
    {'num':7, 'name':'Equilibrium', 'url':'#'},
    {'num':8, 'name':'Redox Reactions', 'url':'#'},
    {'num':9, 'name':'Hydrogen', 'url':'#'},
    {'num':10,'name':'The s-Block Elements', 'url':'#'},
    {'num':11,'name':'The p-Block Elements', 'url':'#'},
    {'num':12,'name':'Organic Chemistry — Basic Principles', 'url':'#'},
    {'num':13,'name':'Hydrocarbons', 'url':'#'},
])

# ===== CLASS 11 MATHS =====
make_page('class11-maths-dir.html', 'Class 11 Mathematics — Chapter Notes', 'Class 11', 'Mathematics', '#8b5cf6', 'fas fa-square-root-alt', [
    {'num':1, 'name':'Sets', 'url':'#'},
    {'num':2, 'name':'Relations and Functions', 'url':'#'},
    {'num':3, 'name':'Trigonometric Functions', 'url':'#'},
    {'num':4, 'name':'Complex Numbers and Quadratic Equations', 'url':'#'},
    {'num':5, 'name':'Linear Inequalities', 'url':'#'},
    {'num':6, 'name':'Permutations and Combinations', 'url':'#'},
    {'num':7, 'name':'Binomial Theorem', 'url':'#'},
    {'num':8, 'name':'Sequences and Series', 'url':'#'},
    {'num':9, 'name':'Straight Lines', 'url':'#'},
    {'num':10,'name':'Conic Sections', 'url':'#'},
    {'num':11,'name':'Introduction to 3D Geometry', 'url':'#'},
    {'num':12,'name':'Limits and Derivatives', 'url':'#'},
    {'num':13,'name':'Statistics', 'url':'#'},
    {'num':14,'name':'Probability', 'url':'#'},
])

# ===== CLASS 12 PHYSICS =====
make_page('class12-physics-dir.html', 'Class 12 Physics — Chapter Notes', 'Class 12', 'Physics', '#f59e0b', 'fas fa-atom', [
    {'num':1, 'name':'Electric Charges and Fields', 'url':'#'},
    {'num':2, 'name':'Electrostatic Potential and Capacitance', 'url':'#'},
    {'num':3, 'name':'Current Electricity', 'url':'#'},
    {'num':4, 'name':'Moving Charges and Magnetism', 'url':'#'},
    {'num':5, 'name':'Magnetism and Matter', 'url':'#'},
    {'num':6, 'name':'Electromagnetic Induction', 'url':'#'},
    {'num':7, 'name':'Alternating Current', 'url':'#'},
    {'num':8, 'name':'Electromagnetic Waves', 'url':'#'},
    {'num':9, 'name':'Ray Optics and Optical Instruments', 'url':'#'},
    {'num':10,'name':'Wave Optics', 'url':'#'},
    {'num':11,'name':'Dual Nature of Radiation and Matter', 'url':'#'},
    {'num':12,'name':'Atoms', 'url':'#'},
    {'num':13,'name':'Nuclei', 'url':'#'},
    {'num':14,'name':'Semiconductor Electronics', 'url':'#'},
])

# ===== CLASS 12 CHEMISTRY =====
make_page('class12-chemistry-dir.html', 'Class 12 Chemistry — Chapter Notes', 'Class 12', 'Chemistry', '#10b981', 'fas fa-flask', [
    {'num':1, 'name':'Solutions', 'url':'#'},
    {'num':2, 'name':'Electrochemistry', 'url':'#'},
    {'num':3, 'name':'Chemical Kinetics', 'url':'#'},
    {'num':4, 'name':'The d and f Block Elements', 'url':'#'},
    {'num':5, 'name':'Coordination Compounds', 'url':'#'},
    {'num':6, 'name':'Haloalkanes and Haloarenes', 'url':'#'},
    {'num':7, 'name':'Alcohols, Phenols and Ethers', 'url':'#'},
    {'num':8, 'name':'Aldehydes, Ketones and Carboxylic Acids', 'url':'#'},
    {'num':9, 'name':'Amines', 'url':'#'},
    {'num':10,'name':'Biomolecules', 'url':'#'},
])

# ===== CLASS 12 MATHS =====
make_page('class12-maths-dir.html', 'Class 12 Mathematics — Chapter Notes', 'Class 12', 'Mathematics', '#8b5cf6', 'fas fa-square-root-alt', [
    {'num':1, 'name':'Relations and Functions', 'url':'#'},
    {'num':2, 'name':'Inverse Trigonometric Functions', 'url':'#'},
    {'num':3, 'name':'Matrices', 'url':'#'},
    {'num':4, 'name':'Determinants', 'url':'#'},
    {'num':5, 'name':'Continuity and Differentiability', 'url':'#'},
    {'num':6, 'name':'Application of Derivatives', 'url':'#'},
    {'num':7, 'name':'Integrals', 'url':'#'},
    {'num':8, 'name':'Application of Integrals', 'url':'#'},
    {'num':9, 'name':'Differential Equations', 'url':'#'},
    {'num':10,'name':'Vector Algebra', 'url':'#'},
    {'num':11,'name':'Three Dimensional Geometry', 'url':'#'},
    {'num':12,'name':'Linear Programming', 'url':'#'},
    {'num':13,'name':'Probability', 'url':'#'},
])

print("All directory pages generated successfully!")
