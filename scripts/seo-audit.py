#!/usr/bin/env python3
"""
scripts/seo-audit.py - Comprehensive Technical SEO Audit for NeoBranium
Scans all HTML files, analyzes meta tags, canonicals, robots.txt, sitemap.xml, and internal links.
"""

import os
import re
import json
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CANONICAL_DOMAIN = "https://neobranium.web.app"

# Patterns or paths that are strictly private/non-indexable
PRIVATE_PATHS = {
    "htmls/sign.html",
    "htmls/dashboard.html",
    "htmls/profile.html",
    "htmls/setting.html",
    "htmls/verify-email.html",
    "htmls/chat/chat_app.html",
    "htmls/doubt/index.html",
    "htmls/bot/bot.html",
    "htmls/question-paper_generator-ai/ai-generate.html",
    "ai-board/ai-board.html",
    "architecture-map.html",
    "header.html",
    "zohoverify/verifyforzoho.html",
    "htmls/classs9-10mathematics.html",  # redirected to Notes/notes-math-class10.html
    "htmls/privacy_policy&terms_conditions.html", # deprecated duplicate
    "htmls/feedback.html",
    "htmls/notes.html",  # legacy dashboard notes view
    "404.html",
}

def load_robots_disallows():
    robots_file = os.path.join(BASE_DIR, 'robots.txt')
    disallows = []
    if os.path.exists(robots_file):
        with open(robots_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('Disallow:'):
                    rule = line.split(':', 1)[1].strip()
                    if rule:
                        disallows.append(rule)
    return disallows

def is_disallowed(path, disallows):
    # Ensure path starts with /
    url_path = '/' + path if not path.startswith('/') else path
    for rule in disallows:
        if rule.endswith('/'):
            if url_path.startswith(rule):
                return True
        elif url_path == rule or url_path.startswith(rule):
            return True
    return False

def load_sitemap_urls():
    sitemap_file = os.path.join(BASE_DIR, 'sitemap.xml')
    sitemap_urls = set()
    if os.path.exists(sitemap_file):
        try:
            tree = ET.parse(sitemap_file)
            for loc in tree.getroot().findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc'):
                if loc.text:
                    sitemap_urls.add(loc.text.strip())
        except Exception as e:
            print(f"Error parsing sitemap: {e}")
    return sitemap_urls

def get_html_files():
    html_files = []
    for root, dirs, files in os.walk(BASE_DIR):
        if any(ignored in root for ignored in ['node_modules', '.git', 'functions', '.firebase']):
            continue
        for f in files:
            if f.endswith('.html'):
                rel_path = os.path.relpath(os.path.join(root, f), BASE_DIR)
                rel_path = os.path.normpath(rel_path)
                html_files.append(rel_path)
    html_files.sort()
    return html_files

def extract_meta_tags(content):
    title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE | re.DOTALL)
    title = title_match.group(1).strip() if title_match else ""

    desc_match = re.search(r'<meta[^>]*name=[\"\']description[\"\'][^>]*content=[\"\'](.*?)[\"\']', content, re.IGNORECASE)
    if not desc_match:
        desc_match = re.search(r'<meta[^>]*content=[\"\'](.*?)[\"\'][^>]*name=[\"\']description[\"\']', content, re.IGNORECASE)
    desc = desc_match.group(1).strip() if desc_match else ""

    robots_match = re.search(r'<meta[^>]*name=[\"\']robots[\"\'][^>]*content=[\"\'](.*?)[\"\']', content, re.IGNORECASE)
    robots_meta = robots_match.group(1).strip() if robots_match else ""

    canon_match = re.search(r'<link[^>]*rel=[\"\']canonical[\"\'][^>]*href=[\"\']([^\"\']+)[\"\']', content, re.IGNORECASE)
    if not canon_match:
        canon_match = re.search(r'<link[^>]*href=[\"\']([^\"\']+)[\"\'][^>]*rel=[\"\']canonical[\"\']', content, re.IGNORECASE)
    canonical = canon_match.group(1).strip() if canon_match else ""

    og_title_match = re.search(r'<meta[^>]*property=[\"\']og:title[\"\'][^>]*content=[\"\'](.*?)[\"\']', content, re.IGNORECASE)
    og_title = og_title_match.group(1).strip() if og_title_match else ""

    og_desc_match = re.search(r'<meta[^>]*property=[\"\']og:description[\"\'][^>]*content=[\"\'](.*?)[\"\']', content, re.IGNORECASE)
    og_desc = og_desc_match.group(1).strip() if og_desc_match else ""

    og_image_match = re.search(r'<meta[^>]*property=[\"\']og:image[\"\'][^>]*content=[\"\'](.*?)[\"\']', content, re.IGNORECASE)
    og_image = og_image_match.group(1).strip() if og_image_match else ""

    return {
        "title": title,
        "description": desc,
        "robots_meta": robots_meta,
        "canonical": canonical,
        "og_title": og_title,
        "og_description": og_desc,
        "og_image": og_image
    }

def audit_file(rel_path, disallows, sitemap_urls):
    full_path = os.path.join(BASE_DIR, rel_path)
    with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    meta = extract_meta_tags(content)

    # Classification
    is_public = rel_path not in PRIVATE_PATHS
    is_indexable = is_public and not ('noindex' in meta['robots_meta'].lower())

    expected_url = f"{CANONICAL_DOMAIN}/" if rel_path == "index.html" else f"{CANONICAL_DOMAIN}/{rel_path}"

    # Canonical status
    canonical_issue = None
    if not meta['canonical']:
        canonical_issue = "MISSING"
    elif "neobranium.com" in meta['canonical']:
        canonical_issue = "WRONG_DOMAIN (neobranium.com)"
    elif "dashboard.html" in meta['canonical'] and "dashboard.html" not in rel_path:
        canonical_issue = "WRONG_TARGET (dashboard.html)"
    elif meta['canonical'] != expected_url:
        # Check if difference is trivial (e.g. trailing slash on index)
        if rel_path == "index.html" and meta['canonical'] == CANONICAL_DOMAIN:
            pass
        else:
            canonical_issue = f"MISMATCH ({meta['canonical']} != {expected_url})"

    # Robots status
    blocked_by_robots = is_disallowed(rel_path, disallows)

    # In sitemap?
    in_sitemap = expected_url in sitemap_urls or (rel_path == "index.html" and f"{CANONICAL_DOMAIN}/" in sitemap_urls)

    # Links inside file
    internal_links = re.findall(r'href=[\"\']([^\"\'#?]+)[\"\']', content)
    broken_links = []
    dir_name = os.path.dirname(full_path)
    for href in internal_links:
        if href.startswith(('http://', 'https://', '//', 'mailto:', 'javascript:', 'tel:')):
            continue
        if href.endswith(('.css', '.png', '.ico', '.jpg', '.svg', '.json', '.xml', '.pdf', '.js')):
            continue
        if href.startswith('/'):
            target_rel = href.lstrip('/')
        else:
            target_rel = os.path.normpath(os.path.join(os.path.relpath(dir_name, BASE_DIR), href))
        
        target_full = os.path.join(BASE_DIR, target_rel)
        if not os.path.exists(target_full):
            broken_links.append({"href": href, "target": target_rel})

    return {
        "file": rel_path,
        "is_public": is_public,
        "is_indexable": is_indexable,
        "canonical": meta['canonical'],
        "expected_canonical": expected_url,
        "canonical_issue": canonical_issue,
        "title": meta['title'],
        "has_title": bool(meta['title']),
        "has_description": bool(meta['description']),
        "robots_meta": meta['robots_meta'],
        "blocked_by_robots": blocked_by_robots,
        "in_sitemap": in_sitemap,
        "broken_links": broken_links,
        "og_title": bool(meta['og_title']),
        "og_desc": bool(meta['og_description']),
        "og_image": bool(meta['og_image'])
    }

def main():
    disallows = load_robots_disallows()
    sitemap_urls = load_sitemap_urls()
    files = get_html_files()

    results = []
    for f in files:
        results.append(audit_file(f, disallows, sitemap_urls))

    # Summary
    total_files = len(results)
    public_files = [r for r in results if r['is_public']]
    private_files = [r for r in results if not r['is_public']]
    wrong_canonicals = [r for r in results if r['canonical_issue'] and r['canonical_issue'] != "MISSING"]
    missing_canonicals_public = [r for r in public_files if r['canonical_issue'] == "MISSING"]
    all_broken_links = []
    for r in results:
        for b in r['broken_links']:
            all_broken_links.append((r['file'], b['href'], b['target']))

    public_not_in_sitemap = [r for r in public_files if not r['in_sitemap']]
    private_in_sitemap = [r for r in private_files if r['in_sitemap']]

    print("=" * 70)
    print("NEOBRANIUM TECHNICAL SEO AUDIT SUMMARY")
    print("=" * 70)
    print(f"Total HTML files:                 {total_files}")
    print(f"Public / Indexable pages:         {len(public_files)}")
    print(f"Private / Excluded pages:         {len(private_files)}")
    print(f"Wrong canonical tags (public):    {len(wrong_canonicals)}")
    print(f"Missing canonical tags (public):  {len(missing_canonicals_public)}")
    print(f"Public pages NOT in sitemap:      {len(public_not_in_sitemap)}")
    print(f"Private pages in sitemap:         {len(private_in_sitemap)}")
    print(f"Total broken internal links:      {len(all_broken_links)}")
    print("=" * 70)

    # Save detailed JSON report
    report_path = os.path.join(BASE_DIR, 'scripts', 'seo-audit-report.json')
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump({
            "summary": {
                "total_files": total_files,
                "public_files": len(public_files),
                "private_files": len(private_files),
                "wrong_canonicals": len(wrong_canonicals),
                "missing_canonicals_public": len(missing_canonicals_public),
                "public_not_in_sitemap": len(public_not_in_sitemap),
                "total_broken_links": len(all_broken_links)
            },
            "broken_links": all_broken_links,
            "wrong_canonicals": [{"file": r['file'], "current": r['canonical'], "expected": r['expected_canonical'], "issue": r['canonical_issue']} for r in wrong_canonicals],
            "missing_canonicals_public": [r['file'] for r in missing_canonicals_public],
            "private_files": [r['file'] for r in private_files],
            "results": results
        }, f, indent=2)
    print(f"Audit report saved to: {report_path}")

if __name__ == '__main__':
    main()
