const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Global configuration for V2 Functions
setGlobalOptions({ maxInstances: 10 });

// ==========================================
// Gmail SMTP Transporter (use App Password)
// Set these via: firebase functions:secrets:set GMAIL_USER
//                firebase functions:secrets:set GMAIL_APP_PASSWORD
// ==========================================
function createTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    throw new HttpsError("failed-precondition", "Email credentials not configured on server.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });
}

/**
 * Cloud Function: sendVerificationEmail
 * Sends a styled HTML verification email via Gmail SMTP.
 * Called from client after createUserWithEmailAndPassword.
 */
exports.sendVerificationEmail = onCall({ cors: true }, async (request) => {
  // Must be authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to request email verification.");
  }

  const user = await admin.auth().getUser(request.auth.uid);

  // Don't resend if already verified
  if (user.emailVerified) {
    return { success: true, message: "Email already verified." };
  }

  // Generate the Firebase verification link
  const actionCodeSettings = {
    url: "https://neobranium.web.app/htmls/verify-email.html",
    handleCodeInApp: false,
  };

  let verificationLink;
  try {
    verificationLink = await admin.auth().generateEmailVerificationLink(user.email, actionCodeSettings);
  } catch (err) {
    console.error("Error generating verification link:", err);
    throw new HttpsError("internal", "Could not generate verification link.");
  }

  const fname = request.data?.fname || user.displayName?.split(" ")[0] || "User";

  const mailOptions = {
    from: `"NeoBranium" <${process.env.GMAIL_USER}>`,
    to: user.email,
    subject: "✅ Verify Your NeoBranium Account",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:16px;border:1px solid rgba(99,102,241,0.3);overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td align="center" style="padding:32px 40px 20px;">
                    <div style="font-size:28px;font-weight:800;color:#a5b4fc;letter-spacing:-0.5px;">Neo<span style="color:#6366f1;">Branium</span></div>
                    <div style="height:2px;background:linear-gradient(90deg,transparent,#6366f1,transparent);margin:12px 0;"></div>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:0 40px 32px;">
                    <p style="color:#e2e8f0;font-size:18px;margin:0 0 8px;">Hi <strong>${fname}</strong> 👋</p>
                    <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 28px;">
                      Welcome to NeoBranium! Please verify your email address to activate your account and start learning.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${verificationLink}"
                             style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;letter-spacing:0.3px;">
                            ✅ Verify My Email
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="color:#64748b;font-size:13px;text-align:center;margin:20px 0 0;">
                      Button not working? <a href="${verificationLink}" style="color:#a5b4fc;word-break:break-all;">${verificationLink}</a>
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:16px 40px;border-top:1px solid rgba(99,102,241,0.2);">
                    <p style="color:#475569;font-size:12px;text-align:center;margin:0;">
                      If you didn't create a NeoBranium account, ignore this email.<br>
                      © 2025 NeoBranium. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${user.email}`);
    return { success: true };
  } catch (err) {
    console.error("Nodemailer send error:", err);
    throw new HttpsError("internal", "Failed to send verification email. Check server credentials.");
  }
});



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
