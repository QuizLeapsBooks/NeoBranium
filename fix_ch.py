import re

files_to_fix = [
    "/home/shubham_singh/Documents/NeoBranium/Notes/10-BI1.html",
    "/home/shubham_singh/Documents/NeoBranium/Notes/10-PH5.html"
]

replacements = {
    'href="#ch1"': 'href="/Notes/10-CH1.html"',
    'href="#ch2"': 'href="/Notes/10-CH2.html"',
    'href="#ch3"': 'href="/Notes/10-CH3.html"',
    'href="#ch4"': 'href="/Notes/10-CH4.html"',
    
    'href="#bio-ch1"': 'href="/Notes/10-BI1.html"',
    'href="#bio-ch2"': 'href="/Notes/10-BI2.html"',
    'href="#bio-ch3"': 'href="/Notes/10-BI3.html"',
    'href="#bio-ch4"': 'href="/Notes/10-BI4.html"',
    'href="#bio-ch5"': 'href="/Notes/10-BI5.html"',

    'href="#phy-ch1"': 'href="/Notes/10-PH1.html"',
    'href="#phy-ch2"': 'href="/Notes/10-PH2.html"',
    'href="#phy-ch3"': 'href="/Notes/10-PH3.html"',
    'href="#phy-ch4"': 'href="/Notes/10-PH4.html"',
    'href="#formulas"': 'href="/Notes/10-formulas.html"' # wait, does formulas exist?
}

for file in files_to_fix:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements.items():
        if 'formulas' in old:
            # Let's check what 10-PH1.html uses for formulas
            pass
        else:
            content = content.replace(old, new)
            
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Fixed BI1 and PH5")
