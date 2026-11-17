import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// ─── Synthetic DOM implementation for headless verification ─────────────────
class SyntheticNode {
  constructor(nodeName, nodeType = 1) {
    this.nodeName = nodeName.toUpperCase();
    this.nodeType = nodeType;
    this.childNodes = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.href = '';
    this.title = '';
    this.id = '';
    this._text = '';
    this.innerHTML = '';
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c),
      toggle: (c, force) => {
        if (force !== undefined) {
          if (force) this.classList._classes.add(c);
          else this.classList._classes.delete(c);
          return force;
        }
        if (this.classList._classes.has(c)) {
          this.classList._classes.delete(c);
          return false;
        }
        this.classList._classes.add(c);
        return true;
      }
    };
  }

  get className() { return Array.from(this.classList._classes).join(' '); }
  set className(val) {
    this.classList._classes.clear();
    if (val) val.split(/\s+/).filter(Boolean).forEach(c => this.classList._classes.add(c));
  }

  get textContent() {
    if (this.nodeType === 3) return this._text || '';
    return this.childNodes.map(c => c.textContent).join('');
  }
  set textContent(val) {
    this.childNodes = [];
    const textNode = new SyntheticNode('#text', 3);
    textNode._text = String(val ?? '');
    this.childNodes.push(textNode);
  }

  appendChild(child) {
    this.childNodes.push(child);
    return child;
  }

  replaceChildren(...newChildren) {
    this.childNodes = [...newChildren];
  }

  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  click() {
    const handlers = this.listeners.get('click') || [];
    for (const h of handlers) h({ type: 'click', target: this });
  }

  querySelectorAll(selector) {
    const results = [];
    const walk = (node) => {
      if (selector.startsWith('.') && node.classList && node.classList.contains(selector.slice(1))) {
        results.push(node);
      }
      for (const child of node.childNodes) walk(child);
    };
    walk(this);
    return results;
  }
}

function createSyntheticEnv(initialStorage = {}) {
  const store = new Map(Object.entries(initialStorage));
  const elementsById = new Map();

  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  const document = {
    createElement: (tag) => new SyntheticNode(tag, 1),
    createTextNode: (text) => {
      const node = new SyntheticNode('#text', 3);
      node._text = String(text);
      return node;
    },
    getElementById: (id) => elementsById.get(id) || null,
    registerElement: (id, node) => {
      node.id = id;
      elementsById.set(id, node);
      return node;
    }
  };

  return { document, localStorage, elementsById };
}

describe('NB-SEC-10: DOM-Based XSS Remediation & Real DOM Execution', () => {
  const profileHtml = fs.readFileSync(path.resolve('htmls/profile.html'), 'utf-8');
  const dashboardHtml = fs.readFileSync(path.resolve('htmls/dashboard.html'), 'utf-8');
  const myLearningJs = fs.readFileSync(path.resolve('js/my-learning.js'), 'utf-8');

  it('profile.html does not assign unescaped bookmarks to container.innerHTML', () => {
    assert.strictEqual(
      profileHtml.includes('container.innerHTML = list.map'),
      false,
      'profile.html must not use container.innerHTML = list.map'
    );
    assert.ok(profileHtml.includes('qText.textContent = item.question'));
    assert.ok(profileHtml.includes('sanitizeQuizPage'));
    assert.ok(profileHtml.includes('replaceChildren'));
  });

  it('dashboard.html does not assign unescaped bookmarks to container.innerHTML', () => {
    assert.strictEqual(
      dashboardHtml.includes('container.innerHTML = bookmarks.map'),
      false,
      'dashboard.html must not use container.innerHTML = bookmarks.map'
    );
    assert.ok(dashboardHtml.includes('qText.textContent = b.question'));
    assert.ok(dashboardHtml.includes('sanitizeQuizPage'));
    assert.ok(dashboardHtml.includes('replaceChildren'));
  });

  it('sanitizeQuizPage regex rejects javascript: URIs, protocol-relative, and arbitrary URLs', () => {
    function sanitizeQuizPage(page) {
      if (typeof page === 'string' && /^\/htmls\/quiz_htmls\/[a-zA-Z0-9_\-]+\.html$/.test(page)) {
        return page;
      }
      return '/htmls/quiz_htmls/class10-physics-chapter-1.html';
    }

    assert.strictEqual(sanitizeQuizPage('javascript:alert(1)'), '/htmls/quiz_htmls/class10-physics-chapter-1.html');
    assert.strictEqual(sanitizeQuizPage('data:text/html,<script>alert(1)</script>'), '/htmls/quiz_htmls/class10-physics-chapter-1.html');
    assert.strictEqual(sanitizeQuizPage('//attacker.com/evil.html'), '/htmls/quiz_htmls/class10-physics-chapter-1.html');
    assert.strictEqual(sanitizeQuizPage('https://attacker.com/quiz.html'), '/htmls/quiz_htmls/class10-physics-chapter-1.html');
    assert.strictEqual(sanitizeQuizPage('/htmls/quiz_htmls/../evil.html'), '/htmls/quiz_htmls/class10-physics-chapter-1.html');
    assert.strictEqual(sanitizeQuizPage(null), '/htmls/quiz_htmls/class10-physics-chapter-1.html');
    assert.strictEqual(sanitizeQuizPage(undefined), '/htmls/quiz_htmls/class10-physics-chapter-1.html');
    assert.strictEqual(
      sanitizeQuizPage('/htmls/quiz_htmls/class10-physics-chapter-1.html'),
      '/htmls/quiz_htmls/class10-physics-chapter-1.html'
    );
    assert.strictEqual(
      sanitizeQuizPage('/htmls/quiz_htmls/class9-10science.html'),
      '/htmls/quiz_htmls/class9-10science.html'
    );
  });

  it('my-learning.js uses safeQuizUrl for quiz links', () => {
    assert.ok(myLearningJs.includes('function safeQuizUrl('));
    assert.ok(myLearningJs.includes('safeQuizUrl(b.quizPage)'));
  });

  it('executes profile rendering with hostile strings: treats HTML as text and neutralizes javascript: URLs', () => {
    const hostileBookmarks = [
      {
        id: 'hostile-1',
        quizTitle: '<img src=x onerror=alert("title_xss")>',
        question: '<script>alert("question_xss")</script> What is Newton\'s First Law?',
        answer: '<b>Inertia</b><script>alert("ans_xss")</script>',
        quizPage: 'javascript:alert("url_xss")',
        savedAt: Date.now()
      }
    ];

    const env = createSyntheticEnv({
      neobranium_quiz_bookmarks: JSON.stringify(hostileBookmarks)
    });

    const container = new SyntheticNode('div');
    const countEl = new SyntheticNode('span');
    env.document.registerElement('profileSavedQuestionsContainer', container);
    env.document.registerElement('profileSavedCount', countEl);

    // Extract the exact JavaScript block from profile.html
    const fnStart = profileHtml.indexOf('const BOOKMARKS_KEY = "neobranium_quiz_bookmarks";');
    const fnEnd = profileHtml.lastIndexOf('renderProfileSavedQuestions();');
    assert.ok(fnStart > -1 && fnEnd > -1, 'Must find renderProfileSavedQuestions in profile.html');
    const code = profileHtml.slice(fnStart, fnEnd);

    const context = vm.createContext({
      document: env.document,
      localStorage: env.localStorage,
      Date: globalThis.Date,
      JSON: globalThis.JSON
    });

    vm.runInContext(code + '\nrenderProfileSavedQuestions();', context);

    // 1. Check item count updated
    assert.strictEqual(countEl.textContent, '1');

    // 2. Check cards rendered
    assert.strictEqual(container.childNodes.length, 1);
    const card = container.childNodes[0];

    // 3. Question must be textContent, NOT parsed HTML
    const pElements = card.childNodes.filter(n => n.nodeName === 'P');
    assert.ok(pElements.length >= 1);
    const qText = pElements[0].textContent;
    assert.strictEqual(qText, '<script>alert("question_xss")</script> What is Newton\'s First Law?');

    // 4. Verify no innerHTML parsed for question
    assert.strictEqual(pElements[0].innerHTML, '');

    // 5. Quiz URL must have been sanitized away from javascript:
    const links = card.querySelectorAll('.btn');
    const openQuizLink = links.find(l => l.nodeName === 'A');
    assert.ok(openQuizLink, 'Must find Open Quiz link');
    assert.strictEqual(openQuizLink.href, '/htmls/quiz_htmls/class10-physics-chapter-1.html');
    assert.notStrictEqual(openQuizLink.href, 'javascript:alert("url_xss")');
  });

  it('executes dashboard rendering with hostile strings: neutralizes XSS and supports answer toggle', () => {
    const hostileBookmarks = [
      {
        id: 'hostile-dash-1',
        quizTitle: '<svg onload=alert("title_svg")>',
        question: '<img src=x onerror=alert("q_dash")> Calculate velocity',
        answer: '<iframe src="javascript:alert(1)"></iframe> 10 m/s',
        quizPage: 'data:text/html,<script>alert(1)</script>',
        savedAt: 1700000000000
      }
    ];

    const env = createSyntheticEnv({
      neobranium_quiz_bookmarks: JSON.stringify(hostileBookmarks)
    });

    const container = new SyntheticNode('div');
    const badge = new SyntheticNode('span');
    env.document.registerElement('savedQuestionsContainer', container);
    env.document.registerElement('savedQuestionsBadge', badge);

    const fnStart = dashboardHtml.indexOf('const BOOKMARKS_KEY = "neobranium_quiz_bookmarks";');
    const fnEnd = dashboardHtml.lastIndexOf('loadSavedQuestions();');
    assert.ok(fnStart > -1 && fnEnd > -1, 'Must find loadSavedQuestions in dashboard.html');
    const code = dashboardHtml.slice(fnStart, fnEnd);

    const context = vm.createContext({
      document: env.document,
      localStorage: env.localStorage,
      Date: globalThis.Date,
      JSON: globalThis.JSON
    });

    vm.runInContext(code + '\nloadSavedQuestions();', context);

    // 1. Badge count
    assert.strictEqual(badge.textContent, '1');

    // 2. Card rendered
    assert.strictEqual(container.childNodes.length, 1);
    const card = container.childNodes[0];

    // 3. Question is rendered via textContent
    const qDiv = card.childNodes.find(n => n.classList.contains('nb-saved-q-text'));
    assert.ok(qDiv);
    assert.strictEqual(qDiv.textContent, '<img src=x onerror=alert("q_dash")> Calculate velocity');

    // 4. Answer is safely attached via textContent / textNode
    const ansDiv = card.childNodes.find(n => n.classList.contains('nb-saved-q-ans'));
    assert.ok(ansDiv);
    assert.ok(ansDiv.textContent.includes('<iframe src="javascript:alert(1)"></iframe> 10 m/s'));

    // 5. Quiz URL sanitized from data: URI to safe fallback
    const practiceLink = card.querySelectorAll('.btn').find(n => n.nodeName === 'A');
    assert.ok(practiceLink);
    assert.strictEqual(practiceLink.href, '/htmls/quiz_htmls/class10-physics-chapter-1.html');

    // 6. Test toggle-answer button functionality
    const toggleBtn = card.querySelectorAll('.toggle-ans-btn')[0];
    assert.ok(toggleBtn);
    assert.ok(ansDiv.classList.contains('d-none'), 'Answer box should initially be hidden');

    // Click to reveal answer
    toggleBtn.click();
    assert.strictEqual(ansDiv.classList.contains('d-none'), false, 'Answer box should be visible after click');

    // Click again to hide
    toggleBtn.click();
    assert.strictEqual(ansDiv.classList.contains('d-none'), true, 'Answer box should be hidden again after second click');
  });

  it('preserves normal bookmark rendering and removal in profile', () => {
    const normalBookmarks = [
      {
        id: 'bm-normal-1',
        quizTitle: 'Class 10 Physics',
        question: 'What is Ohm\'s Law?',
        answer: 'V = IR',
        quizPage: '/htmls/quiz_htmls/class10-physics-chapter-1.html',
        savedAt: 1700000000000
      }
    ];

    const env = createSyntheticEnv({
      neobranium_quiz_bookmarks: JSON.stringify(normalBookmarks)
    });

    const container = new SyntheticNode('div');
    const countEl = new SyntheticNode('span');
    env.document.registerElement('profileSavedQuestionsContainer', container);
    env.document.registerElement('profileSavedCount', countEl);

    const fnStart = profileHtml.indexOf('const BOOKMARKS_KEY = "neobranium_quiz_bookmarks";');
    const fnEnd = profileHtml.lastIndexOf('renderProfileSavedQuestions();');
    const code = profileHtml.slice(fnStart, fnEnd);

    const context = vm.createContext({
      document: env.document,
      localStorage: env.localStorage,
      Date: globalThis.Date,
      JSON: globalThis.JSON
    });

    vm.runInContext(code + '\nrenderProfileSavedQuestions();', context);

    assert.strictEqual(countEl.textContent, '1');
    assert.strictEqual(container.childNodes.length, 1);
    const card = container.childNodes[0];

    // Check normal fields
    const pElements = card.childNodes.filter(n => n.nodeName === 'P');
    assert.strictEqual(pElements[0].textContent, 'What is Ohm\'s Law?');

    const badge = card.querySelectorAll('.badge')[0];
    assert.strictEqual(badge.textContent, 'Class 10 Physics');

    const openQuizLink = card.querySelectorAll('.btn').find(l => l.nodeName === 'A');
    assert.strictEqual(openQuizLink.href, '/htmls/quiz_htmls/class10-physics-chapter-1.html');

    // Click remove button
    const removeBtn = card.querySelectorAll('.prof-remove-bm')[0];
    assert.ok(removeBtn);
    removeBtn.click();

    // Verify item was removed from storage and empty view rendered
    const remaining = JSON.parse(env.localStorage.getItem('neobranium_quiz_bookmarks'));
    assert.deepStrictEqual(remaining, []);
    assert.strictEqual(countEl.textContent, '0');
  });
});
