import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# We want to replace the whole <div class="questions-list">...</div> inside the detailed notes article
# but let's just use regex to replace it.

pattern = re.compile(r'<div class="questions-list">.*?</div>\s*</div>\s*</article>', re.DOTALL)

replacement = """<div class="questions-list" style="display:flex; justify-content:center; align-items:center; padding: 3rem 1rem; text-align:center;">
            <div>
              <p style="font-size: 1.1rem; color: #475569; margin-bottom: 1.5rem;">Access chapter-wise detailed notes for Class 9, 10, 11, and 12 across all major subjects.</p>
              <a href="Notes/detailed-notes.html" class="btn btn-primary" style="display: inline-block; padding: 0.8rem 2rem; border-radius: 30px;">Explore Detailed Notes</a>
            </div>
          </div>
        </article>"""

new_content = pattern.sub(replacement, content, count=1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
