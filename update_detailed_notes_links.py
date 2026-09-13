import re

with open('Notes/detailed-notes.html', 'r', encoding='utf-8') as f:
    content = f.read()

# I will just write a simple regex or string replace to link each card.
# The structure is:
# <div id="class9"...
#   <h3>Science</h3>
#   <a href="#" class="btn-coming">Coming Soon</a>
# 
# We'll just carefully replace them.

links_map = {
    'class9': {
        'Science': 'class9-science-dir.html',
        'Mathematics': 'class9-maths-dir.html'
    },
    'class10': {
        'Mathematics': 'class10-maths-dir.html'
    },
    'class11': {
        'Physics': 'class11-physics-dir.html',
        'Chemistry': 'class11-chemistry-dir.html',
        'Mathematics': 'class11-maths-dir.html'
    },
    'class12': {
        'Physics': 'class12-physics-dir.html',
        'Chemistry': 'class12-chemistry-dir.html',
        'Mathematics': 'class12-maths-dir.html'
    }
}

for class_id, subjects in links_map.items():
    for subject, href in subjects.items():
        # Find the block for this class and subject
        # A bit tricky to do with regex reliably without proper HTML parsing, 
        # but the structure is very consistent:
        # <h3>Subject</h3>
        # <span class="chapter-number">Class XX</span>
        # </div>
        # <div class="card-footer">
        #   <a href="#" class="btn-coming">Coming Soon</a>
        
        pattern = re.compile(f'(<h3>{subject}</h3>\\s*<span class="chapter-number">Class \d+</span>\\s*</div>\\s*<div class="card-footer">\\s*)<a href="#" class="btn-coming">Coming Soon</a>')
        replacement = f'\\1<a href="{href}" class="btn-read">View Chapters</a>'
        content = pattern.sub(replacement, content)

with open('Notes/detailed-notes.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated links in detailed-notes.html")
