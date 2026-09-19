import re

with open("/home/shubham_singh/Documents/NeoBranium/Notes/class10-maths-dir.html", "r") as f:
    content = f.read()

# Replace <div class="chapter-card coming-soon-card"> with <a href="10-MATH-CHX.html" class="chapter-card">
# and </div> that closes the card with </a>
# We can do this by finding all chapter cards.

pattern = re.compile(
    r'<div class="chapter-card coming-soon-card">\s*<div class="card-header">\s*<h3>Ch (\d+): (.*?)</h3>\s*<span class="chapter-number" style="background:#8b5cf620;color:#8b5cf6;">Mathematics</span>\s*</div>\s*<div class="card-footer">\s*<span class="cs-badge"><i class="fas fa-clock"></i> Coming Soon</span>\s*</div>\s*</div>',
    re.DOTALL
)

def repl(match):
    ch_num = match.group(1)
    title = match.group(2)
    return f"""<a href="10-MATH-CH{ch_num}.html" class="chapter-card">
          <div class="card-header">
            <h3>Ch {ch_num}: {title}</h3>
            <span class="chapter-number" style="background:#8b5cf620;color:#8b5cf6;">Mathematics</span>
          </div>
          <div class="card-footer">
            <span class="read-link">Read Chapter <i class="fas fa-arrow-right"></i></span>
          </div>
        </a>"""

new_content = pattern.sub(repl, content)

with open("/home/shubham_singh/Documents/NeoBranium/Notes/class10-maths-dir.html", "w") as f:
    f.write(new_content)

print("Updated class10-maths-dir.html")
