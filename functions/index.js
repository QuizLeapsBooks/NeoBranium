const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Global configuration for V2 Functions
setGlobalOptions({ maxInstances: 10 });

/**
 * HTTPS Callable Cloud Function: solveDoubt
 * Acts as a secure proxy for Anthropic AI API calls with daily rate limits.
 */
exports.solveDoubt = onCall({ cors: true }, async (request) => {
  try {
    // 1. Get the user's UID or request IP
    const auth = request.auth;
    const ip = request.rawRequest.ip || request.rawRequest.headers["x-forwarded-for"] || "unknown_ip";
    
    // Sanitize to make a safe Firestore document ID
    const uidOrIp = auth ? auth.uid : ip;
    const docId = uidOrIp.replace(/\//g, "_");

    // 2. Check and increment Firestore rate limit using a transaction
    const db = admin.firestore();
    const docRef = db.collection("rateLimits").doc(docId);
    const limit = auth ? 25 : 3;

    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(docRef);
      const now = new Date();
      let count = 0;
      let lastReset = null;

      if (docSnap.exists) {
        const data = docSnap.data();
        count = data.count || 0;
        if (data.lastReset) {
          lastReset = typeof data.lastReset.toDate === "function" 
            ? data.lastReset.toDate() 
            : new Date(data.lastReset);
        }
      }

      // Check if the last reset was on a different calendar day (UTC)
      const isSameDay = lastReset &&
                        now.getUTCFullYear() === lastReset.getUTCFullYear() &&
                        now.getUTCMonth() === lastReset.getUTCMonth() &&
                        now.getUTCDate() === lastReset.getUTCDate();

      if (!isSameDay) {
        count = 0;
      }

      if (count >= limit) {
        throw new HttpsError("resource-exhausted", "Daily limit reached");
      }

      const newCount = count + 1;
      const updateData = {
        count: newCount
      };
      
      // Update the reset timestamp if it's a new day or first request
      if (!isSameDay) {
        updateData.lastReset = admin.firestore.FieldValue.serverTimestamp();
      }

      transaction.set(docRef, updateData, { merge: true });
    });

    // 3. Extract and validate user request payload
    const { question, imageBase64 } = request.data || {};
    if (!question || typeof question !== "string") {
      throw new HttpsError("invalid-argument", "The 'question' parameter is required and must be a string.");
    }

    // 4. Retrieve Anthropic API key from environment variables
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("Missing ANTHROPIC_API_KEY environment variable.");
      throw new HttpsError("failed-precondition", "API key not configured on the server.");
    }

    // 5. Construct multimodal content payload for Anthropic Messages API
    const content = [];

    if (imageBase64) {
      let mediaType = "image/jpeg";
      let base64Data = imageBase64;

      if (imageBase64.startsWith("data:")) {
        const matches = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          mediaType = matches[1];
          base64Data = matches[2];
        }
      }

      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Data
        }
      });
    }

    content.push({
      type: "text",
      text: question
    });

    const anthropicPayload = {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: content
        }
      ]
    };

    // 6. Make secure POST request to Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(anthropicPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Anthropic API request failed with status ${response.status}: ${errorText}`);
      throw new HttpsError("internal", `Anthropic API error: ${response.status}`);
    }

    const responseData = await response.json();
    if (!responseData.content || responseData.content.length === 0 || responseData.content[0].type !== "text") {
      console.error("Unexpected Anthropic API response format:", responseData);
      throw new HttpsError("internal", "Invalid response received from Anthropic API.");
    }

    // 7. Return the AI response text
    return {
      text: responseData.content[0].text
    };

  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error("Error inside solveDoubt function:", error);
    throw new HttpsError("internal", error.message || "An unexpected error occurred during execution.");
  }
});
