import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/**
 * High-fidelity RuleDataSnapshot simulating Firebase Realtime Database rule evaluation.
 * Evaluates the actual expressions from database.rules.json.
 */
class RuleDataSnapshot {
  constructor(data) {
    this._data = data;
  }
  exists() {
    return this._data !== null && this._data !== undefined;
  }
  val() {
    return this._data;
  }
  child(p) {
    if (!this.exists() || typeof this._data !== 'object') return new RuleDataSnapshot(null);
    return new RuleDataSnapshot(this._data[p] !== undefined ? this._data[p] : null);
  }
  hasChildren(keys) {
    if (!this.exists() || typeof this._data !== 'object') return false;
    return keys.every(k => this._data[k] !== undefined && this._data[k] !== null);
  }
  hasChild(k) {
    if (!this.exists() || typeof this._data !== 'object') return false;
    return this._data[k] !== undefined && this._data[k] !== null;
  }
  isString() {
    return typeof this._data === 'string';
  }
  isNumber() {
    return typeof this._data === 'number';
  }
  isBoolean() {
    return typeof this._data === 'boolean';
  }
}

describe('NB-SEC-07: Realtime Database Rules Evaluation & Identity Integrity', () => {
  const rulesJson = JSON.parse(fs.readFileSync(path.resolve('database.rules.json'), 'utf-8'));
  const noteCommentsRules = rulesJson.rules.notes['$noteId'].comments;
  const commentWriteRule = noteCommentsRules['$commentId']['.write'];
  const commentValidateRule = noteCommentsRules['$commentId']['.validate'];
  const commentsReadRule = noteCommentsRules['.read'];

  function evalExpression(expr, { auth, data = null, newData = null }) {
    const sandbox = {
      auth,
      data: new RuleDataSnapshot(data),
      newData: new RuleDataSnapshot(newData)
    };
    const context = vm.createContext(sandbox);
    // In Firebase RTDB rules, string primitives have a .matches(regex) method
    vm.runInContext('String.prototype.matches = function(re) { return new RegExp(re).test(this); };', context);
    return Boolean(vm.runInContext(expr, context));
  }

  const validComment = {
    uid: 'alice',
    username: 'Alice Smith',
    text: 'Great notes on physics chapter 1!',
    timestamp: 1700000000000,
    reported: false,
    deleted: false
  };

  it('rejects unauthenticated read requests on notes comments', () => {
    const allowed = evalExpression(commentsReadRule, { auth: null });
    assert.strictEqual(allowed, false, 'Unauthenticated users must not read comments');
  });

  it('allows authenticated users to read comments', () => {
    const allowed = evalExpression(commentsReadRule, { auth: { uid: 'student_1' } });
    assert.strictEqual(allowed, true, 'Authenticated users must be permitted to read comments');
  });

  it('rejects unauthenticated write attempts', () => {
    const allowed = evalExpression(commentWriteRule, {
      auth: null,
      data: null,
      newData: validComment
    });
    assert.strictEqual(allowed, false, 'Unauthenticated writes must be rejected');
  });

  it('rejects comment creation when author UID is spoofed (Bob claiming Alice UID)', () => {
    const spoofedComment = { ...validComment, uid: 'alice' };
    const writeAllowed = evalExpression(commentWriteRule, {
      auth: { uid: 'bob' },
      data: null,
      newData: spoofedComment
    });
    assert.strictEqual(writeAllowed, false, 'Bob must not create comments claiming to be Alice');

    // Validation also rejects
    const valAllowed = evalExpression(commentValidateRule, {
      auth: { uid: 'bob' },
      data: null,
      newData: spoofedComment
    });
    assert.strictEqual(valAllowed, false, 'Validation rule must reject mismatched UID');
  });

  it('rejects comment creation when UID field is missing', () => {
    const missingUidComment = {
      username: 'Alice Smith',
      text: 'Missing UID field',
      timestamp: 1700000000000
    };
    const writeAllowed = evalExpression(commentWriteRule, {
      auth: { uid: 'alice' },
      data: null,
      newData: missingUidComment
    });
    assert.strictEqual(writeAllowed, false, 'Writes without UID must be rejected');

    const valAllowed = evalExpression(commentValidateRule, {
      auth: { uid: 'alice' },
      data: null,
      newData: missingUidComment
    });
    assert.strictEqual(valAllowed, false, 'Validation must require UID child');
  });

  it('allows legitimate comment creation matching authenticated UID', () => {
    const writeAllowed = evalExpression(commentWriteRule, {
      auth: { uid: 'alice' },
      data: null,
      newData: validComment
    });
    assert.strictEqual(writeAllowed, true, 'Owner write must be permitted');

    const valAllowed = evalExpression(commentValidateRule, {
      auth: { uid: 'alice' },
      data: null,
      newData: validComment
    });
    assert.strictEqual(valAllowed, true, 'Valid comment must pass validation');
  });

  it('rejects comments containing script tags via regex validation', () => {
    const scriptComment = {
      ...validComment,
      text: 'Check this out: <script>alert("xss")</script>'
    };
    const valAllowed = evalExpression(commentValidateRule, {
      auth: { uid: 'alice' },
      data: null,
      newData: scriptComment
    });
    assert.strictEqual(valAllowed, false, 'Script tags must be rejected by rule regex');
  });

  it('prevents another user from modifying Alice comment', () => {
    const tamperedComment = {
      ...validComment,
      text: 'Tampered by Bob!'
    };
    const writeAllowed = evalExpression(commentWriteRule, {
      auth: { uid: 'bob' },
      data: validComment,
      newData: tamperedComment
    });
    assert.strictEqual(writeAllowed, false, 'Bob must not modify Alice comment text');
  });

  it('prevents another user from deleting Alice comment', () => {
    const deleteAllowed = evalExpression(commentWriteRule, {
      auth: { uid: 'bob' },
      data: validComment,
      newData: null
    });
    assert.strictEqual(deleteAllowed, false, 'Bob must not delete Alice comment');
  });

  it('allows Alice to soft-delete her own comment', () => {
    const softDeleted = {
      ...validComment,
      deleted: true
    };
    const writeAllowed = evalExpression(commentWriteRule, {
      auth: { uid: 'alice' },
      data: validComment,
      newData: softDeleted
    });
    assert.strictEqual(writeAllowed, true, 'Alice must be permitted to soft-delete her comment');

    const valAllowed = evalExpression(commentValidateRule, {
      auth: { uid: 'alice' },
      data: validComment,
      newData: softDeleted
    });
    assert.strictEqual(valAllowed, true, 'Soft-delete must pass validation');
  });

  it('allows Alice to permanently delete her own comment', () => {
    const deleteAllowed = evalExpression(commentWriteRule, {
      auth: { uid: 'alice' },
      data: validComment,
      newData: null
    });
    assert.strictEqual(deleteAllowed, true, 'Alice must be permitted to delete her comment');
  });

  it('allows another user to flag/report a comment without altering text or author', () => {
    const reportedComment = {
      ...validComment,
      reported: true
    };
    const reportAllowed = evalExpression(commentWriteRule, {
      auth: { uid: 'bob' },
      data: validComment,
      newData: reportedComment
    });
    assert.strictEqual(reportAllowed, true, 'Third party must be permitted to flag a comment');
  });
});
