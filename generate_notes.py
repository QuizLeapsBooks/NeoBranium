import re
import glob
import os

subjects = {
    'physics': {
        'desc': 'Detailed study of physical phenomena, laws, and derivations.',
        'formula': 'Formulas and derivations are essential for problem-solving.'
    },
    'chemistry': {
        'desc': 'Study of chemical reactions, equations, and molecular structures.',
        'formula': 'Chemical equations and mechanisms are heavily emphasized.'
    },
    'mathematics': {
        'desc': 'Focus on theorems, proofs, and calculus applications.',
        'formula': 'Extensive practice of formulas and problem-solving techniques.'
    },
    'biology': {
        'desc': 'Detailed study of life processes, genetics, and human anatomy.',
        'formula': 'Diagrams and detailed processes are crucial.'
    },
    'accountancy': {
        'desc': 'Study of financial accounting, partnership, and company accounts.',
        'formula': 'Formats of accounts and journal entries.'
    },
    'business-studies': {
        'desc': 'Principles of management, marketing, and business finance.',
        'formula': 'Case studies and management principles.'
    },
    'economics': {
        'desc': 'Macroeconomics and Indian Economic Development.',
        'formula': 'Graphs, statistical data, and economic models.'
    },
    'history': {
        'desc': 'Themes in Indian History - Ancient, Medieval, and Modern.',
        'formula': 'Dates, events, and historical figures.'
    },
    'political-science': {
        'desc': 'Contemporary World Politics and Politics in India since Independence.',
        'formula': 'Constitutional articles and political events.'
    },
    'geography': {
        'desc': 'Human Geography and India: People and Economy.',
        'formula': 'Maps and geographical data.'
    },
    'sociology': {
        'desc': 'Indian Society and Social Change and Development in India.',
        'formula': 'Sociological theories and concepts.'
    }
}

for file_path in glob.glob('Notes/notes-*-class12.html'):
    filename = os.path.basename(file_path)
    subject_match = re.search(r'notes-(.*?)-class12\.html', filename)
    if not subject_match: continue
    subject = subject_match.group(1)
    
    if subject not in subjects:
        info = {'desc': 'Detailed chapter notes.', 'formula': 'Key concepts and summaries.'}
    else:
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
          <li>Apply key concepts to solve complex problems.</li>
          <li>Analyze and interpret data related to this topic.</li>
        </ul>

        <h3><i class="fas fa-lightbulb"></i> Key Concepts</h3>
        <ul>
          <li><strong>Core Principle:</strong> The most important foundational idea in {chapter_title.lower()}.</li>
          <li><strong>Applications:</strong> Real-world applications and theoretical implications.</li>
          <li><strong>Important Terms:</strong> Definitions and terminology essential for the board exams.</li>
        </ul>

        <div class="derivation-box">
          <h3><i class="fas fa-calculator"></i> Highlight / Formula</h3>
          <p>{info['formula']}</p>
          <p>Make sure to practice previous year questions from this section.</p>
        </div>"""

    # We match <section id="chX" class="chapter-section"> <h2>Chapter X: Title</h2> <div class="coming-soon-section"> ... </div>
    new_content = re.sub(r'(<section id="ch\d+" class="chapter-section">\s*<h2>(Chapter \d+:[^<]+)</h2>\s*)<div class="coming-soon-section">.*?</div>', replacement, content, flags=re.DOTALL)
    
    with open(file_path, 'w') as f:
        f.write(new_content)
        
