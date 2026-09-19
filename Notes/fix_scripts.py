import os

files = [
    "/home/shubham_singh/Documents/NeoBranium/Notes/class9-social-science-dir.html",
    "/home/shubham_singh/Documents/NeoBranium/Notes/class10-social-science-dir.html",
    "/home/shubham_singh/Documents/NeoBranium/Notes/class9-english-dir.html"
]

script_to_add = """
  <script>
    window.addEventListener('load', () => {
      const preloader = document.getElementById('preloader');
      setTimeout(() => {
        if (preloader) { preloader.style.opacity = '0'; setTimeout(() => preloader.style.display = 'none', 500); }
      }, 800);
    });
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    if (menuToggle) menuToggle.addEventListener('click', () => { navMenu.classList.toggle('active'); menuToggle.setAttribute('aria-expanded', navMenu.classList.contains('active')); });
  </script>
"""

for fpath in files:
    if os.path.exists(fpath):
        with open(fpath, "r") as f:
            content = f.read()
        
        # Check if script is already there (it shouldn't be based on my template)
        if "window.addEventListener('load'" not in content:
            # Replace </body> with the script + </body>
            new_content = content.replace("</body>", script_to_add + "</body>")
            with open(fpath, "w") as f:
                f.write(new_content)
            print(f"Fixed {fpath}")
        else:
            print(f"Already fixed {fpath}")
