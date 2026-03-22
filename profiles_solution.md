# Proposed Solutions for NeoBranium AI

This document explains the technical solutions to the problems identified in `profilem.md`.

### 1. Unified Task Handling (Solution for #1, #3, #6)
Instead of a generic chat endpoint, we will introduce a `task` parameter in the request body.

**Change**:
In `js-generate.js`, we send:
```javascript
{ 
  message: aiPrompt, 
  task: 'paper_generation' 
}
```
In `server.js`, we use this to select the perfect persona:
```javascript
const systemIdentity = task === 'paper_generation' 
  ? "You are a professional Indian exam paper setter." 
  : "You are the NS-x AI Learning Assistant...";
```

### 2. Precise Regex for Query Type (Solution for #2)
We will refine the `detectQueryType` to use word boundaries and ignore common school terms.

**Change**:
```javascript
// Before
code: /...|class|.../i

// After (using word boundaries \b)
code: /\b(write|code|programming|python|js|java|function)\b/i
```
This prevents `- Class: 8` from being flagged as a programming request.

### 3. Context-Aware Instructions (Solution for #3, #5)
The hardcoded "educational manner" and "explaining code" instructions will only be appended to **General Chat** requests, not structured tasks.

**Change**:
```javascript
const userContent = task === 'paper_generation'
  ? `Task: ${message}` // Direct task access
  : `User question: ${message}\n\nRespond in a helpful, educational manner...`;
```

### 4. Hybrid Security Model (Partial Solution for #4)
While `localStorage` is used for UX limits, we can add a basic "Cool-down" or "Usage-ID" check on the server using the existing Redis sessions to prevent rapid-fire botting.

---

## Why these solutions?
- **Clarity**: The AI gets one clear set of instructions instead of two conflicting ones.
- **Accuracy**: Correctly identifies what the user actually wants (Math vs Code).
- **Efficiency**: Reduces unnecessary tokens in the prompt, making responses faster and cheaper.
