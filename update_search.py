import re

filepath = "/home/shubham_singh/Documents/NeoBranium/search.js"
with open(filepath, 'r') as f:
    content = f.read()

# Add Class 11 category to SEARCH_INDEX if not already there
if "Class 11 Notes" not in content:
    # Find the end of SEARCH_INDEX array
    # Since SEARCH_INDEX is a const array, we look for its closing bracket
    
    new_entries = """  // --- Class 11 Notes ---
  { title: "Physics Notes Class 11", url: "/Notes/notes-physics-class11.html", category: "Class 11 Notes", excerpt: "Complete physics notes for class 11 covering mechanics, thermodynamics, and waves." },
  { title: "Chemistry Notes Class 11", url: "/Notes/notes-chemistry-class11.html", category: "Class 11 Notes", excerpt: "Complete chemistry notes for class 11 covering physical, organic, and inorganic." },
  { title: "Mathematics Notes Class 11", url: "/Notes/notes-mathematics-class11.html", category: "Class 11 Notes", excerpt: "Complete mathematics notes for class 11." },
  { title: "Biology Notes Class 11", url: "/Notes/notes-biology-class11.html", category: "Class 11 Notes", excerpt: "Complete biology notes for class 11." },
  { title: "Accountancy Notes Class 11", url: "/Notes/notes-accountancy-class11.html", category: "Class 11 Notes", excerpt: "Complete accountancy notes for class 11 commerce." },
  { title: "Business Studies Notes Class 11", url: "/Notes/notes-business-studies-class11.html", category: "Class 11 Notes", excerpt: "Complete business studies notes for class 11 commerce." },
  { title: "Economics Notes Class 11", url: "/Notes/notes-economics-class11.html", category: "Class 11 Notes", excerpt: "Complete economics notes for class 11." },
  { title: "History Notes Class 11", url: "/Notes/notes-history-class11.html", category: "Class 11 Notes", excerpt: "Complete history notes for class 11 humanities." },
  { title: "Political Science Notes Class 11", url: "/Notes/notes-political-science-class11.html", category: "Class 11 Notes", excerpt: "Complete political science notes for class 11 humanities." },
  { title: "Geography Notes Class 11", url: "/Notes/notes-geography-class11.html", category: "Class 11 Notes", excerpt: "Complete geography notes for class 11 humanities." },
  { title: "Sociology Notes Class 11", url: "/Notes/notes-sociology-class11.html", category: "Class 11 Notes", excerpt: "Complete sociology notes for class 11 humanities." },
  { title: "Class 11 Notes Directory", url: "/Notes/class11-notes.html", category: "Class 11 Notes", excerpt: "Directory of all notes for Class 11 Science, Commerce, and Humanities." }
];"""
    
    content = content.replace("];", new_entries, 1)
    
    # Update category colors mapping
    category_colors = """  'Class 11 Notes': { bg: '#e0e7ff', text: '#4338ca', icon: 'fa-book-open' },
  'Class 10 Notes':"""
    content = content.replace("'Class 10 Notes':", category_colors)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print("Updated search.js")
else:
    print("search.js already updated")
