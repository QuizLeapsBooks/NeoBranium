#!/bin/bash

# Find files containing the Class 10 dropdown
files=$(grep -rl "<h5>Class 10</h5>" /home/shubham_singh/Documents/NeoBranium/Notes/*.html /home/shubham_singh/Documents/NeoBranium/index.html)

CLASS11_BLOCK='            <div class="dropdown-submenu" style="border-top: 1px solid var(--border-color); margin-top: 0.5rem; padding-top: 1rem;">\n              <h5>Class 11</h5>\n              <ul>\n                <li><a href="class11-notes.html">All Subjects →</a></li>\n                <li><a href="notes-physics-class11.html">Physics</a></li>\n                <li><a href="notes-chemistry-class11.html">Chemistry</a></li>\n                <li><a href="notes-mathematics-class11.html">Mathematics</a></li>\n                <li><a href="notes-biology-class11.html">Biology</a></li>\n              </ul>\n            </div>'

for f in $files; do
  # Check if it already has Class 11
  if ! grep -q "<h5>Class 11</h5>" "$f"; then
    echo "Updating $f"
    # We will use awk to insert the Class 11 block after the Class 10 ul block
    awk -v block="$CLASS11_BLOCK" '
      /<h5>Class 10<\/h5>/ { in_class10=1 }
      in_class10 && /<\/ul>/ {
        print $0
        print block
        in_class10=0
        next
      }
      { print $0 }
    ' "$f" > "${f}.tmp" && mv "${f}.tmp" "$f"
  fi
done

