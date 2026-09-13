import os

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Class 9 Science Chapter {chap_num}: {chap_title} | Detailed NCERT Notes | NeoBranium</title>
  <meta name="description" content="Most repeated and exam-focused notes for Class 9 Science Chapter {chap_num} - {chap_title}. Includes detailed concepts, diagrams, and previous year questions. CBSE board 2025-26.">
  <meta name="keywords" content="class 9 science chapter {chap_num}, {chap_title}, NCERT notes, biology, board exam">
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
        "bi_num": 1,
        "chap_num": "5",
        "chap_title": "The Fundamental Unit of Life",
        "importance_text": "Cell structure and organelles are highly tested. Differences between plant and animal cells are guaranteed exam questions.",
        "sidebar_links": "<li><a href='#intro'>Introduction to Cell</a></li><li><a href='#membrane'>Plasma Membrane</a></li><li><a href='#nucleus'>Nucleus & Cytoplasm</a></li><li><a href='#organelles'>Cell Organelles</a></li>",
        "main_content": """
        <section id='intro'>
            <h2>1. Introduction to Cell</h2>
            <p>Cells are the basic structural and functional units of living organisms. Discovered by <strong>Robert Hooke</strong> in 1665.</p>
            <p><strong>Cell Theory:</strong> Proposed by Schleiden and Schwann. All plants and animals are composed of cells, and cells arise from pre-existing cells (Virchow).</p>
        </section>
        <section id='membrane'>
            <h2>2. Plasma Membrane / Cell Membrane</h2>
            <p>It is the outermost covering of the cell that separates its contents from the external environment. It is a <strong>selectively permeable membrane</strong>.</p>
            <ul>
                <li><strong>Diffusion:</strong> Spontaneous movement of a substance from high to low concentration (e.g., CO₂, O₂).</li>
                <li><strong>Osmosis:</strong> Passage of water from high water concentration through a semi-permeable membrane to a low water concentration.</li>
            </ul>
        </section>
        <section id='organelles'>
            <h2>3. Cell Organelles</h2>
            <p>Important components inside the cell, each performing specific functions:</p>
            <ul>
                <li><strong>Mitochondria:</strong> Powerhouse of the cell. Produces ATP.</li>
                <li><strong>Plastids:</strong> Present only in plant cells. Chloroplasts contain chlorophyll (photosynthesis).</li>
                <li><strong>Lysosomes:</strong> Suicide bags of the cell. Contain digestive enzymes.</li>
                <li><strong>Ribosomes:</strong> Protein factories.</li>
            </ul>
        </section>
        """,
        "pyq_list": """
            <li>Why is the plasma membrane called a selectively permeable membrane? (2 Marks)</li>
            <li>What would happen if the plasma membrane ruptures or breaks down? (2 Marks)</li>
            <li>Differentiate between rough and smooth endoplasmic reticulum. (3 Marks)</li>
        """,
        "revision_tips": "<li>Plant cells have a cell wall made of cellulose; animal cells do not.</li><li>Nucleus controls all activities of the cell.</li><li>ATP = Adenosine Triphosphate.</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: Cell Organelle Explorer</h3>
          <p>Hover over or tap the colorful dots (organelles) inside the cell to discover their names and functions!</p>
          <div style="display:flex; justify-content:center; gap: 2rem; align-items:center; flex-wrap:wrap;">
              <div style="position:relative; width: 250px; height: 250px; background:#e0f2fe; border: 4px solid #3b82f6; border-radius: 50%; box-shadow: inset 0 0 20px rgba(59, 130, 246, 0.3);">
                  <!-- Nucleus -->
                  <div class="organelle" onmouseover="showInfo('Nucleus: The brain of the cell. Contains DNA.')" style="position:absolute; top:80px; left:90px; width:60px; height:60px; background:#8b5cf6; border-radius:50%; cursor:pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.2);"></div>
                  <!-- Mitochondria -->
                  <div class="organelle" onmouseover="showInfo('Mitochondria: Powerhouse of the cell. Produces ATP.')" style="position:absolute; top:40px; left:50px; width:40px; height:20px; background:#ef4444; border-radius:10px; cursor:pointer; transform: rotate(45deg);"></div>
                  <div class="organelle" onmouseover="showInfo('Mitochondria: Powerhouse of the cell. Produces ATP.')" style="position:absolute; top:170px; left:160px; width:40px; height:20px; background:#ef4444; border-radius:10px; cursor:pointer; transform: rotate(-30deg);"></div>
                  <!-- Lysosome -->
                  <div class="organelle" onmouseover="showInfo('Lysosome: Suicide bag. Contains digestive enzymes.')" style="position:absolute; top:150px; left:40px; width:25px; height:25px; background:#10b981; border-radius:50%; cursor:pointer;"></div>
                  <!-- Golgi -->
                  <div class="organelle" onmouseover="showInfo('Golgi Apparatus: Packaging and dispatching unit.')" style="position:absolute; top:70px; left:170px; width:30px; height:40px; background:#f59e0b; border-radius:8px; cursor:pointer;"></div>
              </div>
              <div style="background:#fff; border:2px dashed #cbd5e1; padding: 1.5rem; border-radius: 12px; max-width: 250px; min-height: 120px;">
                  <h4 style="margin-top:0; color:#334155;">Organelle Info</h4>
                  <p id="orgInfo" style="color:#64748b; font-size:0.95rem;">Hover over an organelle to see its details here.</p>
              </div>
          </div>
        </div>
        """,
        "interactive_script": """
        <script>
          function showInfo(text) {
              document.getElementById('orgInfo').innerText = text;
              document.getElementById('orgInfo').style.color = '#0f172a';
              document.getElementById('orgInfo').style.fontWeight = '500';
          }
        </script>
        """
    },
    {
        "bi_num": 2,
        "chap_num": "6",
        "chap_title": "Tissues",
        "importance_text": "Understanding plant and animal tissues is critical. Difference between xylem/phloem and types of muscle tissues carry heavy marks.",
        "sidebar_links": "<li><a href='#plant'>Plant Tissues</a></li><li><a href='#animal'>Animal Tissues</a></li><li><a href='#nervous'>Nervous Tissue</a></li>",
        "main_content": """
        <section id='plant'>
            <h2>1. Plant Tissues</h2>
            <p><strong>Meristematic Tissue:</strong> Dividing tissue present at growing regions (Apical, Lateral, Intercalary).</p>
            <p><strong>Permanent Tissue:</strong> Formed from meristematic tissue when they lose the ability to divide.</p>
            <ul>
                <li><strong>Simple Permanent:</strong> Parenchyma (storage), Collenchyma (flexibility), Sclerenchyma (strength, e.g., coconut husk).</li>
                <li><strong>Complex Permanent:</strong> Xylem (conducts water & minerals) and Phloem (conducts food).</li>
            </ul>
        </section>
        <section id='animal'>
            <h2>2. Animal Tissues</h2>
            <p><strong>Epithelial:</strong> Protective covering (e.g., skin, lining of organs).</p>
            <p><strong>Connective:</strong> Connects and supports (e.g., Blood, Bone, Cartilage, Ligament, Tendon).</p>
            <p><strong>Muscular:</strong> Responsible for movement. Types: Striated (voluntary), Smooth (involuntary), Cardiac (heart).</p>
        </section>
        <section id='nervous'>
            <h2>3. Nervous Tissue</h2>
            <p>Highly specialized for being stimulated and transmitting stimulus rapidly. Consists of neurons (nerve cells).</p>
        </section>
        """,
        "pyq_list": """
            <li>Differentiate between parenchyma, collenchyma, and sclerenchyma. (3 Marks)</li>
            <li>What is the function of stomata? (2 Marks)</li>
            <li>Draw a labeled diagram of a neuron. (3 Marks)</li>
        """,
        "revision_tips": "<li>Xylem transports UP; Phloem transports UP & DOWN.</li><li>Ligament connects Bone to Bone; Tendon connects Muscle to Bone.</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: Tissue Flashcards</h3>
          <p>Click on a card to flip it and reveal the answer!</p>
          <div style="display:flex; justify-content:space-around; flex-wrap:wrap; gap:1rem;">
              
              <!-- Card 1 -->
              <div class="flip-card" onclick="this.classList.toggle('flipped')" style="width: 200px; height: 150px; perspective: 1000px; cursor: pointer;">
                  <div class="flip-card-inner" style="position:relative; width:100%; height:100%; text-align:center; transition: transform 0.6s; transform-style: preserve-3d;">
                      <div class="flip-card-front" style="position:absolute; width:100%; height:100%; backface-visibility:hidden; background:#e0f2fe; border-radius:12px; display:flex; align-items:center; justify-content:center; border:2px solid #bae6fd; font-weight:bold; color:#0369a1; padding:10px;">
                          What tissue makes up the husk of a coconut?
                      </div>
                      <div class="flip-card-back" style="position:absolute; width:100%; height:100%; backface-visibility:hidden; background:#10b981; color:white; border-radius:12px; display:flex; align-items:center; justify-content:center; transform: rotateY(180deg); font-weight:bold; font-size:1.2rem;">
                          Sclerenchyma
                      </div>
                  </div>
              </div>

              <!-- Card 2 -->
              <div class="flip-card" onclick="this.classList.toggle('flipped')" style="width: 200px; height: 150px; perspective: 1000px; cursor: pointer;">
                  <div class="flip-card-inner" style="position:relative; width:100%; height:100%; text-align:center; transition: transform 0.6s; transform-style: preserve-3d;">
                      <div class="flip-card-front" style="position:absolute; width:100%; height:100%; backface-visibility:hidden; background:#fef3c7; border-radius:12px; display:flex; align-items:center; justify-content:center; border:2px solid #fde68a; font-weight:bold; color:#b45309; padding:10px;">
                          Which muscle tissue is found in the heart?
                      </div>
                      <div class="flip-card-back" style="position:absolute; width:100%; height:100%; backface-visibility:hidden; background:#ef4444; color:white; border-radius:12px; display:flex; align-items:center; justify-content:center; transform: rotateY(180deg); font-weight:bold; font-size:1.2rem;">
                          Cardiac Muscle
                      </div>
                  </div>
              </div>

          </div>
        </div>
        """,
        "interactive_script": """
        <style>
            .flipped .flip-card-inner { transform: rotateY(180deg); }
        </style>
        """
    },
    {
        "bi_num": 3,
        "chap_num": "7",
        "chap_title": "Diversity in Living Organisms",
        "importance_text": "Taxonomy and classification hierarchy (Kingdom to Species) form the basis of biology.",
        "sidebar_links": "<li><a href='#class'>Classification</a></li><li><a href='#plant'>Plant Kingdom</a></li><li><a href='#animal'>Animal Kingdom</a></li>",
        "main_content": """
        <section id='class'>
            <h2>1. Basis of Classification</h2>
            <p>Organisms are grouped based on similarities. <strong>Hierarchy:</strong> Kingdom → Phylum → Class → Order → Family → Genus → Species.</p>
            <p><strong>Whittaker's 5 Kingdoms:</strong> Monera, Protista, Fungi, Plantae, Animalia.</p>
        </section>
        <section id='plant'>
            <h2>2. Plantae (Plant Kingdom)</h2>
            <p>Thallophyta (Algae), Bryophyta (Amphibians of plant kingdom), Pteridophyta, Gymnosperms (naked seeds), Angiosperms (covered seeds).</p>
        </section>
        <section id='animal'>
            <h2>3. Animalia (Animal Kingdom)</h2>
            <p>Divided into Non-Chordates (Porifera, Coelenterata, Platyhelminthes, Nematoda, Annelida, Arthropoda, Mollusca, Echinodermata) and Chordates (Pisces, Amphibia, Reptilia, Aves, Mammalia).</p>
        </section>
        """,
        "pyq_list": """
            <li>Which group of plants is called the amphibians of the plant kingdom and why? (2 Marks)</li>
            <li>Differentiate between Gymnosperms and Angiosperms. (3 Marks)</li>
            <li>List the conventions followed while writing the scientific names of organisms. (2 Marks)</li>
        """,
        "revision_tips": "<li>Arthropoda is the largest phylum of the animal kingdom (jointed legs).</li><li>Scientific name = <i>Genus species</i>.</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: 5 Kingdom Explorer</h3>
          <p>Click on a kingdom to see its key characteristics.</p>
          <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; justify-content:center;">
             <button onclick="showKingdom('Monera')" style="padding:10px 15px; background:#e2e8f0; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Monera</button>
             <button onclick="showKingdom('Protista')" style="padding:10px 15px; background:#e2e8f0; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Protista</button>
             <button onclick="showKingdom('Fungi')" style="padding:10px 15px; background:#e2e8f0; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Fungi</button>
             <button onclick="showKingdom('Plantae')" style="padding:10px 15px; background:#e2e8f0; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Plantae</button>
             <button onclick="showKingdom('Animalia')" style="padding:10px 15px; background:#e2e8f0; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Animalia</button>
          </div>
          <div id="kingdomDisplay" style="background:#fff; border:2px solid #3b82f6; padding:20px; border-radius:12px; min-height:100px;">
             <h4 style="margin-top:0; color:#1e40af;">Select a kingdom above</h4>
             <p>Details will appear here.</p>
          </div>
        </div>
        """,
        "interactive_script": """
        <script>
          const kData = {
              'Monera': 'Unicellular, Prokaryotic (no defined nucleus). Examples: Bacteria, Blue-green algae.',
              'Protista': 'Unicellular, Eukaryotic (defined nucleus). Have cilia/flagella. Examples: Amoeba, Paramecium.',
              'Fungi': 'Multicellular (mostly), Eukaryotic, Heterotrophic (saprophytes). Cell wall made of chitin. Examples: Yeast, Mushroom.',
              'Plantae': 'Multicellular, Eukaryotic, Autotrophic (photosynthesis). Cell wall made of cellulose.',
              'Animalia': 'Multicellular, Eukaryotic, Heterotrophic. No cell wall.'
          };
          function showKingdom(k) {
              document.getElementById('kingdomDisplay').innerHTML = '<h4 style="margin-top:0; color:#1e40af;">' + k + '</h4><p>' + kData[k] + '</p>';
          }
        </script>
        """
    }
]

for ch in chapters:
    html = HTML_TEMPLATE
    for key, value in ch.items():
        html = html.replace("{" + key + "}", str(value))
    
    with open(f"/home/shubham_singh/Documents/NeoBranium/Notes/9-BI{ch['bi_num']}.html", "w") as f:
        f.write(html)

print("Generated all 3 Biology HTML files successfully.")
