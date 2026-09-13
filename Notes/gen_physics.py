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
    .canvas-container { width: 100%; max-width: 600px; margin: 1rem auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; display: flex; justify-content: center; position: relative;}
    .controls { display: flex; flex-direction: column; gap: 1rem; max-width: 400px; margin: 0 auto; background: #f1f5f9; padding: 1rem; border-radius: 8px;}
    .control-group { display: flex; justify-content: space-between; align-items: center; }
    .control-group input[type="range"] { flex-grow: 1; margin-left: 1rem; }
    
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
        "ph_num": 1,
        "chap_num": "8",
        "chap_title": "Motion",
        "importance_text": "Motion lays the foundation for all of mechanics. Graphical representation and equations of motion are heavily tested.",
        "sidebar_links": "<li><a href='#distance'>Distance & Displacement</a></li><li><a href='#velocity'>Speed & Velocity</a></li><li><a href='#acceleration'>Acceleration</a></li><li><a href='#equations'>Equations of Motion</a></li>",
        "main_content": """
        <section id='distance'>
            <h2>1. Distance and Displacement</h2>
            <p><strong>Distance:</strong> The actual path length covered by an object. It is a scalar quantity and is always positive.</p>
            <p><strong>Displacement:</strong> The shortest distance between the initial and final position. It is a vector quantity (can be positive, negative, or zero).</p>
        </section>
        <section id='velocity'>
            <h2>2. Speed and Velocity</h2>
            <p><strong>Speed</strong> = Distance / Time. (Scalar, SI unit: m/s)</p>
            <p><strong>Velocity</strong> = Displacement / Time. (Vector, SI unit: m/s)</p>
            <div class='key-memorize'>Average Velocity = (Initial Velocity + Final Velocity) / 2 = (u + v) / 2</div>
        </section>
        <section id='acceleration'>
            <h2>3. Acceleration</h2>
            <p>Acceleration is the rate of change of velocity.</p>
            <div class='formula-box-custom'>a = (v - u) / t</div>
            <p>Where v = final velocity, u = initial velocity, t = time. SI unit is m/s².</p>
        </section>
        <section id='equations'>
            <h2>4. Equations of Motion</h2>
            <p>These equations apply to uniform acceleration:</p>
            <div class='formula-box-custom'>
                1. v = u + at<br>
                2. s = ut + ½at²<br>
                3. v² - u² = 2as
            </div>
        </section>
        """,
        "pyq_list": """
            <li>Differentiate between distance and displacement. (2 Marks)</li>
            <li>A train starting from rest attains a velocity of 72 km/h in 5 minutes. Find its acceleration. (3 Marks)</li>
            <li>What does the slope of a distance-time graph indicate? (1 Mark)</li>
        """,
        "revision_tips": "<li>Always convert km/h to m/s by multiplying with 5/18 before solving numericals.</li><li>If a body starts from rest, u = 0.</li><li>If a body comes to stop, v = 0.</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: Velocity-Time Graph Live Plotter</h3>
          <p>Adjust the initial velocity (u) and acceleration (a) to see how the v-t graph changes. Area under the curve gives displacement!</p>
          <div class="canvas-container"><canvas id="vtCanvas" width="500" height="300"></canvas></div>
          <div class="controls">
            <div class="control-group"><label>Initial Velocity (u): <span id="uVal">10</span> m/s</label><input type="range" id="uRange" min="0" max="50" value="10"></div>
            <div class="control-group"><label>Acceleration (a): <span id="aVal">2</span> m/s²</label><input type="range" id="aRange" min="-5" max="10" value="2"></div>
          </div>
        </div>
        """,
        "interactive_script": """
        <script>
          const canvas = document.getElementById('vtCanvas');
          const ctx = canvas.getContext('2d');
          const uRange = document.getElementById('uRange');
          const aRange = document.getElementById('aRange');
          const uVal = document.getElementById('uVal');
          const aVal = document.getElementById('aVal');
          
          function draw() {
            ctx.clearRect(0,0,500,300);
            let u = parseInt(uRange.value);
            let a = parseInt(aRange.value);
            uVal.innerText = u; aVal.innerText = a;
            
            // Draw grid
            ctx.strokeStyle = "#e2e8f0";
            ctx.lineWidth = 1;
            for(let i=0; i<500; i+=50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 300); ctx.stroke(); }
            for(let i=0; i<300; i+=50) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(500, i); ctx.stroke(); }
            
            // Draw axes
            ctx.strokeStyle = "black";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(50, 10); ctx.lineTo(50, 250); ctx.lineTo(490, 250); // y-axis, x-axis
            ctx.stroke();
            
            // Draw line
            ctx.beginPath();
            ctx.moveTo(50, 250 - u*2);
            ctx.lineTo(450, 250 - (u + a*10)*2);
            ctx.strokeStyle = "#2563eb"; // blue
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Add labels
            ctx.fillStyle = "black";
            ctx.font = "14px Arial";
            ctx.fillText("Time (t) ->", 200, 280);
            ctx.save();
            ctx.translate(20, 180);
            ctx.rotate(-Math.PI/2);
            ctx.fillText("Velocity (v)", 0, 0);
            ctx.restore();
          }
          uRange.oninput = draw; aRange.oninput = draw;
          draw();
        </script>
        """
    },
    {
        "ph_num": 2,
        "chap_num": "9",
        "chap_title": "Force and Laws of Motion",
        "importance_text": "Newton's laws are foundational. Direct application in daily life and numerical problems are highly scored.",
        "sidebar_links": "<li><a href='#force'>Force Basics</a></li><li><a href='#newton1'>Newton's First Law</a></li><li><a href='#newton2'>Newton's Second Law</a></li><li><a href='#newton3'>Newton's Third Law</a></li><li><a href='#momentum'>Conservation of Momentum</a></li>",
        "main_content": """
        <section id='force'>
            <h2>1. Force and its Effects</h2>
            <p>A push or pull on a body is called force. It can change the state of rest or motion of a body, change its speed, direction, or shape.</p>
            <p><strong>Balanced Forces:</strong> Net force is zero. No change in motion.</p>
            <p><strong>Unbalanced Forces:</strong> Net force is not zero. Causes acceleration.</p>
        </section>
        <section id='newton1'>
            <h2>2. Newton's First Law of Motion (Law of Inertia)</h2>
            <p>An object remains in a state of rest or of uniform motion in a straight line unless compelled to change that state by an applied force.</p>
            <div class='key-memorize'><strong>Inertia:</strong> The natural tendency of objects to resist a change in their state of rest or of uniform motion. Mass is the measure of inertia.</div>
        </section>
        <section id='newton2'>
            <h2>3. Newton's Second Law of Motion</h2>
            <p>The rate of change of momentum of an object is proportional to the applied unbalanced force in the direction of the force.</p>
            <div class='formula-box-custom'>F = m × a<br>or<br>F = m(v - u) / t</div>
            <p>SI unit of force is <strong>Newton (N)</strong>.</p>
        </section>
        <section id='momentum'>
            <h2>4. Conservation of Momentum</h2>
            <p>In the absence of an external force, the total momentum of a system remains conserved.</p>
            <div class='formula-box-custom'>m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂</div>
        </section>
        """,
        "pyq_list": """
            <li>Why do we fall forward when a moving bus applies brakes suddenly? (2 Marks)</li>
            <li>Derive the mathematical formulation of Newton's second law. (3 Marks)</li>
            <li>State the law of conservation of momentum. (2 Marks)</li>
        """,
        "revision_tips": "<li>1 Newton = 1 kg·m/s².</li><li>Action and reaction forces act on two different bodies.</li><li>Momentum (p) = mass (m) × velocity (v).</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: Newton's 2nd Law Simulator</h3>
          <p>Change Force and Mass to see how acceleration (and thus the block's movement) changes!</p>
          <div class="canvas-container" style="padding: 2rem; background: #eef2ff;">
            <div id="block" style="width:60px;height:60px;background:#ef4444;border-radius:8px;position:relative;left:0;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;box-shadow:0 4px 6px rgba(0,0,0,0.1);">5 kg</div>
          </div>
          <div class="controls">
            <div class="control-group"><label>Force: <span id="fVal">20</span> N</label><input type="range" id="fRange" min="5" max="100" value="20"></div>
            <div class="control-group"><label>Mass: <span id="mVal">5</span> kg</label><input type="range" id="mRange" min="1" max="20" value="5"></div>
            <button onclick="animateBlock()" style="background:#2563eb;color:white;border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:bold;">Apply Force</button>
            <div style="text-align:center;font-weight:bold;margin-top:10px;">Acceleration: <span id="aCalc">4</span> m/s²</div>
          </div>
        </div>
        """,
        "interactive_script": """
        <script>
          function animateBlock() {
            let f = parseInt(document.getElementById('fRange').value);
            let m = parseInt(document.getElementById('mRange').value);
            let a = f/m;
            document.getElementById('aCalc').innerText = a.toFixed(1);
            let block = document.getElementById('block');
            
            // Reset position
            block.style.transition = 'none';
            block.style.left = '0';
            
            // Trigger reflow
            void block.offsetWidth; 
            
            // Animate
            let time = Math.sqrt(2 * 400 / (a * 10)); // Simulated time for s=400px
            block.style.transition = `left ${time}s cubic-bezier(0.4, 0, 1, 1)`; // Constant acceleration curve approximation
            block.style.left = '400px';
          }
          document.getElementById('fRange').oninput = function(){document.getElementById('fVal').innerText = this.value; document.getElementById('aCalc').innerText = (this.value/document.getElementById('mRange').value).toFixed(1);};
          document.getElementById('mRange').oninput = function(){document.getElementById('mVal').innerText = this.value; document.getElementById('block').innerText = this.value + ' kg'; document.getElementById('aCalc').innerText = (document.getElementById('fRange').value/this.value).toFixed(1);};
        </script>
        """
    },
    {
        "ph_num": 3,
        "chap_num": "10",
        "chap_title": "Gravitation",
        "importance_text": "Understanding universal gravitation and gravity formulas is key for class 11 physics. Derivations are frequent.",
        "sidebar_links": "<li><a href='#univ'>Universal Law</a></li><li><a href='#freefall'>Free Fall & g</a></li><li><a href='#massweight'>Mass vs Weight</a></li><li><a href='#buoyancy'>Thrust & Buoyancy</a></li>",
        "main_content": """
        <section id='univ'>
            <h2>1. Universal Law of Gravitation</h2>
            <p>Every object in the universe attracts every other object with a force which is proportional to the product of their masses and inversely proportional to the square of the distance between them.</p>
            <div class='formula-box-custom'>F = G × (M × m) / d²</div>
            <p>Where G is the Universal Gravitation Constant (6.673 × 10⁻¹¹ N m²/kg²).</p>
        </section>
        <section id='freefall'>
            <h2>2. Free Fall and Acceleration Due to Gravity (g)</h2>
            <p>Whenever objects fall towards the earth under this force alone, we say that the objects are in free fall.</p>
            <div class='formula-box-custom'>g = G × M / R²</div>
            <p>Value of g on the surface of earth is <strong>9.8 m/s²</strong>.</p>
        </section>
        <section id='massweight'>
            <h2>3. Mass and Weight</h2>
            <p><strong>Mass:</strong> Quantity of matter contained in a body. It remains constant everywhere.</p>
            <p><strong>Weight:</strong> The force with which the earth attracts an object. W = m × g. Weight varies with location (e.g., Weight on Moon = 1/6th of Weight on Earth).</p>
        </section>
        """,
        "pyq_list": """
            <li>State the universal law of gravitation. (2 Marks)</li>
            <li>Differentiate between mass and weight. (3 Marks)</li>
            <li>Why is the weight of an object on the moon 1/6th its weight on the earth? (2 Marks)</li>
        """,
        "revision_tips": "<li>G is constant everywhere, g varies with height and depth.</li><li>Equations of motion can be used for freely falling bodies by replacing 'a' with 'g'.</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: Projectile Motion Simulator</h3>
          <p>Fire a projectile under gravity. Adjust velocity and angle to see the trajectory!</p>
          <div class="canvas-container"><canvas id="projCanvas" width="500" height="300"></canvas></div>
          <div class="controls">
            <div class="control-group"><label>Velocity: <span id="vVal">50</span> m/s</label><input type="range" id="vRange" min="10" max="100" value="50"></div>
            <div class="control-group"><label>Angle: <span id="angVal">45</span>°</label><input type="range" id="angRange" min="10" max="80" value="45"></div>
          </div>
        </div>
        """,
        "interactive_script": """
        <script>
          const pCanv = document.getElementById('projCanvas');
          const pCtx = pCanv.getContext('2d');
          function drawProj() {
            let v = parseInt(document.getElementById('vRange').value);
            let ang = parseInt(document.getElementById('angRange').value);
            document.getElementById('vVal').innerText = v;
            document.getElementById('angVal').innerText = ang;
            
            pCtx.clearRect(0,0,500,300);
            
            // Draw grid
            pCtx.strokeStyle = "#e2e8f0"; pCtx.lineWidth = 1;
            for(let i=0; i<500; i+=50) { pCtx.beginPath(); pCtx.moveTo(i, 0); pCtx.lineTo(i, 300); pCtx.stroke(); }
            
            // Draw ground
            pCtx.fillStyle = "#22c55e"; pCtx.fillRect(0, 290, 500, 10);
            
            // Draw trajectory
            pCtx.beginPath();
            pCtx.moveTo(10, 290);
            let rad = ang * Math.PI / 180;
            let g = 9.8;
            for(let t=0; t<20; t+=0.1) {
              let x = 10 + (v * Math.cos(rad) * t);
              let y = 290 - (v * Math.sin(rad) * t - 0.5 * g * t * t);
              if (y > 290 && t > 0.1) {
                pCtx.lineTo(x, 290);
                break;
              }
              pCtx.lineTo(x, y);
            }
            pCtx.strokeStyle = '#ef4444'; 
            pCtx.lineWidth = 3;
            pCtx.stroke();
          }
          document.getElementById('vRange').oninput = drawProj;
          document.getElementById('angRange').oninput = drawProj;
          drawProj();
        </script>
        """
    },
    {
        "ph_num": 4,
        "chap_num": "11",
        "chap_title": "Work and Energy",
        "importance_text": "Understanding conservation of energy is crucial. Numerical questions on Kinetic and Potential energy are very common.",
        "sidebar_links": "<li><a href='#work'>Work</a></li><li><a href='#energy'>Energy (KE & PE)</a></li><li><a href='#power'>Power</a></li>",
        "main_content": """
        <section id='work'>
            <h2>1. Work Done</h2>
            <p>Work is said to be done when a force acts on an object and the object is displaced in the direction of the force.</p>
            <div class='formula-box-custom'>W = F × s</div>
            <p>SI unit of work is <strong>Joule (J)</strong>.</p>
        </section>
        <section id='energy'>
            <h2>2. Kinetic and Potential Energy</h2>
            <p><strong>Kinetic Energy (K.E.):</strong> Energy possessed by an object due to its motion.</p>
            <div class='formula-box-custom'>K.E. = ½ m v²</div>
            <p><strong>Potential Energy (P.E.):</strong> Energy possessed by an object due to its position or shape.</p>
            <div class='formula-box-custom'>P.E. = m × g × h</div>
        </section>
        <section id='power'>
            <h2>3. Power</h2>
            <p>Power is defined as the rate of doing work or the rate of transfer of energy.</p>
            <div class='formula-box-custom'>P = W / t</div>
            <p>SI unit of power is <strong>Watt (W)</strong>. 1 kW = 1000 W. Commercial unit of energy is kWh (1 kWh = 3.6 × 10⁶ J).</p>
        </section>
        """,
        "pyq_list": """
            <li>Define 1 Joule of work. (1 Mark)</li>
            <li>What is the kinetic energy of an object of mass m moving with a velocity v? (1 Mark)</li>
            <li>Calculate the electricity bill amount for a 100W bulb used for 10 hours a day for 30 days if cost is Rs 5 per kWh. (3 Marks)</li>
        """,
        "revision_tips": "<li>Total Mechanical Energy = Kinetic Energy + Potential Energy = Constant (Law of Conservation of Energy).</li><li>Work can be zero if force and displacement are perpendicular.</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: Energy Conservation Pendulum</h3>
          <p>Watch how Kinetic Energy (Red) and Potential Energy (Blue) convert into each other as the pendulum swings.</p>
          <div class="canvas-container" style="display:flex; justify-content:space-around; align-items:flex-end; height:200px; padding:20px; background:#f8fafc;">
             <div style="text-align:center; width: 60px;">
                <div style="width:100%; background:#3b82f6; height:100%; border-radius:4px 4px 0 0;" id="peBar"></div>
                <strong>PE</strong>
             </div>
             <div style="text-align:center; width: 60px;">
                <div style="width:100%; background:#ef4444; height:0%; border-radius:4px 4px 0 0;" id="keBar"></div>
                <strong>KE</strong>
             </div>
             <div style="text-align:center; width: 60px;">
                <div style="width:100%; background:#10b981; height:100%; border-radius:4px 4px 0 0;"></div>
                <strong>Total</strong>
             </div>
          </div>
          <div style="text-align:center; margin-top:1rem;">
             <button onclick="startSwing()" style="background:#10b981;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:bold;">Start Swing</button>
          </div>
        </div>
        """,
        "interactive_script": """
        <script>
          let swingInterval;
          function startSwing() {
            if(swingInterval) clearInterval(swingInterval);
            let t = 0;
            swingInterval = setInterval(()=>{
              t += 0.1;
              // Cosine wave for PE (max at ends, min at center)
              let pe = (Math.cos(t) + 1) * 50; 
              document.getElementById('peBar').style.height = pe + '%';
              document.getElementById('keBar').style.height = (100 - pe) + '%';
            }, 50);
          }
        </script>
        """
    },
    {
        "ph_num": 5,
        "chap_num": "12",
        "chap_title": "Sound",
        "importance_text": "Sound characteristics (frequency, amplitude, pitch, loudness) are crucial concepts. Echo numericals are board favorites.",
        "sidebar_links": "<li><a href='#prod'>Production & Propagation</a></li><li><a href='#char'>Characteristics of Sound</a></li><li><a href='#echo'>Reflection & Echo</a></li>",
        "main_content": """
        <section id='prod'>
            <h2>1. Production and Propagation</h2>
            <p>Sound is produced by vibrating objects. It is a mechanical wave and needs a material medium (solid, liquid, or gas) to propagate. It cannot travel in vacuum.</p>
            <p>It propagates through compressions (C) and rarefactions (R) in a medium.</p>
        </section>
        <section id='char'>
            <h2>2. Characteristics of Sound Wave</h2>
            <p><strong>Frequency (v):</strong> Number of oscillations per second. Unit is Hertz (Hz). Determines the pitch.</p>
            <p><strong>Amplitude (A):</strong> Maximum displacement of the medium particles. Determines the loudness.</p>
            <div class='formula-box-custom'>Speed (v) = Wavelength (λ) × Frequency (ν)</div>
        </section>
        <section id='echo'>
            <h2>3. Reflection of Sound and Echo</h2>
            <p>The sensation of sound persists in our brain for about 0.1 s. To hear a distinct echo, the time interval between the original sound and the reflected one must be at least 0.1s.</p>
            <div class='formula-box-custom'>Distance = Speed × Time / 2</div>
        </section>
        """,
        "pyq_list": """
            <li>Explain how sound is produced by your school bell. (2 Marks)</li>
            <li>A person clapped his hands near a cliff and heard the echo after 2 s. What is the distance of the cliff? (Speed of sound = 346 m/s) (3 Marks)</li>
            <li>What is the audible range of the average human ear? (1 Mark)</li>
        """,
        "revision_tips": "<li>Speed of sound: Solid > Liquid > Gas.</li><li>Pitch depends on frequency; Loudness depends on amplitude.</li><li>Ultrasound has frequency > 20,000 Hz.</li>",
        "interactive_card": """
        <div class="interactive-card">
          <h3>Interactive: Sound Waveform Visualizer</h3>
          <p>Change the frequency and amplitude to see how the sound wave changes visually.</p>
          <div class="canvas-container"><canvas id="waveCanvas" width="500" height="200"></canvas></div>
          <div class="controls">
            <div class="control-group"><label>Frequency (Pitch): <span id="fqVal">5</span></label><input type="range" id="fqRange" min="1" max="20" value="5"></div>
            <div class="control-group"><label>Amplitude (Loudness): <span id="ampVal">50</span></label><input type="range" id="ampRange" min="10" max="100" value="50"></div>
          </div>
        </div>
        """,
        "interactive_script": """
        <script>
          const wCtx = document.getElementById('waveCanvas').getContext('2d');
          function drawWave() {
            let f = parseInt(document.getElementById('fqRange').value);
            let a = parseInt(document.getElementById('ampRange').value);
            document.getElementById('fqVal').innerText = f;
            document.getElementById('ampVal').innerText = a;
            
            wCtx.clearRect(0,0,500,200);
            
            // Draw center line
            wCtx.beginPath();
            wCtx.moveTo(0,100);
            wCtx.lineTo(500,100);
            wCtx.strokeStyle = "#cbd5e1";
            wCtx.lineWidth = 1;
            wCtx.stroke();
            
            // Draw wave
            wCtx.beginPath();
            wCtx.moveTo(0,100);
            for(let i=0; i<500; i++) {
              wCtx.lineTo(i, 100 + a * Math.sin(i * f * 0.015));
            }
            wCtx.strokeStyle = '#8b5cf6'; 
            wCtx.lineWidth = 3;
            wCtx.stroke();
          }
          document.getElementById('fqRange').oninput = drawWave;
          document.getElementById('ampRange').oninput = drawWave;
          drawWave();
        </script>
        """
    }
]

for ch in chapters:
    # Safely replace tags so we don't trip over CSS curly braces
    html = HTML_TEMPLATE
    for key, value in ch.items():
        html = html.replace("{" + key + "}", str(value))
    
    with open(f"/home/shubham_singh/Documents/NeoBranium/Notes/9-PH{ch['ph_num']}.html", "w") as f:
        f.write(html)

print("Generated all 5 Physics HTML files successfully.")
