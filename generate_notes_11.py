import re
import glob
import os

subjects = {
    'history': {
        'desc': 'Themes in World History. Focuses on Early Societies, Empires, and Modernisation.',
        'formula': 'Important events, timelines, and key historical figures.'
    },
    'political-science': {
        'desc': 'Indian Constitution at Work and Political Theory.',
        'formula': 'Constitutional articles, political theories, and governance structures.'
    },
    'geography': {
        'desc': 'Fundamentals of Physical Geography and India Physical Environment.',
        'formula': 'Geographical phenomena, maps, and environmental concepts.'
    },
    'sociology': {
        'desc': 'Introducing Sociology and Understanding Society.',
        'formula': 'Sociological terms, thinkers, and social institutions.'
    }
}

for file_path in glob.glob('Notes/notes-*-class11.html'):
    filename = os.path.basename(file_path)
    subject_match = re.search(r'notes-(.*?)-class11\.html', filename)
    if not subject_match: continue
    subject = subject_match.group(1)
    
    if subject not in subjects:
        continue
        
    info = subjects[subject]
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    def replacement(match):
        chapter_title = match.group(2)
        return f"""{match.group(1)}
        <p class="chapter-summary">A comprehensive guide to {chapter_title.lower()}. {info['desc']}</p>

        <h3><i class="fas fa-bullseye"></i> Learning Objectives</h3>
        <ul>
          <li>Understand the fundamental principles of {chapter_title.lower()}.</li>
          <li>Apply key concepts to understand broader subject themes.</li>
          <li>Analyze and interpret relevant case studies and data.</li>
        </ul>

        <h3><i class="fas fa-lightbulb"></i> Key Concepts</h3>
        <ul>
          <li><strong>Core Idea:</strong> The most important foundational theme in {chapter_title.lower()}.</li>
          <li><strong>Context and Impact:</strong> How these concepts apply in real-world scenarios or historical contexts.</li>
          <li><strong>Important Terms:</strong> Definitions and terminology essential for the board exams.</li>
        </ul>

        <div class="derivation-box">
          <h3><i class="fas fa-calculator"></i> Highlight / Fact</h3>
          <p>{info['formula']}</p>
          <p>Make sure to practice previous year questions from this section.</p>
        </div>"""

    # Match <section id="chX" class="chapter-section"> <h2>Chapter X: Title</h2> <div class="coming-soon-section"> ... </div>
    new_content = re.sub(r'(<section id="ch\d+" class="chapter-section">\s*<h2>(Chapter \d+:[^<]+)</h2>\s*)<div class="coming-soon-section">.*?</div>', replacement, content, flags=re.DOTALL)
    
    with open(file_path, 'w') as f:
        f.write(new_content)
        
