const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Global configuration for V2 Functions
setGlobalOptions({ maxInstances: 10 });

const SOLVE_DOUBT_DAILY_LIMIT = Number.parseInt(process.env.SOLVE_DOUBT_DAILY_LIMIT || "25", 10);
const SOLVE_DOUBT_MAX_QUESTION_CHARS = 5000;
const SOLVE_DOUBT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SOLVE_DOUBT_TIMEOUT_MS = 30_000;

function parseSolveDoubtImage(imageData) {
  if (typeof imageData !== "string" || imageData.length > Math.ceil(SOLVE_DOUBT_MAX_IMAGE_BYTES / 3) * 4 + 64) {
    throw new HttpsError("invalid-argument", "Image is too large.");
  }
  const match = imageData.match(/^(?:data:(image\/(?:jpeg|png|webp));base64,)?([A-Za-z0-9+/]+={0,2})$/i);
  if (!match || match[2].length % 4 !== 0) throw new HttpsError("invalid-argument", "Image must be valid JPEG, PNG, or WebP base64 data.");
  const mediaType = (match[1] || "image/jpeg").toLowerCase();
  const base64 = match[2];
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > SOLVE_DOUBT_MAX_IMAGE_BYTES || bytes.toString("base64") !== base64) {
    throw new HttpsError("invalid-argument", "Image is empty, malformed, or too large.");
  }
  const validSignature = mediaType === "image/jpeg"
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : mediaType === "image/png"
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!validSignature) throw new HttpsError("invalid-argument", "Image content does not match a supported image type.");
  return { mediaType, base64 };
}

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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
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

  const quotaRef = admin.firestore().collection("ai_quotas").doc(request.auth.uid);
  const today = new Date().toISOString().slice(0, 10);
  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(quotaRef);
    const emailQuota = snapshot.exists ? snapshot.data().verificationEmail || {} : {};
    const count = emailQuota.date === today ? Number(emailQuota.count) || 0 : 0;
    if (count >= 3) throw new HttpsError("resource-exhausted", "Verification email limit reached. Try again tomorrow.");
    transaction.set(quotaRef, {
      verificationEmail: { date: today, count: count + 1, lastUsed: admin.firestore.FieldValue.serverTimestamp() }
    }, { merge: true });
  });

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

  const fname = escapeHtml((typeof request.data?.fname === 'string' ? request.data.fname : user.displayName?.split(" ")[0] || "User").slice(0, 80));

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
    const auth = request.auth;
    if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in to use doubt solving.");

    const { question, imageBase64 } = request.data || {};
    if (typeof question !== "string" || !question.trim() || question.length > SOLVE_DOUBT_MAX_QUESTION_CHARS) {
      throw new HttpsError("invalid-argument", `Question must contain 1 to ${SOLVE_DOUBT_MAX_QUESTION_CHARS} characters.`);
    }
    const image = imageBase64 ? parseSolveDoubtImage(imageBase64) : null;
    if (Buffer.byteLength(JSON.stringify({ question, imageBase64: imageBase64 || "" }), "utf8") > 7 * 1024 * 1024) {
      throw new HttpsError("invalid-argument", "Request is too large.");
    }

    const db = admin.firestore();
    const today = new Date().toISOString().slice(0, 10);
    const docRef = db.collection("ai_quotas").doc(auth.uid);

    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(docRef);
      const quota = docSnap.exists ? docSnap.data().solveDoubt || {} : {};
      const count = quota.date === today ? Number(quota.count) || 0 : 0;
      if (count >= SOLVE_DOUBT_DAILY_LIMIT) {
        throw new HttpsError("resource-exhausted", "Daily limit reached");
      }
      transaction.set(docRef, {
        solveDoubt: { date: today, count: count + 1, lastUsed: admin.firestore.FieldValue.serverTimestamp() }
      }, { merge: true });
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("Missing ANTHROPIC_API_KEY environment variable.");
      throw new HttpsError("failed-precondition", "API key not configured on the server.");
    }

    const content = [];

    if (image) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType,
          data: image.base64
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOLVE_DOUBT_TIMEOUT_MS);
    let response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(anthropicPayload),
      signal: controller.signal
      });
    } catch (error) {
      if (error.name === "AbortError") throw new HttpsError("deadline-exceeded", "AI request timed out. Please try again.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error(`Anthropic API request failed with status ${response.status}`);
      throw new HttpsError("internal", "AI provider request failed.");
    }

    const responseData = await response.json();
    if (!responseData.content || responseData.content.length === 0 || responseData.content[0].type !== "text") {
      console.error("Unexpected Anthropic API response format.");
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
    console.error("Error inside solveDoubt function:", error.code || error.name || "unknown");
    throw new HttpsError("internal", "An unexpected error occurred during execution.");
  }
});
