import re

with open('Notes/detailed-notes.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Read the correct header
with open('header.html', 'r', encoding='utf-8') as f:
    header_content = f.read()
    
# Extract the parts to insert
# We want from <div class="free-access-banner"> to </header>
match = re.search(r'<div class="free-access-banner">.*?</header>', header_content, re.DOTALL)
if match:
    correct_header = match.group(0)

    # Note that in correct_header we should change the active link from "Notes" to "Detailed Notes" or just leave it.
    
    # Let's replace the old header in detailed-notes.html
    old_header_pattern = re.compile(r'<header class="header">.*?</header>', re.DOTALL)
    
    new_content = old_header_pattern.sub(correct_header, content)
    
    # Also add the preloader script before closing body
    script_str = """
  <script>
    function openTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      event.target.classList.add('active');
    }
    
    window.addEventListener('load', () => {
      const preloader = document.getElementById('preloader');
      setTimeout(() => {
        if (preloader) {
          preloader.style.opacity = '0';
          setTimeout(() => preloader.style.display = 'none', 500);
        }
      }, 800);
    });
  </script>
</body>"""
    new_content = new_content.replace("""  <script>
    function openTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      event.target.classList.add('active');
    }
  </script>
</body>""", script_str)
    
    with open('Notes/detailed-notes.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Updated detailed-notes.html")
else:
    print("Could not find correct header part")
