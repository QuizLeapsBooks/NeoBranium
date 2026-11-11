# NeoBook — Source-grounded study workspace

NeoBook is a source-grounded research and study workspace inspired by NotebookLM, integrated directly into the NeoBranium platform.

## Architecture

- **Subfolder**: `NeoBook/`
  - `index.html`: Responsive 3-panel layout (Sources, AI Chat, Studio Space) with mobile tab adaptability.
  - `neobook.css`: NeoBranium dashboard-aligned surfaces, typography, and restrained purple accent.
  - `neobook-app.js`: Client-side application managing notebooks, sources, chat sessions, citations, and daily limits.
  - `neobook-mindmap.js` / `neobook-mindmap.css`: Interactive D3 tree view, source selection, saved-map reopening, navigation, node actions, and responsive presentation.

- **Backend Services**:
  - `services/neobookConfig.js`: Configurable limits (5 new chats/day, 150k token budget, 15 sources max, 10MB PDF size limit).
  - `services/neobookLimitService.js`: Server-side IP normalization, HMAC hashing, verified Firebase UID integration, and atomic Firestore transactions.
  - `services/neobookSourceService.js`: SSRF-protected website fetcher, YouTube caption/transcript extractor, PDF text extractor, and semantic chunker.
  - `services/neobookAiService.js`: Content-grounded RAG retriever, anti-prompt injection delimiters, inline citation tags, and token/cost estimation.
  - `services/neobookMindMapService.js`: Bounded chunk retrieval, Gemini structured JSON generation, node-schema validation, and source-reference resolution.
  - `routes/neobookRoutes.js`: REST API endpoints mounted on `/api/neobook`.
  - Firestore collection `neobook_mindmaps`: UID-owned generated trees and user view state, written through authenticated backend routes.

## Features

1. **Sources Panel (Left)**:
   - Website URL fetching with server-side SSRF validation (blocking private/internal/cloud metadata IPs).
   - YouTube video link extraction (retrieving timed captions/transcripts with timestamps, strict no-hallucination if unavailable).
   - Text input (raw notes, study guides, outlines).
   - PDF upload (drag & drop, client base64 reading, server-side page-by-page text extraction).
   - Clear processing status badges (`ready`, `processing`, `error`).
   - Source removal.

2. **AI Chat Panel (Center)**:
   - Grounded conversational Q&A based exclusively on active notebook sources.
   - Inline citation tags linking back to source titles, pages, and timestamps.
   - Follow-up question support with recent conversation context.
   - Explicit communication when information is not in the sources.
   - New Chat creation (consumes 1 of 5 daily new-chat slots).
   - Chat history drawer to reopen previous chats without consuming new-chat allowances.

3. **Studio Space (Right)**:
   - Interactive Mind Map: choose all ready sources or a subset, generate a source-grounded topic hierarchy, reopen saved maps, expand branches with Gemini, request node explanations, zoom/pan, fit/reset, expand/collapse, reposition topics, and download SVG.
   - Data Table & Study Guide (structured extraction).
   - Interactive Quiz (instant knowledge checks).
   - Smart Flashcards (spaced repetition recall).
   - Audio Overview remains a visual coming-soon card.

4. **Quota & Security**:
   - Max 5 new chats per user/IP per day.
   - Opening existing chats does NOT consume new-chat allowances.
   - Follow-up messages do NOT count as new chats.
   - Independent AI token budget (does NOT modify or consume NeoLens, NeoBoard, or other NeoBranium quotas).
   - Server-observed IP tracking using HMAC-SHA256 hashed IPs and verified Firebase UIDs.
   - Firestore security rules preventing direct client writes and protecting user data.

## Mind Map interaction notes

- Google’s [Use Mind Maps in Gemini Notebook](https://support.google.com/notebooklm/answer/16212283?hl=en) describes source summaries in a branching diagram, zoom and scroll navigation, branch expansion/collapse, selecting topics for questions, revisit-able Studio artifacts, and download. NeoBook adapts those interaction patterns to its own sources, dashboard theme, and chat-scoped data model.
- D3 is loaded as an ES module from jsDelivr only when the map view is opened. Its tree, zoom, drag, keyed joins, and transitions keep rendering incremental without adding a build step to the static NeoBook client.
- Initial generation and node expansion send at most 12 relevant chunks (up to 1,800 characters each) to Gemini. Citations are resolved exclusively from the retrieved chunk references; unknown model-provided references are discarded and nodes without valid references are rejected.
- Map generation and explanation require a signed-in Firebase UID. Maps, source IDs, expanded tree nodes, collapsed node IDs, selected topic, viewport, and drag positions are stored by the backend and scoped to the verified UID and owning chat.
