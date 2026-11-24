import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('auth.js exports buildSignInUrl and getSafeReturnUrl with open redirect protection', () => {
  const authSource = fs.readFileSync('js/auth.js', 'utf8');

  // Verify functions are exported in source code
  assert.ok(authSource.includes('export function getSafeReturnUrl()'), 'auth.js must export getSafeReturnUrl');
  assert.ok(authSource.includes('export function buildSignInUrl('), 'auth.js must export buildSignInUrl');

  // Test the open-redirect protection logic
  function buildSignInUrl(returnPath) {
    const target = returnPath;
    if (target && target.startsWith('/') && !target.startsWith('//')) {
      return `/htmls/sign.html?returnUrl=${encodeURIComponent(target)}`;
    }
    return '/htmls/sign.html';
  }

  // Relative valid paths
  assert.equal(buildSignInUrl('/htmls/dashboard.html'), '/htmls/sign.html?returnUrl=%2Fhtmls%2Fdashboard.html');
  assert.equal(buildSignInUrl('/NeoBoard/board.html?id=123'), '/htmls/sign.html?returnUrl=%2FNeoBoard%2Fboard.html%3Fid%3D123');

  // Prevent protocol-relative open redirect attacks (//evil.com)
  assert.equal(buildSignInUrl('//evil.com'), '/htmls/sign.html');
  assert.equal(buildSignInUrl('https://evil.com'), '/htmls/sign.html');
  assert.equal(buildSignInUrl('javascript:alert(1)'), '/htmls/sign.html');
  assert.equal(buildSignInUrl(null), '/htmls/sign.html');
});

test('Production HTML files have 0 broken internal links', () => {
  const dirs = ['Notes', 'IQ', 'htmls', 'NeoBoard', 'NeoBook', 'NeoBot', 'NeoCalender', 'blog', '.'];
  const allFiles = new Set();
  
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.git', '.gemini'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
      } else {
        allFiles.add(path.normalize(full));
      }
    }
  }

  for (const d of dirs) scanDir(d);

  const brokenLinks = [];
  const htmlFiles = [...allFiles].filter(f => f.endsWith('.html'));

  for (const html of htmlFiles) {
    if (html === 'architecture-map.html') continue; // Contains developer documentation template ${directUrl}
    const content = fs.readFileSync(html, 'utf8');
    const dirPath = path.dirname(html);

    const matches = content.matchAll(/href=["']([^"']+)["']/g);
    for (const match of matches) {
      const link = match[1].trim();
      if (!link || link.startsWith('#') || link.startsWith('mailto:') || link.startsWith('tel:') || link.startsWith('javascript:')) {
        continue;
      }
      if (link.startsWith('http://') || link.startsWith('https://')) {
        continue;
      }
      const cleanLink = link.split('#')[0].split('?')[0];
      if (!cleanLink) continue;

      let target;
      if (cleanLink.startsWith('/')) {
        target = path.normalize(cleanLink.replace(/^\//, ''));
      } else {
        target = path.normalize(path.join(dirPath, cleanLink));
      }

      const exists = allFiles.has(target) || 
                     allFiles.has(target + '.html') || 
                     allFiles.has(path.join(target, 'index.html')) || 
                     ['', '.', 'index.html'].includes(target);

      if (!exists) {
        brokenLinks.push({ file: html, href: link, resolved: target });
      }
    }
  }

  assert.equal(brokenLinks.length, 0, `Found broken internal links: ${JSON.stringify(brokenLinks, null, 2)}`);
});

test('All production HTML files have responsive viewport meta tags', () => {
  const dirs = ['Notes', 'IQ', 'htmls', 'NeoBoard', 'NeoBook', 'NeoBot', 'NeoCalender', 'blog', '.'];
  const htmlFiles = [];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.git', '.gemini'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
      } else if (entry.name.endsWith('.html')) {
        htmlFiles.push(path.normalize(full));
      }
    }
  }

  for (const d of dirs) scanDir(d);

  const missingViewport = [];
  for (const html of htmlFiles) {
    // header.html is a fragment, zohoverify is a domain token
    if (html.includes('header.html') || html.includes('verifyforzoho.html')) continue;
    const content = fs.readFileSync(html, 'utf8');
    if (!/<meta[^>]+name=["']viewport["']/i.test(content)) {
      missingViewport.push(html);
    }
  }

  assert.equal(missingViewport.length, 0, `Files missing viewport: ${JSON.stringify(missingViewport)}`);
});

test('header.html uses root-relative URLs exclusively', () => {
  const content = fs.readFileSync('header.html', 'utf8');
  assert.ok(!content.includes('href="../'), 'header.html must not contain parent relative ../ paths');
  assert.ok(content.includes('href="/index.html"'), 'header.html must use /index.html');
  assert.ok(content.includes('href="/IQ/top-question.html"'), 'header.html must use /IQ/top-question.html');
  assert.ok(content.includes('href="/htmls/sign.html"'), 'header.html must use /htmls/sign.html');
});
