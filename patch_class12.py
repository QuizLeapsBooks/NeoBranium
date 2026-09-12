import re

with open('Notes/class11-notes.html', 'r') as f:
    content = f.read()

# Replace class 11 with class 12
content = content.replace('Class 11', 'Class 12')
content = content.replace('class11', 'class12')
content = content.replace('class-11', 'class-12')

# Some specific replacements if necessary
# Like "class 11 notes" -> "class 12 notes"

with open('Notes/class12-notes.html', 'w') as f:
    f.write(content)

