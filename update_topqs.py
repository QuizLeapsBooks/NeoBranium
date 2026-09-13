import os
import glob
import re

for filepath in glob.glob('**/*.html', recursive=True):
    if 'node_modules' in filepath: continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "No Sign-In Required!" in content:
        # We want to replace "Top Questions" with "TopQs" in the navigation option.
        # It's usually like: <a href="...top-question.html...">Top Questions</a>
        # We can just replace >Top Questions</a> with >TopQs</a>
        new_content = content.replace('>Top Questions</a>', '>TopQs</a>')
        new_content = new_content.replace('>Top Question</a>', '>TopQs</a>')
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filepath}")
