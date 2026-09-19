import os
import re

chapters = [
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

template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Class 9 Mathematics Chapter {num}: {title} | Detailed NCERT Notes | NeoBranium</title>
    <meta name="description" content="Class 9 Mathematics Chapter {num} - {title}. Detailed NCERT notes.">
    <meta name="author" content="NeoBranium">
    <meta name="robots" content="index, follow">

    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
    <link rel="stylesheet" href="../index_css.css">
    <link rel="stylesheet" href="notes.css">
</head>
<body>
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
                    <a href="class9-maths-dir.html" class="active">Notes <i class="fas fa-chevron-down" style="font-size: 0.7rem;"></i></a>
                    <div class="dropdown-menu">
                        <div class="dropdown-submenu">
                            <h5>Class 9</h5>
                            <ul>
                                <li><a href="class9-science-dir.html">Science</a></li>
                                <li><a href="class9-maths-dir.html">Mathematics</a></li>
                                <li><a href="class9-social-science-dir.html">Social Science</a></li>
                            </ul>
                        </div>
                        <div class="dropdown-submenu" style="border-top: 1px solid var(--border-color); margin-top: 0.5rem; padding-top: 1rem;">
                            <h5>Class 10</h5>
                            <ul>
                                <li><a href="class-wise-notes.html">Science</a></li>
                                <li><a href="class10-maths-dir.html">Mathematics</a></li>
                                <li><a href="class10-social-science-dir.html">Social Science</a></li>
                            </ul>
                        </div>
                        <div class="dropdown-submenu" style="border-top: 1px solid var(--border-color); margin-top: 0.5rem; padding-top: 1rem;">
                            <h5>Class 11</h5>
                            <ul>
                                <li><a href="class11-physics-dir.html">Physics</a></li>
                                <li><a href="class11-chemistry-dir.html">Chemistry</a></li>
                                <li><a href="class11-maths-dir.html">Mathematics</a></li>
                            </ul>
                        </div>
                        <div class="dropdown-submenu" style="border-top: 1px solid var(--border-color); margin-top: 0.5rem; padding-top: 1rem;">
                            <h5>Class 12</h5>
                            <ul>
                                <li><a href="class12-physics-dir.html">Physics</a></li>
                                <li><a href="class12-chemistry-dir.html">Chemistry</a></li>
                                <li><a href="class12-maths-dir.html">Mathematics</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
                <a href="../IQ/top-question.html">Top Questions</a>
                <a href="../blog/blog.html">Blog</a>
                <a href="../htmls/sign.html" class="login-btn">Login / Sign Up</a>
            </nav>
        </div>
    </header>

    <main class="notes-page">
        <aside class="notes-sidebar">
            <div class="sidebar-content">
                <h3>📖 Chapter Contents</h3>
                <ul>
                    <li><a href="#intro">Introduction</a></li>
                    <!-- Add more topics here later -->
                </ul>
            </div>
        </aside>

        <div class="notes-container">
            <nav class="breadcrumb">
                <a href="../index.html">Home</a> / <a href="class9-maths-dir.html">Notes</a> / <a href="class9-maths-dir.html">Class 9 Mathematics</a> / Chapter {num}: {title}
            </nav>

            <section id="intro">
                <h1>Chapter {num}: {title}</h1>
                <p class="chapter-summary">Detailed notes coming soon...</p>
                <div style="height: 60vh;"></div> <!-- Space for chapter content -->
            </section>
        </div>
    </main>

    <footer class="footer-container" style="margin-top: 2rem; border-top: 1px solid #e2e8f0; padding-top: 2rem;">
      <div class="footer-brand">
        <div class="logo"><img src="/online-graduation_16847316.png" alt="NeoBranium Logo"><span>NeoBranium</span></div>
        <p>A next-gen learning platform for students of all classes.</p>
      </div>
      <div class="footer-links">
        <h4>Quick Links</h4>
        <ul>
          <li><a href="../index.html">Home</a></li>
          <li><a href="class9-maths-dir.html">Notes</a></li>
          <li><a href="../blog/blog.html">Blog</a></li>
        </ul>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2026 NeoBranium. All rights reserved.</p>
      </div>
    </footer>

    <script>
        window.addEventListener('load', () => {{
            const preloader = document.getElementById('preloader');
            setTimeout(() => {{ if (preloader) {{ preloader.style.opacity = '0'; setTimeout(() => preloader.style.display = 'none', 500); }} }}, 800);
        }});
        const menuToggle = document.querySelector('.menu-toggle');
        const navMenu = document.querySelector('.nav-menu');
        if (menuToggle) menuToggle.addEventListener('click', () => {{ navMenu.classList.toggle('active'); menuToggle.setAttribute('aria-expanded', navMenu.classList.contains('active')); }});
    </script>
    <script src="/search.js"></script>
</body>
</html>
"""

for i, title in enumerate(chapters, 1):
    file_path = f"/home/shubham_singh/Documents/NeoBranium/Notes/9-MATH-CH{i}.html"
    with open(file_path, "w") as f:
        f.write(template.format(num=i, title=title))

# Also update class9-maths-dir.html
with open("/home/shubham_singh/Documents/NeoBranium/Notes/class9-maths-dir.html", "r") as f:
    content = f.read()

pattern = re.compile(
    r'<div class="chapter-card coming-soon-card">\s*<div class="card-header">\s*<h3>Ch (\d+): (.*?)</h3>\s*<span class="chapter-number" style="background:#8b5cf620;color:#8b5cf6;">Mathematics</span>\s*</div>\s*<div class="card-footer">\s*<span class="cs-badge"><i class="fas fa-clock"></i> Coming Soon</span>\s*</div>\s*</div>',
    re.DOTALL
)

def repl(match):
    ch_num = match.group(1)
    title = match.group(2)
    return f"""<a href="9-MATH-CH{ch_num}.html" class="chapter-card">
          <div class="card-header">
            <h3>Ch {ch_num}: {title}</h3>
            <span class="chapter-number" style="background:#8b5cf620;color:#8b5cf6;">Mathematics</span>
          </div>
          <div class="card-footer">
            <span class="read-link">Read Chapter <i class="fas fa-arrow-right"></i></span>
          </div>
        </a>"""

new_content = pattern.sub(repl, content)

with open("/home/shubham_singh/Documents/NeoBranium/Notes/class9-maths-dir.html", "w") as f:
    f.write(new_content)

print("Class 9 Maths generated and updated successfully!")
