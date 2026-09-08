import glob

# Files to process
files = glob.glob('/home/shubham_singh/Documents/NeoBranium/Notes/*.html')
files.append('/home/shubham_singh/Documents/NeoBranium/index.html')
# We need to replace the dropdown menu for Notes to include Class 11

old_nav = """<div class="dropdown-submenu" style="border-top: 1px solid var(--border-color); margin-top: 0.5rem; padding-top: 1rem;"><h5>Class 10</h5><ul><li><a href="notes-science-class10.html">Science</a></li><li><a href="notes-math-class10.html">Mathematics</a></li></ul></div>
          </div>"""

# Wait, in the existing files the nav menu might look slightly different.
# Let's search for "Class 10" in the dropdown and insert Class 11 after it.
