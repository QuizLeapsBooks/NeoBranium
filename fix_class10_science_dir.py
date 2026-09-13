# The actual file → content mapping is:
# 10-CH1.html = Chemical Reactions & Equations ✓
# 10-CH2.html = Acids, Bases and Salts ✓
# 10-CH3.html = Metals and Non-metals ✓
# 10-CH4.html = Magnetic Effects of Electric Current (WRONG filename but that's what's in it)
# 10-PH1.html = Light – Reflection and Refraction ✓
# 10-PH2.html = The Human Eye and the Colourful World ✓
# 10-PH3.html = Electricity ✓
# 10-PH4.html = Electricity (DUPLICATE - skip)
# 10-PH5.html = Formula/quick page (skip as notes)
# 10-BI1.html = Life Processes ✓
# 10-BI2.html = Control and Coordination ✓
# 10-BI3.html = How do Organisms Reproduce? ✓
# 10-BI4.html = Heredity ✓
# 10-BI5.html = Our Environment ✓

# Correct chapter → file mapping based on ACTUAL content:
chapters = [
    (1,  'Chemical Reactions & Equations',          '/Notes/10-CH1.html'),
    (2,  'Acids, Bases and Salts',                  '/Notes/10-CH2.html'),
    (3,  'Metals and Non-metals',                   '/Notes/10-CH3.html'),
    (4,  'Carbon and its Compounds',                '#'),            # file doesn't exist yet
    (5,  'Life Processes',                          '/Notes/10-BI1.html'),
    (6,  'Control and Coordination',                '/Notes/10-BI2.html'),
    (7,  'How do Organisms Reproduce?',             '/Notes/10-BI3.html'),
    (8,  'Heredity',                                '/Notes/10-BI4.html'),
    (9,  'Our Environment',                         '/Notes/10-BI5.html'),
    (10, 'Light — Reflection and Refraction',       '/Notes/10-PH1.html'),
    (11, 'The Human Eye and the Colourful World',   '/Notes/10-PH2.html'),
    (12, 'Electricity',                             '/Notes/10-PH3.html'),
    (13, 'Magnetic Effects of Electric Current',    '/Notes/10-CH4.html'),  # content is in 10-CH4 despite name
]

color = '#10b981'
subject = 'Science'
icon = 'fas fa-flask'
title = 'Class 10 Science — Chapter Notes'

cards_html = ''
for (num, name, url) in chapters:
    if url == '#':
        btn = '<span class="cs-badge"><i class="fas fa-clock"></i> Coming Soon</span>'
        card_cls = 'chapter-card coming-soon-card'
    else:
        btn = f'<a href="{url}" class="read-link"><i class="fas fa-eye"></i> Read Full Notes <i class="fas fa-arrow-right"></i></a>'
        card_cls = 'chapter-card'
    cards_html += f'''        <div class="{card_cls}">
          <div class="card-header">
            <h3>Ch {num}: {name}</h3>
            <span class="chapter-number" style="background:{color}20;color:{color};">{subject}</span>
          </div>
          <div class="card-footer">
            {btn}
          </div>
        </div>\n'''

# Read the existing file and replace only the chapters-grid section
with open('Notes/class10-science-dir.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re
# Replace everything inside <div class="chapters-grid">...</div>
new_content = re.sub(
    r'(<div class="chapters-grid">).*?(</div>\s*</div>\s*</main>)',
    f'\\1\n{cards_html}      </div>\n    </div>\n  </main>',
    content,
    flags=re.DOTALL
)

with open('Notes/class10-science-dir.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Fixed class10-science-dir.html with correct file mappings")
