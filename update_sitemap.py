import re

filepath = "/home/shubham_singh/Documents/NeoBranium/sitemap.xml"
with open(filepath, 'r') as f:
    content = f.read()

if "class11-notes.html" not in content:
    new_urls = """  <url>
    <loc>https://neobranium.web.app/Notes/class11-notes.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://neobranium.web.app/Notes/notes-physics-class11.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://neobranium.web.app/Notes/notes-chemistry-class11.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://neobranium.web.app/Notes/notes-mathematics-class11.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://neobranium.web.app/Notes/notes-biology-class11.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://neobranium.web.app/Notes/notes-accountancy-class11.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://neobranium.web.app/Notes/notes-business-studies-class11.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://neobranium.web.app/Notes/notes-economics-class11.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://neobranium.web.app/Notes/notes-history-class11.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://neobranium.web.app/Notes/notes-political-science-class11.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://neobranium.web.app/Notes/notes-geography-class11.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://neobranium.web.app/Notes/notes-sociology-class11.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>"""

    content = content.replace("</urlset>", new_urls)
    with open(filepath, 'w') as f:
        f.write(content)
    print("Updated sitemap.xml")
else:
    print("sitemap.xml already updated")
