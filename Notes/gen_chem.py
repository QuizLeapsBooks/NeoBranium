import os

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Class 9 Science Chapter {chap_num}: {chap_title} | Detailed NCERT Notes | NeoBranium</title>
  <meta name="description" content="Most repeated and exam-focused notes for Class 9 Science Chapter {chap_num} - {chap_title}. Includes detailed concepts, formulas, and previous year questions. CBSE board 2025-26.">
  <meta name="keywords" content="class 9 science chapter {chap_num}, {chap_title}, NCERT notes, board exam">
  <meta name="author" content="NeoBranium">
  <meta name="robots" content="index, follow">
  
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
  <link rel="stylesheet" href="../index_css.css">
  <link rel="stylesheet" href="notes.css">
  
  <style>
    .highlight-box { background: linear-gradient(135deg, #fff9e6 0%, #ffffff 100%); border-left: 5px solid #f59e0b; padding: 1.2rem; margin: 1.5rem 0; border-radius: 12px; }
    .repeated-tag { display: inline-block; background: #dc2626; color: white; font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 30px; margin-left: 0.75rem; vertical-align: middle; }
    .pyq-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 16px; padding: 1.3rem; margin: 1.8rem 0; }
    .key-memorize { background: #fef3c7; padding: 1rem 1.3rem; border-radius: 14px; border-left: 4px solid #d97706; margin: 1.3rem 0; }
    .formula-box-custom { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 12px; font-family: monospace; text-align: center; font-size: 1.1rem; }
    .badge-mostimp { background: #16a34a; color: white; font-size: 0.7rem; padding: 0.2rem 0.7rem; border-radius: 20px; display: inline-block; margin-top: 0.3rem; }
    .interactive-card { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; margin: 2rem 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .interactive-card h3 { margin-top: 0; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem; }
    .canvas-container { width: 100%; max-width: 600px; margin: 1rem auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; display: flex; justify-content: center; position: relative; min-height: 200px;}
    .controls { display: flex; flex-direction: column; gap: 1rem; max-width: 400px; margin: 0 auto; background: #f1f5f9; padding: 1rem; border-radius: 8px;}
    .control-group { display: flex; justify-content: space-between; align-items: center; }
    .control-group input[type="range"] { flex-grow: 1; margin-left: 1rem; }
    .control-group select { flex-grow: 1; margin-left: 1rem; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1; }
    
    .chapter-summary-footer { background: #f8fafc; margin-top: 4rem; padding: 2rem 1rem 1rem; }
    .footer-chapter-container { max-width: 1400px; margin: 0 auto; }
    .footer-chapter-heading { font-size: 1.8rem; text-align: center; margin-bottom: 0.5rem; color: #0f172a; }
    .footer-chapter-subheading { text-align: center; color: #475569; margin-bottom: 2.5rem; }
    .chapter-summary-grid { display: flex; flex-direction: column; gap: 2rem; }
    .subject-section { background: white; border-radius: 1.5rem; padding: 1.2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .subject-title { font-size: 1.4rem; padding-bottom: 0.5rem; margin-bottom: 1rem; border-bottom: 3px solid; display: inline-block; }
    .chemistry-title { border-bottom-color: #10b981; color: #065f46; }
    .biology-title { border-bottom-color: #3b82f6; color: #1e3a8a; }
    .physics-title { border-bottom-color: #f59e0b; color: #92400e; }
    .chapter-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }
    .chapter-jump-card { display: flex; align-items: center; gap: 1rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1rem; text-decoration: none; transition: all 0.2s ease; cursor: pointer; }
    .chapter-jump-card:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); border-color: #94a3b8; }
    .card-icon { font-size: 2rem; min-width: 50px; text-align: center; }
    .card-info h4 { margin: 0 0 0.3rem; font-size: 1rem; color: #1e293b; }
    .card-info p { margin: 0 0 0.4rem; font-size: 0.8rem; color: #475569; }
    .jump-badge { font-size: 0.7rem; color: #3b82f6; font-weight: 500; }
    .footer-revision-links { display: flex; justify-content: center; gap: 2rem; flex-wrap: wrap; margin: 2rem 0 1rem; }
    .revision-box { background: #eef2ff; padding: 0.75rem 1.2rem; border-radius: 40px; font-size: 0.85rem; color: #1e40af; }
    @media (max-width: 768px) { .chapter-cards { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div id="preloader"><img src="/online-graduation_16847316.png" alt="NeoBranium Logo" class="preloader-logo" /><div class="loader"></div></div>
  <header>
    <div class="header-container">
      <div class="logo" onclick="window.location.href='../index.html'"><img src="/online-graduation_16847316.png" alt="NeoBranium Logo"><span>NeoBranium</span></div>
      <div class="header-search"><i class="fas fa-search"></i><input type="text" id="globalSearchInput" placeholder="Search notes..." autocomplete="off"></div>
      <nav class="nav-menu">
        <a href="../index.html">Home</a>
        <div class="nav-item">
          <a href="notes-science-class9.html" class="active">Notes <i class="fas fa-chevron-down" style="font-size: 0.7rem;"></i></a>
        </div>
        <a href="../IQ/top-question.html">Top Questions</a>
        <a href="../blog/blog.html">Blog</a>
      </nav>
    </div>
  </header>
  <main class="notes-page">
    <aside class="notes-sidebar">
      <div class="sidebar-content">
        <h3>📖 Chapter Contents</h3>
        <ul>{sidebar_links}</ul>
      </div>
    </aside>
    <div class="notes-container">
      <nav class="breadcrumb"><a href="../index.html">Home</a> / <a href="class9-science-dir.html">Notes</a> / Chapter {chap_num}: {chap_title}</nav>
      <section id="intro">
        <h1>{chap_title} <span class="repeated-tag">High Weightage Chapter</span></h1>
        <div class="highlight-box"><i class="fas fa-star" style="color:#f59e0b;"></i> <strong>Why this chapter is important?</strong> {importance_text}</div>
      </section>
      
      {main_content}
      
      {interactive_card}

      <section id="pyqs">
        <h2>Most Repeated Previous Year Questions</h2>
        <div class="pyq-box"><ol>{pyq_list}</ol></div>
      </section>
      
      <section id="quick-revision">
        <h2>Quick Revision - At a Glance</h2>
        <div class="key-memorize">
          <strong>🎯 Key Tips:</strong><br>
          {revision_tips}
        </div>
      </section>
    </div>
  </main>

  <footer class="chapter-summary-footer">
    <div class="footer-chapter-container">
      <h2 class="footer-chapter-heading"><i class="fas fa-book-open"></i> Complete Chapter Index – Class 9 Science</h2>
      <div class="chapter-summary-grid">
        <div class="subject-section">
          <h3 class="subject-title chemistry-title"><i class="fas fa-flask"></i> Chemistry</h3>
          <div class="chapter-cards">
            <a href="/Notes/9-CH1.html" class="chapter-jump-card"><div class="card-icon">⚗️</div><div class="card-info"><h4>Ch 1: Matter in Our Surroundings</h4><p>States of matter</p><span class="jump-badge">Jump →</span></div></a>
            <a href="/Notes/9-CH2.html" class="chapter-jump-card"><div class="card-icon">🧪</div><div class="card-info"><h4>Ch 2: Is Matter Around Us Pure</h4><p>Mixtures, solutions</p><span class="jump-badge">Jump →</span></div></a>
            <a href="/Notes/9-CH3.html" class="chapter-jump-card"><div class="card-icon">🔩</div><div class="card-info"><h4>Ch 3: Atoms and Molecules</h4><p>Laws of chemical combination</p><span class="jump-badge">Jump →</span></div></a>
            <a href="/Notes/9-CH4.html" class="chapter-jump-card"><div class="card-icon">🌿</div><div class="card-info"><h4>Ch 4: Structure of the Atom</h4><p>Thomson, Rutherford models</p><span class="jump-badge">Jump →</span></div></a>
          </div>
        </div>
        <div class="subject-section">
          <h3 class="subject-title biology-title"><i class="fas fa-leaf"></i> Biology</h3>
          <div class="chapter-cards">
            <a href="/Notes/9-BI1.html" class="chapter-jump-card"><div class="card-icon">❤️</div><div class="card-info"><h4>Ch 5: The Fundamental Unit of Life</h4><p>Cell structure</p><span class="jump-badge">Jump →</span></div></a>
            <a href="/Notes/9-BI2.html" class="chapter-jump-card"><div class="card-icon">🧠</div><div class="card-info"><h4>Ch 6: Tissues</h4><p>Plant and animal tissues</p><span class="jump-badge">Jump →</span></div></a>
            <a href="/Notes/9-BI3.html" class="chapter-jump-card"><div class="card-icon">🌱</div><div class="card-info"><h4>Ch 7: Diversity in Living Organisms</h4><p>Classification</p><span class="jump-badge">Jump →</span></div></a>
          </div>
        </div>
        <div class="subject-section">
          <h3 class="subject-title physics-title"><i class="fas fa-atom"></i> Physics</h3>
          <div class="chapter-cards">
            <a href="/Notes/9-PH1.html" class="chapter-jump-card"><div class="card-icon">💡</div><div class="card-info"><h4>Ch 8: Motion</h4><p>Velocity, graphs</p><span class="jump-badge">Jump →</span></div></a>
            <a href="/Notes/9-PH2.html" class="chapter-jump-card"><div class="card-icon">👁️</div><div class="card-info"><h4>Ch 9: Force & Laws of Motion</h4><p>Newton's laws</p><span class="jump-badge">Jump →</span></div></a>
            <a href="/Notes/9-PH3.html" class="chapter-jump-card"><div class="card-icon">⚡</div><div class="card-info"><h4>Ch 10: Gravitation</h4><p>Universal law</p><span class="jump-badge">Jump →</span></div></a>
            <a href="/Notes/9-PH4.html" class="chapter-jump-card"><div class="card-icon">🧲</div><div class="card-info"><h4>Ch 11: Work and Energy</h4><p>Kinetic, potential</p><span class="jump-badge">Jump →</span></div></a>
            <a href="/Notes/9-PH5.html" class="chapter-jump-card"><div class="card-icon">📐</div><div class="card-info"><h4>Ch 12: Sound</h4><p>Propagation, characteristics</p><span class="jump-badge">Jump →</span></div></a>
          </div>
        </div>
      </div>
    </div>
  </footer>
  <script>
    window.addEventListener('load', () => {
      const preloader = document.getElementById('preloader');
      if(preloader) { setTimeout(() => { preloader.style.opacity = '0'; setTimeout(() => preloader.style.display = 'none', 500); }, 800); }
    });
  </script>
  {interactive_script}
</body>
</html>
"""

chapters = [
    {
        "ch_num": 1,
        "chap_num": "1",
        "chap_title": "Matter in Our Surroundings",
        "importance_text": "Understanding the physical nature of matter, its states, and the effect of temperature and pressure is the starting point for chemistry.",
        "sidebar_links": "<li><a href='#nature'>Physical Nature</a></li><li><a href='#states'>States of Matter</a></li><li><a href='#change'>Change of State</a></li><li><a href='#evap'>Evaporation</a></li>",
        "main_content": """
        <section id='nature'>
            <h2>1. Physical Nature of Matter</h2>
            <p>Matter is made up of particles. These particles are very small and have space between them. They are continuously moving and attract each other.</p>
        </section>
        <section id='states'>
            <h2>2. States of Matter</h2>
            <p><strong>Solid:</strong> Definite shape and volume. High density, low compressibility. Particles are tightly packed.</p>
            <p><strong>Liquid:</strong> No definite shape but fixed volume. Takes the shape of the container. Particles are loosely packed.</p>
            <p><strong>Gas:</strong> Neither definite shape nor fixed volume. Highly compressible. Particles are far apart.</p>
        </section>
        <section id='change'>
            <h2>3. Change of State</h2>
            <p>Matter can change its state by changing temperature or pressure.</p>
            <ul>
                <li><strong>Melting:</strong> Solid to liquid (Melting point of ice = 273.15 K).</li>
                <li><strong>Boiling:</strong> Liquid to gas (Boiling point of water = 373 K).</li>
                <li><strong>Sublimation:</strong> Solid directly to gas (e.g., Camphor, Naphthalene).</li>
                <li><strong>Condensation:</strong> Gas to liquid.</li>
            </ul>
        </section>
        <section id='evap'>
            <h2>4. Evaporation</h2>
            <p>The phenomenon of change of a liquid into vapors at any temperature below its boiling point.</p>
            <div class='key-memorize'><strong>Factors affecting evaporation:</strong> Surface area (increases), Temperature (increases), Humidity (decreases), Wind speed (increases).</div>
        </section>
        """,
        "pyq_list": """
            <li>Why does our palm feel cold when we put some acetone or petrol on it? (2 Marks)</li>
            <li>What is latent heat of vaporization? (2 Marks)</li>
            <li>Convert 25°C to Kelvin scale. (1 Mark)</li>
        """,
        "revision_tips": "<li>K = °C + 273.</li><li>Evaporation always causes cooling because particles absorb energy from surroundings to overcome forces of attraction.</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: Particle Motion Simulator</h3>
          <p>Change the temperature to observe how particles behave in Solid, Liquid, and Gas states.</p>
          <div class="canvas-container"><canvas id="particleCanvas" width="400" height="300" style="background:#1e293b;"></canvas></div>
          <div class="controls">
            <div class="control-group"><label>Temperature: <span id="tempVal">0</span> °C</label><input type="range" id="tempRange" min="-50" max="150" value="-20"></div>
            <div style="text-align:center;font-weight:bold;margin-top:10px;">State: <span id="stateName" style="color:#3b82f6;">Solid</span></div>
          </div>
        </div>
        """,
        "interactive_script": """
        <script>
          const pCanv = document.getElementById('particleCanvas');
          const pCtx = pCanv.getContext('2d');
          let particles = [];
          
          // Init 100 particles
          for(let i=0; i<100; i++) {
            particles.push({x: Math.random()*200 + 100, y: Math.random()*150 + 100, vx:0, vy:0, origX: (i%10)*15 + 130, origY: Math.floor(i/10)*15 + 130});
          }

          function drawParticles() {
            let t = parseInt(document.getElementById('tempRange').value);
            document.getElementById('tempVal').innerText = t;
            
            let state = "Solid";
            let color = "#3b82f6";
            let speed = 0.5;
            if(t > 0 && t < 100) { state = "Liquid"; color = "#10b981"; speed = 2; }
            else if(t >= 100) { state = "Gas"; color = "#ef4444"; speed = 5; }
            
            document.getElementById('stateName').innerText = state;
            document.getElementById('stateName').style.color = color;
            
            pCtx.clearRect(0,0,400,300);
            
            particles.forEach(p => {
              if(state === "Solid") {
                // Vibrate around origin
                p.x = p.origX + (Math.random()-0.5)*2;
                p.y = p.origY + (Math.random()-0.5)*2;
              } else {
                // Move freely
                if(Math.random() < 0.05) { p.vx = (Math.random()-0.5)*speed; p.vy = (Math.random()-0.5)*speed; }
                p.x += p.vx; p.y += p.vy;
                
                // Contain in box if liquid (bottom half), full box if gas
                let maxY = state === "Liquid" ? 300 : 300;
                let minY = state === "Liquid" ? 150 : 0;
                
                if(p.x < 0 || p.x > 400) p.vx *= -1;
                if(p.y < minY || p.y > maxY) p.vy *= -1;
                
                // Keep inside bounds
                p.x = Math.max(0, Math.min(400, p.x));
                p.y = Math.max(minY, Math.min(maxY, p.y));
              }
              
              pCtx.beginPath();
              pCtx.arc(p.x, p.y, 4, 0, Math.PI*2);
              pCtx.fillStyle = color;
              pCtx.fill();
            });
            requestAnimationFrame(drawParticles);
          }
          drawParticles();
        </script>
        """
    },
    {
        "ch_num": 2,
        "chap_num": "2",
        "chap_title": "Is Matter Around Us Pure",
        "importance_text": "Distinguishing between pure substances and mixtures, and understanding different separation techniques.",
        "sidebar_links": "<li><a href='#pure'>Pure Substances</a></li><li><a href='#mix'>Mixtures & Solutions</a></li><li><a href='#sep'>Separation Techniques</a></li>",
        "main_content": """
        <section id='pure'>
            <h2>1. Pure Substances</h2>
            <p>Consist of a single type of particles. Classified into:</p>
            <ul>
                <li><strong>Elements:</strong> Basic form of matter that cannot be broken down (e.g., Iron, Gold).</li>
                <li><strong>Compounds:</strong> Two or more elements chemically combined in fixed proportion (e.g., H₂O, NaCl).</li>
            </ul>
        </section>
        <section id='mix'>
            <h2>2. Mixtures and Solutions</h2>
            <p>More than one substance mixed in any proportion.</p>
            <ul>
                <li><strong>Homogeneous:</strong> Uniform composition (e.g., Sugar in water). Called Solutions.</li>
                <li><strong>Heterogeneous:</strong> Non-uniform composition (e.g., Sand and salt). Suspensions and Colloids.</li>
            </ul>
            <div class='key-memorize'><strong>Tyndall Effect:</strong> Scattering of a beam of light by colloidal particles. Suspensions and Colloids show this, true solutions do not.</div>
        </section>
        <section id='sep'>
            <h2>3. Separation Techniques</h2>
            <p>Methods to separate mixtures: Evaporation, Centrifugation, Separating funnel (immiscible liquids), Sublimation, Chromatography (colors/dyes), and Distillation (miscible liquids).</p>
        </section>
        """,
        "pyq_list": """
            <li>Differentiate between a mixture and a compound. (3 Marks)</li>
            <li>What is the Tyndall effect? Give an example. (2 Marks)</li>
            <li>Which separation technique will you apply for the separation of butter from curd? (1 Mark)</li>
        """,
        "revision_tips": "<li>Concentration of solution = (Mass of solute / Mass of solution) × 100.</li><li>Alloys are considered mixtures because they show properties of their constituents.</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: Mixture vs Pure Substance Sorter</h3>
          <p>Drag or click to classify the following items correctly!</p>
          <div style="display:flex; justify-content:space-between; margin-bottom: 20px;">
            <div id="pureBin" style="width:45%; background:#dcfce7; border:2px dashed #16a34a; padding:10px; min-height:100px; border-radius:8px; text-align:center;">
                <h4 style="color:#16a34a; margin-top:0;">Pure Substances</h4>
                <div id="pureItems"></div>
            </div>
            <div id="mixBin" style="width:45%; background:#fee2e2; border:2px dashed #dc2626; padding:10px; min-height:100px; border-radius:8px; text-align:center;">
                <h4 style="color:#dc2626; margin-top:0;">Mixtures</h4>
                <div id="mixItems"></div>
            </div>
          </div>
          <div style="background:#f8fafc; padding:10px; border-radius:8px; text-align:center;">
             <p style="font-weight:bold; margin-top:0;">Items to sort:</p>
             <button class="sort-item" onclick="sortItem(this, 'pure')" style="margin:5px; padding:5px 10px; border-radius:15px; border:1px solid #cbd5e1; cursor:pointer;">Water (H2O)</button>
             <button class="sort-item" onclick="sortItem(this, 'mix')" style="margin:5px; padding:5px 10px; border-radius:15px; border:1px solid #cbd5e1; cursor:pointer;">Air</button>
             <button class="sort-item" onclick="sortItem(this, 'pure')" style="margin:5px; padding:5px 10px; border-radius:15px; border:1px solid #cbd5e1; cursor:pointer;">Gold (Au)</button>
             <button class="sort-item" onclick="sortItem(this, 'mix')" style="margin:5px; padding:5px 10px; border-radius:15px; border:1px solid #cbd5e1; cursor:pointer;">Milk</button>
             <button class="sort-item" onclick="sortItem(this, 'mix')" style="margin:5px; padding:5px 10px; border-radius:15px; border:1px solid #cbd5e1; cursor:pointer;">Blood</button>
          </div>
        </div>
        """,
        "interactive_script": """
        <script>
          function sortItem(btn, type) {
            btn.style.display = 'inline-block';
            if(type === 'pure') {
                btn.style.background = '#bbf7d0';
                document.getElementById('pureItems').appendChild(btn);
            } else {
                btn.style.background = '#fecaca';
                document.getElementById('mixItems').appendChild(btn);
            }
            btn.onclick = null; // Disable clicking again
          }
        </script>
        """
    },
    {
        "ch_num": 3,
        "chap_num": "3",
        "chap_title": "Atoms and Molecules",
        "importance_text": "Lays the foundation for chemical formulas and stoichiometry. The mole concept is extremely important.",
        "sidebar_links": "<li><a href='#laws'>Laws of Chemical Combination</a></li><li><a href='#dalton'>Dalton's Theory</a></li><li><a href='#molecules'>Atoms, Ions & Molecules</a></li><li><a href='#mole'>Mole Concept</a></li>",
        "main_content": """
        <section id='laws'>
            <h2>1. Laws of Chemical Combination</h2>
            <p><strong>Law of Conservation of Mass:</strong> Mass can neither be created nor destroyed in a chemical reaction.</p>
            <p><strong>Law of Constant Proportions:</strong> In a chemical substance, elements are always present in definite proportions by mass (e.g., H₂O is always 1:8 by mass).</p>
        </section>
        <section id='molecules'>
            <h2>2. Atoms, Molecules, and Ions</h2>
            <p><strong>Atom:</strong> The smallest particle of an element. (e.g., H, O, N)</p>
            <p><strong>Molecule:</strong> A group of two or more atoms chemically bonded. (e.g., H₂, H₂O)</p>
            <p><strong>Ion:</strong> A charged species (Cation = positive, Anion = negative).</p>
        </section>
        <section id='mole'>
            <h2>3. Mole Concept</h2>
            <p>1 Mole of any substance = 6.022 × 10²³ particles (atoms, molecules, or ions). This is called Avogadro's number.</p>
            <div class='formula-box-custom'>Number of moles (n) = Given Mass (m) / Molar Mass (M)<br>Number of moles (n) = Number of particles (N) / Avogadro number (N₀)</div>
        </section>
        """,
        "pyq_list": """
            <li>State the law of constant proportions. (1 Mark)</li>
            <li>Write the chemical formula for Aluminium chloride. (1 Mark)</li>
            <li>Calculate the number of moles in 52g of He. (Atomic mass of He = 4u) (2 Marks)</li>
        """,
        "revision_tips": "<li>Molar mass of H₂O = 18g. Molar mass of CO₂ = 44g.</li><li>To write chemical formulas, cross-multiply the valencies.</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: Mole Calculator</h3>
          <p>Select a substance and enter mass in grams to calculate the number of moles and particles.</p>
          <div class="controls">
            <div class="control-group">
                <label>Substance:</label>
                <select id="substSelect">
                    <option value="18">Water (H2O) - 18g/mol</option>
                    <option value="44">Carbon Dioxide (CO2) - 44g/mol</option>
                    <option value="32">Oxygen gas (O2) - 32g/mol</option>
                    <option value="58.5">Salt (NaCl) - 58.5g/mol</option>
                </select>
            </div>
            <div class="control-group">
                <label>Given Mass (g): <span id="massVal">36</span></label>
                <input type="range" id="massRange" min="1" max="200" value="36">
            </div>
            <div style="background:#eef2ff; padding:15px; border-radius:8px; margin-top:10px; text-align:center;">
                <h4 style="margin:0 0 10px 0; color:#1e40af;">Results</h4>
                <div><strong>Moles:</strong> <span id="moleCalc">2.00</span> mol</div>
                <div style="margin-top:5px;"><strong>Particles:</strong> <span id="partCalc">12.044 × 10²³</span></div>
            </div>
          </div>
        </div>
        """,
        "interactive_script": """
        <script>
          function calcMole() {
            let M = parseFloat(document.getElementById('substSelect').value);
            let m = parseFloat(document.getElementById('massRange').value);
            document.getElementById('massVal').innerText = m;
            
            let moles = (m / M);
            document.getElementById('moleCalc').innerText = moles.toFixed(2);
            
            let particles = moles * 6.022;
            document.getElementById('partCalc').innerText = particles.toFixed(3) + " × 10²³";
          }
          document.getElementById('substSelect').onchange = calcMole;
          document.getElementById('massRange').oninput = calcMole;
          calcMole();
        </script>
        """
    },
    {
        "ch_num": 4,
        "chap_num": "4",
        "chap_title": "Structure of the Atom",
        "importance_text": "Understanding subatomic particles, atomic models, and electronic configuration is essential for mastering chemistry.",
        "sidebar_links": "<li><a href='#models'>Atomic Models</a></li><li><a href='#particles'>Subatomic Particles</a></li><li><a href='#config'>Electronic Configuration</a></li><li><a href='#iso'>Isotopes & Isobars</a></li>",
        "main_content": """
        <section id='models'>
            <h2>1. Atomic Models</h2>
            <p><strong>J.J. Thomson's Model:</strong> Atom is a positively charged sphere with electrons embedded in it (Plum pudding model).</p>
            <p><strong>Rutherford's Model:</strong> Gold foil experiment showed that atom has a tiny, dense, positively charged nucleus at the center, and electrons revolve around it.</p>
            <p><strong>Bohr's Model:</strong> Electrons revolve in discrete orbits (K, L, M, N shells) and do not radiate energy while in these orbits.</p>
        </section>
        <section id='particles'>
            <h2>2. Subatomic Particles</h2>
            <ul>
                <li><strong>Electron (e⁻):</strong> Negatively charged, discovered by J.J. Thomson.</li>
                <li><strong>Proton (p⁺):</strong> Positively charged, discovered by E. Goldstein.</li>
                <li><strong>Neutron (n⁰):</strong> No charge, discovered by J. Chadwick.</li>
            </ul>
        </section>
        <section id='config'>
            <h2>3. Electronic Configuration & Valency</h2>
            <p>Max electrons in a shell is given by <strong>2n²</strong>. K shell max = 2, L shell max = 8. Valency is the combining capacity of an element, determined by valence electrons.</p>
        </section>
        <section id='iso'>
            <h2>4. Isotopes and Isobars</h2>
            <p><strong>Isotopes:</strong> Same atomic number, different mass number (e.g., ¹²C, ¹⁴C). Chemical properties are similar.</p>
            <p><strong>Isobars:</strong> Same mass number, different atomic number (e.g., ⁴⁰Ar, ⁴⁰Ca).</p>
        </section>
        """,
        "pyq_list": """
            <li>Describe Rutherford's alpha-particle scattering experiment. (3 Marks)</li>
            <li>What are isotopes? State one application of an isotope. (2 Marks)</li>
            <li>Write the electronic configuration of Sodium (Atomic No. 11). (1 Mark)</li>
        """,
        "revision_tips": "<li>Atomic Number (Z) = Number of Protons.</li><li>Mass Number (A) = Protons + Neutrons.</li><li>Valency of Noble gases is 0.</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: Bohr Model Visualizer</h3>
          <p>Select an element to see its electronic configuration in K, L, M shells.</p>
          <div class="controls" style="margin-bottom: 1rem; flex-direction: row; justify-content: center;">
            <label>Element:</label>
            <select id="elemSelect">
                <option value="1">Hydrogen (1)</option>
                <option value="2">Helium (2)</option>
                <option value="6">Carbon (2, 4)</option>
                <option value="8">Oxygen (2, 6)</option>
                <option value="11" selected>Sodium (2, 8, 1)</option>
                <option value="17">Chlorine (2, 8, 7)</option>
            </select>
          </div>
          <div class="canvas-container"><canvas id="bohrCanvas" width="400" height="300" style="background:#0f172a;"></canvas></div>
        </div>
        """,
        "interactive_script": """
        <script>
          const bCanv = document.getElementById('bohrCanvas');
          const bCtx = bCanv.getContext('2d');
          
          function drawBohr() {
            let Z = parseInt(document.getElementById('elemSelect').value);
            
            bCtx.clearRect(0,0,400,300);
            
            // Draw Nucleus
            bCtx.beginPath();
            bCtx.arc(200, 150, 15, 0, Math.PI*2);
            bCtx.fillStyle = "#ef4444";
            bCtx.fill();
            bCtx.fillStyle = "white";
            bCtx.font = "12px Arial";
            bCtx.textAlign = "center";
            bCtx.fillText("+"+Z, 200, 154);
            
            // Shells configuration
            let shells = [0, 0, 0];
            if(Z <= 2) shells[0] = Z;
            else if(Z <= 10) { shells[0] = 2; shells[1] = Z - 2; }
            else { shells[0] = 2; shells[1] = 8; shells[2] = Z - 10; }
            
            let radii = [40, 80, 120];
            let time = Date.now() / 1000;
            
            for(let i=0; i<3; i++) {
                if(shells[i] === 0) continue;
                
                // Draw orbit
                bCtx.beginPath();
                bCtx.arc(200, 150, radii[i], 0, Math.PI*2);
                bCtx.strokeStyle = "#475569";
                bCtx.stroke();
                
                // Draw electrons
                for(let e=0; e<shells[i]; e++) {
                    let angle = (e * (Math.PI*2 / shells[i])) + time * (1.5 - i*0.4); // outer shells rotate slower
                    let ex = 200 + radii[i] * Math.cos(angle);
                    let ey = 150 + radii[i] * Math.sin(angle);
                    
                    bCtx.beginPath();
                    bCtx.arc(ex, ey, 5, 0, Math.PI*2);
                    bCtx.fillStyle = "#3b82f6";
                    bCtx.fill();
                }
            }
            requestAnimationFrame(drawBohr);
          }
          document.getElementById('elemSelect').onchange = () => {};
          drawBohr();
        </script>
        """
    }
]

for ch in chapters:
    html = HTML_TEMPLATE
    for key, value in ch.items():
        html = html.replace("{" + key + "}", str(value))
    
    with open(f"/home/shubham_singh/Documents/NeoBranium/Notes/9-CH{ch['ch_num']}.html", "w") as f:
        f.write(html)

print("Generated all 4 Chemistry HTML files successfully.")
