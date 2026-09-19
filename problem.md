# Google Indexing Diagnosis & Audit Report
**Domain:** `https://neobranium.web.app`  
**Status:** 0 Pages Indexed (`site:neobranium.web.app` returns 0 results on Google)  
**Date:** September 2026

---

## Executive Summary

A comprehensive scan of the NeoBranium repository reveals multiple critical technical SEO blockers preventing Googlebot from indexing the website. The primary causes include **conflicting canonical tags pointing to a non-existent external domain (`neobranium.com`)**, **SPA wildcard rewrites in Firebase Hosting returning HTTP 200 for broken pages (causing Soft 404 penalties)**, **111 pages completely missing canonical tags**, and a **severely outdated `sitemap.xml` missing over 65% of the website's content**.

Additionally, because `neobranium.web.app` operates on a shared free Firebase subdomain with zero inbound external backlinks, Googlebot will not discover or index pages without explicit Search Console verification and sitemap submission.

---

## 1. Primary Root Causes Identified

### Issue 1: Conflicting Canonical Tags Pointing to `neobranium.com`
- **Location:** 34 HTML files (quizzes and dashboard pages)
- **What is happening:** These files explicitly tell search engines:
  ```html
  <link rel="canonical" href="https://neobranium.com/htmls/quiz_htmls/class9-chemistry_chapter3.html">
  ```
- **Impact:** The canonical tag instructs Google: *"Do not index this `neobranium.web.app` page; index the version at `neobranium.com` instead."* Since `neobranium.com` is inactive, Google drops both versions entirely.
- **Critical Conflict:** Several quiz files (`htmls/classs9-10mathematics.html`, `htmls/quiz_htmls/class9-10maths.html`, `htmls/quiz_htmls/class9-10science.html`, `htmls/quiz_htmls/class9-10mathematics.html`) have canonical tags pointing to `/htmls/dashboard.html` — while `robots.txt` explicitly contains `Disallow: /htmls/dashboard.html`. Directing crawlers to a blocked canonical page triggers indexing cancellation.

#### Affected Files (34 total):
- `htmls/classs9-10mathematics.html`
- `htmls/dashboard.html`
- `htmls/chat/chat_app.html`
- `htmls/quiz_htmls/class9-10maths.html`
- `htmls/quiz_htmls/class9-10science.html`
- `htmls/quiz_htmls/class9-10mathematics.html`
- `htmls/quiz_htmls/class9_chemistry-chapter-1.html` through `chapter-4.html`
- `htmls/quiz_htmls/class9_mathematics-chapter-1.html` through `chapter-15.html`
- `htmls/quiz_htmls/class9-physics_chapter1.html` through `chapter3.html`
- `htmls/quiz_htmls/class10-physics-chapter-1.html` through `chapter-4.html`
- `htmls/quiz_htmls/class10-biology-chapetr-1.html` and `chapter-2.html`

---

### Issue 2: Firebase Wildcard Rewrite Generating "Soft 404" Errors
- **Location:** `firebase.json` (lines 159–164)
  ```json
  "rewrites": [
    {
      "source": "**",
      "destination": "/index.html"
    }
  ]
  ```
- **What is happening:** NeoBranium is a multi-page static website, not a Single Page App (SPA). When a wildcard rewrite (`"**"`) is active, any requested URL that does not match an existing file (such as deleted pages, typos, or bots probing invalid endpoints) returns **HTTP 200 (OK)** with the homepage content instead of a genuine **HTTP 404 (Not Found)** status.
- **Impact:** Google classifies this as a **Soft 404 penalty**. Excessive soft 404s degrade crawl quality and cause Googlebot to slow or halt indexation across the entire domain.

---

### Issue 3: Missing Self-Referencing Canonical Tags on 111 Pages
- **Location:** 111 out of 192 HTML files in the codebase
- **What is happening:** Firebase Hosting automatically creates two mirrors for your deployment:
  - `https://neobranium.web.app/`
  - `https://neobranium.firebaseapp.com/`
- **Impact:** Without explicit `<link rel="canonical" href="https://neobranium.web.app/...">` tags on every public page, Google detects duplicate content between `.web.app` and `.firebaseapp.com`, splitting crawl authority and delaying indexing.

---

### Issue 4: Severely Incomplete `sitemap.xml` (Missing 134 Pages)
- **Location:** `sitemap.xml`
- **Total HTML files in repo:** 192
- **URLs present in sitemap:** Only 58
- **Missing Pages (134 total):**
  - **30 core notes pages** in `/Notes/` (including Class 11 & 12 notes and detailed chapters)
  - **51 question bank pages** in `/IQ/` (`class9-maths`, `class9-science`, `class10-maths`, `class10-science`)
  - **43 quiz pages** in `/htmls/quiz_htmls/`
  - Multiple utility & informational pages
- **Impact:** Googlebot relies heavily on XML sitemaps to discover content on new domains that do not yet have rich external backlinks.

---

### Issue 5: Broken Internal Navigation Links
- **Location:** `Notes/9-PH4.html` and `Notes/9-PH5.html`
- **What is happening:** Navigation links point to non-existent paths like `/Notes/class-9/9-CH1.html`.
- **Impact:** Crawlers following these internal links get redirected to the homepage via the wildcard rewrite, wasting crawl budget and reinforcing the Soft 404 signal.

---

### Issue 6: Free Subdomain Sandboxing & Lack of Web Signals
- **Domain Type:** `*.web.app`
- **What is happening:** Free cloud hosting subdomains (`*.web.app`, `*.firebaseapp.com`, `*.vercel.app`) host millions of temporary, spam, and test applications.
- **Impact:** Google does not automatically index newly created free subdomains unless:
  1. The domain is verified in Google Search Console.
  2. The sitemap is submitted and validated.
  3. Priority pages are manually requested for indexing via the URL Inspection tool.
  4. There are external web signals (social media profiles, directory citations, or backlinks).

---

## 2. Actionable Remediation Plan

### Step 1: Fix Canonical Tags
1. Replace all instances of `https://neobranium.com/` with `https://neobranium.web.app/`.
2. Ensure canonical tags point to the exact file path (e.g. `https://neobranium.web.app/htmls/quiz_htmls/class9_chemistry-chapter-3.html`).
3. Remove canonical tags pointing to private or disallowed pages like `/htmls/dashboard.html`.
4. Inject self-referencing canonical tags into all 111 pages currently lacking one.

### Step 2: Update `firebase.json` Configuration
1. Remove the catch-all rewrite to prevent Soft 404s:
   ```json
   // REMOVE from firebase.json:
   "rewrites": [
     {
       "source": "**",
       "destination": "/index.html"
     }
   ]
   ```
2. Create a dedicated `404.html` error page so non-existent URLs return a genuine HTTP 404 status.
3. Enable clean URLs if extensionless URLs are preferred:
   ```json
   "cleanUrls": true
   ```

### Step 3: Regenerate `sitemap.xml`
1. Rebuild `sitemap.xml` to include all 180+ public HTML pages (excluding private user pages like `/htmls/dashboard.html`, `/htmls/profile.html`, `/htmls/setting.html`).
2. Add current, accurate `<lastmod>` timestamps and `<priority>` weights.

### Step 4: Fix Broken Navigation Links
1. Correct the relative links in `Notes/9-PH4.html` and `Notes/9-PH5.html` from `/Notes/class-9/9-*.html` to `/Notes/9-*.html`.

### Step 5: Google Search Console (GSC) Execution
1. Open [Google Search Console](https://search.google.com/search-console).
2. Add property as **URL Prefix**: `https://neobranium.web.app/`.
3. Verify ownership via the HTML tag already present in `index.html`:
   ```html
   <meta name="google-site-verification" content="eWahyNzI3V_lE3dyU2Swxo7U0ZZIGXv-ArPqwX9r360" />
   ```
4. Navigate to **Sitemaps** and submit `https://neobranium.web.app/sitemap.xml`.
5. Use the **URL Inspection Tool** to inspect:
   - `https://neobranium.web.app/`
   - `https://neobranium.web.app/Notes/notes-science-class10.html`
   - `https://neobranium.web.app/IQ/top-question.html`
   - `https://neobranium.web.app/blog/blog.html`
6. Click **"Request Indexing"** on each key URL to prompt Googlebot to schedule an immediate crawl.
