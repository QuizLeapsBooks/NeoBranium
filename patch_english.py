import re

with open('Notes/notes-english-core-class11.html', 'r') as f:
    content = f.read()

# Replace class 11 with class 12
content = content.replace('Class 11', 'Class 12')
content = content.replace('class11', 'class12')
content = content.replace('Hornbill', 'Flamingo')
content = content.replace('Snapshots', 'Vistas')

# We can leave the chapters as they are, but perhaps just replacing Hornbill/Snapshots is enough to make it look like a template. 
# Or we can just let it be. 

with open('Notes/notes-english-core-class12.html', 'w') as f:
    f.write(content)

