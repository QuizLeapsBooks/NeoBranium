import re

file_path = '/home/shubham_singh/Documents/NeoBranium/Notes/class9-science-dir.html'
with open(file_path, 'r') as f:
    content = f.read()

chapters = [
    ("Matter in Our Surroundings", "9-CH1.html"),
    ("Is Matter Around Us Pure", "9-CH2.html"),
    ("Atoms and Molecules", "9-CH3.html"),
    ("Structure of the Atom", "9-CH4.html"),
    ("The Fundamental Unit of Life", "9-BI1.html"),
    ("Tissues", "9-BI2.html"),
    ("Diversity in Living Organisms", "9-BI3.html"),
    ("Motion", "9-PH1.html"),
    ("Force and Laws of Motion", "9-PH2.html"),
    ("Gravitation", "9-PH3.html"),
    ("Work and Energy", "9-PH4.html"),
    ("Sound", "9-PH5.html"),
]

for title, link in chapters:
    # Pattern to match the coming-soon card for this specific chapter
    pattern = r'<div class="chapter-card coming-soon-card">\s*<div class="card-header">\s*<h3>Ch \d+: ' + re.escape(title) + r'</h3>\s*<span class="chapter-number" style="background:#10b98120;color:#10b981;">Science</span>\s*</div>\s*<div class="card-footer">\s*<span class="cs-badge"><i class="fas fa-clock"></i> Coming Soon</span>\s*</div>\s*</div>'
    
    # Replacement string
    ch_num_match = re.search(r'<h3>(Ch \d+: ' + re.escape(title) + r')</h3>', content)
    if ch_num_match:
        ch_title = ch_num_match.group(1)
        replacement = f'''<a href="{link}" class="chapter-card">
          <div class="card-header">
            <h3>{ch_title}</h3>
            <span class="chapter-number" style="background:#10b98120;color:#10b981;">Science</span>
          </div>
          <div class="card-footer">
            <span class="read-link">Read Notes <i class="fas fa-arrow-right"></i></span>
          </div>
        </a>'''
        content = re.sub(pattern, replacement, content)

with open(file_path, 'w') as f:
    f.write(content)

print("Updated class9-science-dir.html")
