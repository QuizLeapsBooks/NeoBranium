import re

filepath = "/home/shubham_singh/Documents/NeoBranium/index.html"
with open(filepath, 'r') as f:
    content = f.read()

# Update hero buttons
hero_btn = '<a href="Notes/notes-science-class10.html" class="btn btn-secondary">Class 10 Notes</a>'
class11_btn = '<a href="Notes/class11-notes.html" class="btn btn-secondary" style="border-color:#3b82f6;color:#2563eb;">Class 11 Notes</a>'
if 'Class 11 Notes</a>' not in content:
    content = content.replace(hero_btn, f'{class11_btn}\n              {hero_btn}')

# Update footer links
footer_link = '<li><a href="Notes/notes-science-class10.html">Class 10 Notes</a></li>'
if '<li><a href="Notes/class11-notes.html">Class 11 Notes</a></li>' not in content:
    content = content.replace(footer_link, f'<li><a href="Notes/class11-notes.html">Class 11 Notes</a></li>\n            {footer_link}')

# Update Schema
schema = """      {
        "@type": "ListItem",
        "position": 2,
        "name": "Class 10 Notes",
        "item": "https://neobranium.web.app/Notes/notes-science-class10.html"
      },"""
schema_new = """      {
        "@type": "ListItem",
        "position": 2,
        "name": "Class 11 Notes",
        "item": "https://neobranium.web.app/Notes/class11-notes.html"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Class 10 Notes",
        "item": "https://neobranium.web.app/Notes/notes-science-class10.html"
      },"""

if '"name": "Class 11 Notes"' not in content:
    content = content.replace(schema, schema_new)
    # adjust positions
    content = content.replace('"position": 3,', '"position": 4,', 1)
    content = content.replace('"position": 4,', '"position": 5,', 1)

with open(filepath, 'w') as f:
    f.write(content)
print("Updated index.html")
