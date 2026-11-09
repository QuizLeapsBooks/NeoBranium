# NeoBook — Basic MVP inside NeoBranium

NeoBook is a source-grounded research and study workspace inspired by NotebookLM, integrated directly into the NeoBranium platform.

## Architecture

- **Subfolder**: `NeoBook/`
  - `index.html`: Responsive 3-panel layout (Sources, AI Chat, Future Studio Space) with mobile tab adaptability.
  - `neobook.css`: NeoBranium design system styling with dark theme, glassmorphism, and accent palette.
  - `neobook-app.js`: Client-side application managing notebooks, sources, chat sessions, citations, and daily limits.

- **Backend Services**:
  - `services/neobookConfig.js`: Configurable limits (5 new chats/day, 150k token budget, 15 sources max, 10MB PDF size limit).
  - `services/neobookLimitService.js`: Server-side IP normalization, HMAC hashing, verified Firebase UID integration, and atomic Firestore transactions.
  - `services/neobookSourceService.js`: SSRF-protected website fetcher, YouTube caption/transcript extractor, PDF text extractor, and semantic chunker.
  - `services/neobookAiService.js`: Content-grounded RAG retriever, anti-prompt injection delimiters, inline citation tags, and token/cost estimation.
  - `routes/neobookRoutes.js`: REST API endpoints mounted on `/api/neobook`.

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

3. **Future Studio Space (Right)**:
   - Visual reserved cards for future tools:
     - 🎙️ Audio Overview (Deep Dive podcast conversation)
     - 📊 Data Table & Study Guide (Structured entity extraction)
     - 🧠 Interactive Quiz (Instant knowledge checks)
     - 📇 Smart Flashcards (Spaced repetition recall)

4. **Quota & Security**:
   - Max 5 new chats per user/IP per day.
   - Opening existing chats does NOT consume new-chat allowances.
   - Follow-up messages do NOT count as new chats.
   - Independent AI token budget (does NOT modify or consume NeoLens, NeoBoard, or other NeoBranium quotas).
   - Server-observed IP tracking using HMAC-SHA256 hashed IPs and verified Firebase UIDs.
   - Firestore security rules preventing direct client writes and protecting user data.

