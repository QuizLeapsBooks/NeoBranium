def generate_eng_dir(cls, out_file):
    template = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Class {cls} English — Chapter Notes | NeoBranium</title>
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
      background: #8b5cf620; color: #8b5cf6; border: 1px solid #8b5cf640;
      padding: 0.3rem 0.9rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600;
      margin-bottom: 0.8rem;
    }}
    .back-btn {{
      display: inline-flex; align-items: center; gap: 0.5rem;
      color: #64748b; text-decoration: none; font-size: 0.9rem;
      margin: 1rem 0; transition: color 0.2s;
    }}
    .back-btn:hover {{ color: #8b5cf6; }}
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
      border-color: #8b5cf650;
    }}
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
      color: #8b5cf6; font-size: 0.82rem; font-weight: 600;
      display: flex; align-items: center; gap: 0.4rem; text-decoration: none;
    }}
    .read-link .fa-arrow-right {{ font-size: 0.7rem; transition: transform 0.2s; }}
    .chapter-card:hover .read-link .fa-arrow-right {{ transform: translateX(4px); }}
    h2.section-heading {{
      margin-top: 2rem;
      margin-bottom: 1rem;
      font-size: 1.5rem;
      color: #1e293b;
    }}
  </style>
</head>
<body>
  <div class="free-access-banner">
    <span class="badge"><i class="fas fa-sparkles"></i> 100% Free Access</span>
    <span class="banner-text">All Class 9 &amp; 10 Notes, Solved Questions, and Study Blogs are fully open — No Sign-In Required!</span>
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
        <input type="text" id="globalSearchInput" placeholder="Search notes..." autocomplete="off">
        <div id="globalSearchResults" class="search-results-dropdown"></div>
      </div>
      <button class="menu-toggle" aria-label="Toggle navigation" aria-expanded="false">☰</button>
      <nav class="nav-menu">
        <a href="../index.html">Home</a>
        <div class="nav-item">
          <a href="detailed-notes.html" class="active">Notes <i class="fas fa-chevron-down" style="font-size: 0.7rem;"></i></a>
          <div class="dropdown-menu">
            <div class="dropdown-submenu"><h5>Class 9</h5><ul><li><a href="class9-science-dir.html">Science</a></li><li><a href="class9-maths-dir.html">Mathematics</a></li><li><a href="class9-social-science-dir.html">Social Science</a></li><li><a href="class9-english-dir.html">English</a></li></ul></div>
            <div class="dropdown-submenu" style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:1rem;"><h5>Class 10</h5><ul><li><a href="class-wise-notes.html">Science</a></li><li><a href="class10-maths-dir.html">Mathematics</a></li><li><a href="class10-social-science-dir.html">Social Science</a></li></ul></div>
            <div class="dropdown-submenu" style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:1rem;"><h5>Class 11</h5><ul><li><a href="class11-physics-dir.html">Physics</a></li><li><a href="class11-chemistry-dir.html">Chemistry</a></li><li><a href="class11-maths-dir.html">Mathematics</a></li></ul></div>
            <div class="dropdown-submenu" style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:1rem;"><h5>Class 12</h5><ul><li><a href="class12-physics-dir.html">Physics</a></li><li><a href="class12-chemistry-dir.html">Chemistry</a></li><li><a href="class12-maths-dir.html">Mathematics</a></li></ul></div>
          </div>
        </div>
        <a href="../IQ/top-question.html">TopQs</a>
        <a href="../blog/blog.html">Blog</a>
      </nav>
    </div>
  </header>

  <main>
    <div class="notes-container" style="max-width:1200px;margin:0 auto;padding:2rem;">
      <a href="detailed-notes.html" class="back-btn"><i class="fas fa-arrow-left"></i> Back to Detailed Notes</a>

      <div class="directory-hero">
        <div class="subject-badge"><i class="fas fa-book"></i> English</div>
        <h1>Class {cls} English — Chapter Notes</h1>
        <p>Select a chapter to access detailed notes.</p>
      </div>

      <h2 class="section-heading">Beehive (Prose & Poetry)</h2>
      <div class="chapters-grid">
"""
    
    html_chaps = ""
    for i in range(1, 12):
        title = f"Chapter {i}"
        ch_num = f"BEE{i}"
        file_link = f"{cls}-ENG-{ch_num}.html"
        html_chaps += f"""
        <a href="{file_link}" class="chapter-card">
          <div class="card-header">
            <h3>{title}</h3>
            <span class="chapter-number" style="background:#8b5cf620;color:#8b5cf6;">English</span>
          </div>
          <div class="card-footer">
            <span class="read-link">Read Chapter <i class="fas fa-arrow-right"></i></span>
          </div>
        </a>"""
    
    template += html_chaps
    template += """
      </div>
      
      <h2 class="section-heading">Moments (Supplementary)</h2>
      <div class="chapters-grid">
"""

    html_chaps_moments = ""
    for i in range(1, 11):
        title = f"Chapter {i}"
        ch_num = f"MOM{i}"
        file_link = f"{cls}-ENG-{ch_num}.html"
        html_chaps_moments += f"""
        <a href="{file_link}" class="chapter-card">
          <div class="card-header">
            <h3>{title}</h3>
            <span class="chapter-number" style="background:#8b5cf620;color:#8b5cf6;">English</span>
          </div>
          <div class="card-footer">
            <span class="read-link">Read Chapter <i class="fas fa-arrow-right"></i></span>
          </div>
        </a>"""

    template += html_chaps_moments
    
    template += """
      </div>
    </div>
  </main>
  <script src="/search.js"></script>
</body>
</html>
"""
    with open(out_file, "w") as f:
        f.write(template)

generate_eng_dir(9, "/home/shubham_singh/Documents/NeoBranium/Notes/class9-english-dir.html")

# Generate the empty html files for those chapters
import os
for cls in [9]:
    for subj in ["BEE", "MOM"]:
        count = 12 if subj == "BEE" else 11
        for i in range(1, count):
            ch_num = f"{subj}{i}"
            file_link = f"{cls}-ENG-{ch_num}.html"
            path = f"/home/shubham_singh/Documents/NeoBranium/Notes/{file_link}"
            
            content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Class {cls} English - {subj} Chapter {i} | NeoBranium</title>
    <link rel="stylesheet" href="../index_css.css">
    <link rel="stylesheet" href="notes.css">
</head>
<body>
    <header>
        <div class="header-container">
            <div class="logo"><span>NeoBranium</span></div>
            <nav class="nav-menu">
                <a href="../index.html">Home</a>
                <a href="class{cls}-english-dir.html">Back to English</a>
            </nav>
        </div>
    </header>
    <main class="notes-page">
        <aside class="notes-sidebar">
            <div class="sidebar-content">
                <h3>📖 Chapter Contents</h3><ul><li><a href="#intro">Introduction</a></li></ul>
            </div>
        </aside>
        <div class="notes-container">
            <section id="intro">
                <h1>English - Chapter {i}</h1>
                <p>Content coming soon...</p>
                <div style="height: 60vh;"></div>
            </section>
        </div>
    </main>
</body>
</html>"""
            with open(path, "w") as f:
                f.write(content)
