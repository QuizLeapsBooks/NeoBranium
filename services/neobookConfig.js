/**
 * services/neobookConfig.js
 *
 * Central configuration for NeoBook MVP.
 * All limits and parameters are configurable via environment variables
 * with sensible, production-ready defaults.
 */

export const NEOBOOK_CONFIG = {
  // Chat limits
  MAX_DAILY_NEW_CHATS: Number(process.env.NEOBOOK_MAX_DAILY_NEW_CHATS) || 5,
  MAX_SOURCES_PER_NOTEBOOK: Number(process.env.NEOBOOK_MAX_SOURCES) || 15,
  MAX_CHATS_PER_NOTEBOOK: Number(process.env.NEOBOOK_MAX_CHATS_PER_NOTEBOOK) || 20,
  
  // Size & token limits
  MAX_SOURCE_SIZE_BYTES: Number(process.env.NEOBOOK_MAX_SOURCE_SIZE_BYTES) || 10 * 1024 * 1024, // 10MB
  MAX_TEXT_SOURCE_CHARS: Number(process.env.NEOBOOK_MAX_TEXT_SOURCE_CHARS) || 200_000, // ~50k words
  MAX_INPUT_TOKENS_PER_REQUEST: Number(process.env.NEOBOOK_MAX_INPUT_TOKENS) || 16_000,
  MAX_OUTPUT_TOKENS: Number(process.env.NEOBOOK_MAX_OUTPUT_TOKENS) || 8_192,
  DAILY_TOKEN_BUDGET: Number(process.env.NEOBOOK_DAILY_TOKEN_BUDGET) || 150_000, // independent daily token budget
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 mins
  MAX_REQUESTS_PER_WINDOW: Number(process.env.NEOBOOK_MAX_REQUESTS_PER_WINDOW) || 60,

  // AI models
  // NeoBook uses its own designated routine text model; completely independent of other tools
  AI_MODEL: process.env.NEOBOOK_AI_MODEL || 'gemini-3.5-flash-lite',
  AI_FALLBACK_MODEL: process.env.NEOBOOK_FALLBACK_MODEL || 'gemini-3.8-flash',
  
  // Cost estimates ($ per 1M tokens) - based on Gemini 3.5 Flash Lite
  COST_PER_MILLION_INPUT_TOKENS: 0.075,
  COST_PER_MILLION_OUTPUT_TOKENS: 0.30,
  
  // Chunking parameters for RAG
  CHUNK_SIZE_CHARS: 800,
  CHUNK_OVERLAP_CHARS: 150,
  TOP_K_CHUNKS: 5,
  
  // Quiz parameters
  ALLOWED_QUIZ_COUNTS: [5, 10, 15, 20],
  ALLOWED_QUIZ_DIFFICULTIES: ['easy', 'medium', 'hard', 'mixed'],
  MAX_QUIZ_CHUNKS: 25,
  QUIZ_AI_TIMEOUT_MS: 45_000,

  // Timeouts
  FETCH_TIMEOUT_MS: 10_000,
  AI_TIMEOUT_MS: 30_000,
  
  // Retention (days)
  USAGE_RETENTION_DAYS: 30
};

