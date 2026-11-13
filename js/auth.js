import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInAnonymously, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { getFirestore, getDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";
import { syncProfilePhoto } from "/js/profile-photo-cache.js";
import {
    createAiQuotaApiClient,
    resolveUsageApiBase
} from "/js/ai-usage-dashboard-model.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA1iWJdGtmrox9RAHgWBxaK4p8KGf7ji_Y",
    authDomain: "neobranium.firebaseapp.com",
    projectId: "neobranium",
    storageBucket: "neobranium.appspot.com",
    messagingSenderId: "59188872045",
    appId: "1:59188872045:web:450a70b28e4be5db335064",
    databaseURL: "https://neobranium-default-rtdb.firebaseio.com"
};

// Initialize Firebase (Singleton pattern)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);

export { app, auth, db, storage, rtdb, firebaseConfig, onAuthStateChanged, signOut };

export function getEmailVerificationSettings() {
    return {
        url: new URL("/htmls/verify-email.html", window.location.origin).toString(),
        handleCodeInApp: false
    };
}

export async function loadUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : { username: user.displayName || "User", fname: "", lname: "", bio: "", notificationPref: "all" };
        const photo = userData.profilePhotoUrl || userData.photoURL || user.photoURL || "";
        return { ...userData, email: user.email, photoURL: photo, profilePhotoUrl: photo };
    } catch (error) {
        console.error("Error loading user data:", error);
        const fallbackPhoto = user?.photoURL || "";
        return { username: user?.displayName || "User", fname: "", lname: "", bio: "", notificationPref: "all", email: user?.email, photoURL: fallbackPhoto, profilePhotoUrl: fallbackPhoto };
    }
}

export function isGuestUser() {
    if (auth.currentUser) return auth.currentUser.isAnonymous === true;
    
    // UI flag: User must have explicitly opted into guest mode for this tab session
    return sessionStorage.getItem('isGuestMode') === 'true';
}

export async function checkAccess(requiredAuth = false) {
    if (!requiredAuth) return true;
    // Wait for Firebase to resolve auth state before deciding
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) { resolve(true); return; }
            if (isGuestUser()) {
                console.info("Guest access restriction: Redirecting to sign-in.");
                window.location.href = "/htmls/sign.html";
                resolve(false);
                return;
            }
            // Fully logged-out — redirect to landing
            window.location.replace("/index.html");
            resolve(false);
        });
    });
}

function injectGuestBanner() {
    if (!document.getElementById("guest-banner")) {
        const banner = document.createElement("div");
        banner.id = "guest-banner";
        banner.innerHTML = "You're in guest mode. <a href='/htmls/sign.html' style='color: #a5b4fc; text-decoration: underline; font-weight: bold; margin-left: 5px; transition: color 0.3s ease;'>Sign in</a> to unlock all features.";
        
        banner.style.position = "fixed";
        banner.style.top = "15px";
        banner.style.left = "50%";
        banner.style.transform = "translateX(-50%)";
        banner.style.background = "rgba(15, 23, 42, 0.7)";
        banner.style.backdropFilter = "blur(12px)";
        banner.style.webkitBackdropFilter = "blur(12px)";
        banner.style.border = "1px solid rgba(99, 102, 241, 0.3)";
        banner.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.2)";
        banner.style.color = "#e2e8f0";
        banner.style.padding = "8px 24px";
        banner.style.borderRadius = "20px";
        banner.style.fontSize = "0.95rem";
        banner.style.zIndex = "9999";
        banner.style.display = "flex";
        banner.style.alignItems = "center";
        banner.style.justifyContent = "center";
        banner.style.animation = "fadeInDown 0.5s ease-out";
        
        if (!document.getElementById("guest-banner-styles")) {
            const style = document.createElement("style");
            style.id = "guest-banner-styles";
            style.innerHTML = `
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translate(-50%, -20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
                #guest-banner a:hover { color: #818cf8 !important; }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(banner);
    }
}

export function updateUserDisplay(userData, user) {
    const usernameDisplay = document.getElementById("usernameDisplay");
    const initialAvatar = document.getElementById("initialAvatar");
    const userInitial = document.getElementById("userInitial");
    const userDropdown = document.getElementById("userDropdown");
    const userBioText = document.getElementById("userBioText");

    const username = userData?.username || user?.displayName || "User";
    const firstLetter = username.charAt(0).toUpperCase();

    if (usernameDisplay) {
        usernameDisplay.textContent = `Welcome, ${username}!`;
    }

    const applyAvatar = (displayUrl) => {
        if (initialAvatar) {
            if (displayUrl) {
                initialAvatar.style.backgroundImage = `url("${displayUrl}")`;
                initialAvatar.style.backgroundSize = "cover";
                initialAvatar.style.backgroundPosition = "center";
                initialAvatar.textContent = "";
            } else {
                initialAvatar.style.backgroundImage = "";
                initialAvatar.textContent = firstLetter;
            }
        }
        if (userDropdown && userInitial) {
            if (displayUrl) {
                userDropdown.style.backgroundImage = `url("${displayUrl}")`;
                userDropdown.style.backgroundSize = "cover";
                userDropdown.style.backgroundPosition = "center";
                userInitial.style.visibility = "hidden";
            } else {
                userDropdown.style.backgroundImage = "";
                userInitial.style.visibility = "visible";
                userInitial.textContent = firstLetter;
            }
        } else if (userInitial) {
            userInitial.textContent = firstLetter;
        }
    };

    const remoteUrl = userData?.profilePhotoUrl || userData?.photoURL || user?.photoURL || null;
    const userId = user?.uid;

    if (userId) {
        syncProfilePhoto(userId, remoteUrl, (displayUrl) => {
            applyAvatar(displayUrl);
        });
    } else {
        applyAvatar(remoteUrl);
    }

    if (userBioText) {
        userBioText.textContent = userData?.bio || "--Your Bio--";
    }
}

let quotaWarningCheckKey = null;
let quotaApiClient = null;
const quotaStatusRequests = new Map();
let quotaRefreshTimer = null;
let quotaMidnightTimer = null;

function getQuotaApiClient() {
    if (quotaApiClient) return quotaApiClient;
    const apiBase = resolveUsageApiBase(
        window.location.href,
        document.querySelector('meta[name="backend-url"]')?.content || "https://neobranium.onrender.com"
    );
    quotaApiClient = createAiQuotaApiClient({ apiBase });
    return quotaApiClient;
}

function scheduleQuotaMidnightRefresh(user) {
    window.clearTimeout(quotaMidnightTimer);
    const now = new Date();
    const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    quotaMidnightTimer = window.setTimeout(() => {
        quotaWarningCheckKey = null;
        void checkAiQuotaWarning(user, true);
        scheduleQuotaMidnightRefresh(user);
    }, Math.min(nextMidnight - Date.now() + 250, 2_147_000_000));
}

function scheduleQuotaRefresh(user) {
    if (!user) return;
    window.clearTimeout(quotaRefreshTimer);
    quotaRefreshTimer = window.setTimeout(() => {
        quotaWarningCheckKey = null;
        void checkAiQuotaWarning(user, true);
    }, 1_500);
}

function ensureAiQuotaOverviewStyles() {
    if (document.getElementById("ai-quota-overview-styles")) return;
    const style = document.createElement("style");
    style.id = "ai-quota-overview-styles";
    style.textContent = `
        .ai-quota-overview{margin:0 0 18px;padding:18px 20px;color:var(--aiu-text,#202a38);background:var(--aiu-surface,#fff);border:1px solid var(--aiu-border,rgba(60,75,95,.16));border-radius:12px}
        .ai-quota-overview h2{margin:0;font-size:16px;font-weight:700}
        .ai-quota-overview p{margin:6px 0 0;color:var(--aiu-muted,#667085);font-size:12px;line-height:1.5}
        .ai-quota-overview__top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
        .ai-quota-overview__total{font-size:13px;font-weight:700;white-space:nowrap}
        .ai-quota-overview__track{height:9px;margin-top:15px;overflow:hidden;background:rgba(127,140,160,.2);border-radius:999px}
        .ai-quota-overview__fill{height:100%;background:var(--aiu-accent,#3975d5);border-radius:inherit;transition:width .25s ease}
        .ai-quota-overview__stats{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:11px}
        .ai-quota-overview__stats span{color:var(--aiu-muted,#667085);font-size:12px}
        .ai-quota-overview__stats strong{color:var(--aiu-text,#202a38);font-variant-numeric:tabular-nums}
        .ai-quota-overview__error{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .ai-quota-overview__error button{padding:7px 10px;color:inherit;background:transparent;border:1px solid currentColor;border-radius:7px;cursor:pointer}
        .ai-quota-overview__guest{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:12px}
        .ai-quota-overview__guest div{padding:10px;background:rgba(127,140,160,.1);border-radius:8px}
        .ai-quota-overview__guest strong,.ai-quota-overview__guest span{display:block}
        .ai-quota-overview__guest span{margin-top:4px;color:var(--aiu-muted,#667085);font-size:12px}
        @media(max-width:520px){.ai-quota-overview{padding:15px}.ai-quota-overview__top{display:block}.ai-quota-overview__total{display:block;margin-top:8px}}
    `;
    document.head.appendChild(style);
}

function appendQuotaStat(stats, value, label) {
    const item = document.createElement("span");
    const amount = document.createElement("strong");
    amount.textContent = value.toLocaleString();
    item.append(amount, document.createTextNode(` ${label}`));
    stats.append(item);
}

function renderAiQuotaOverview(quota) {
    const containers = document.querySelectorAll("[data-ai-quota-overview]");
    if (!containers.length) return;
    ensureAiQuotaOverviewStyles();

    for (const container of containers) {
        const card = document.createElement("section");
        card.className = "ai-quota-overview";
        card.setAttribute("aria-label", "Shared AI usage budget");
        const top = document.createElement("div");
        top.className = "ai-quota-overview__top";
        const heading = document.createElement("h2");
        heading.textContent = "Shared AI budget";
        top.append(heading);

        if (quota.scope === "signed_in") {
            const limit = Number(quota.limit);
            const used = Number(quota.usedTokens);
            const remaining = Number(quota.remainingTokens);
            const reserved = Number(quota.reservedTokens) || 0;
            if (![limit, used, remaining].every(Number.isFinite) || limit <= 0) {
                throw new Error("Quota API returned invalid token totals.");
            }
            const allocated = Math.max(0, used + reserved);
            const percent = Math.max(0, allocated / limit * 100);
            const total = document.createElement("strong");
            total.className = "ai-quota-overview__total";
            total.textContent = `${allocated.toLocaleString()} / ${limit.toLocaleString()} tokens used or reserved (${percent.toFixed(1)}%)`;
            top.append(total);

            const progress = document.createElement("div");
            progress.className = "ai-quota-overview__track";
            progress.setAttribute("role", "progressbar");
            progress.setAttribute("aria-label", "Daily shared AI budget used or reserved");
            progress.setAttribute("aria-valuemin", "0");
            progress.setAttribute("aria-valuemax", "100");
            progress.setAttribute("aria-valuenow", Math.min(100, percent).toFixed(1));
            const fill = document.createElement("div");
            fill.className = "ai-quota-overview__fill";
            fill.style.width = `${Math.min(100, percent)}%`;
            progress.append(fill);

            const stats = document.createElement("div");
            stats.className = "ai-quota-overview__stats";
            appendQuotaStat(stats, used, "settled tokens (reported or estimated)");
            appendQuotaStat(stats, Number(quota.providerTokens) || 0, "provider-reported");
            appendQuotaStat(stats, Number(quota.estimatedTokens) || 0, "estimated");
            appendQuotaStat(stats, reserved, "reserved for active requests");
            appendQuotaStat(stats, remaining, "tokens remaining");

            const note = document.createElement("p");
            note.textContent = `Resets ${new Date(quota.resetAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
                timeZoneName: "short"
            })}. Some providers do not return exact token counts; estimates are included.`;
            card.append(top, progress, stats, note);
        } else {
            const note = document.createElement("p");
            note.textContent = "Guest allowances are shared by feature and reset daily or weekly.";
            const guest = document.createElement("div");
            guest.className = "ai-quota-overview__guest";
            for (const [label, entry, unit, usedField] of [
                ["Chatbot", quota.dailyChat, "chats today", "used"],
                ["Other AI", quota.weeklyOtherAi, "uses this week", "used"],
                ["NeoBot voice", quota.weeklyNeoBot, "estimated tokens this week", "usedTokens"]
            ]) {
                if (!entry) continue;
                const item = document.createElement("div");
                const title = document.createElement("strong");
                title.textContent = label;
                const detail = document.createElement("span");
                detail.textContent = `${Number(entry[usedField]).toLocaleString()} / ${Number(entry.limit).toLocaleString()} ${unit}`;
                item.append(title, detail);
                guest.append(item);
            }
            card.append(top, note, guest);
        }
        container.replaceChildren(card);
    }
}

function renderAiQuotaOverviewError(user, error) {
    for (const container of document.querySelectorAll("[data-ai-quota-overview]")) {
        ensureAiQuotaOverviewStyles();
        const card = document.createElement("section");
        card.className = "ai-quota-overview ai-quota-overview__error";
        card.setAttribute("aria-label", "Shared AI usage budget");
        const message = document.createElement("p");
        message.textContent = error?.message || "Could not load your current AI budget.";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = "Retry";
        retry.addEventListener("click", () => {
            quotaWarningCheckKey = null;
            void checkAiQuotaWarning(user);
        }, { once: true });
        card.append(message, retry);
        container.replaceChildren(card);
    }
}

function injectAiQuotaWarning(message, dismissKey) {
    if (sessionStorage.getItem(dismissKey) === "true") return;
    document.getElementById("ai-quota-warning")?.remove();
    let style = document.getElementById("ai-quota-warning-styles");
    if (!style) {
        style = document.createElement("style");
        style.id = "ai-quota-warning-styles";
        style.textContent = `
            .ai-quota-warning{position:fixed;z-index:10020;top:18px;left:50%;transform:translateX(-50%);width:min(560px,calc(100vw - 28px));display:flex;align-items:flex-start;gap:14px;padding:14px 16px;border:1px solid #f59e0b;border-radius:14px;background:#1f2937;color:#f9fafb;box-shadow:0 12px 36px #0005;font:500 14px/1.45 system-ui,sans-serif}
            .ai-quota-warning p{margin:0;flex:1}.ai-quota-warning a{color:#fde68a;font-weight:700;white-space:nowrap}.ai-quota-warning button{border:0;background:transparent;color:inherit;font-size:20px;line-height:1;cursor:pointer;padding:0 2px}
            @media(prefers-reduced-motion:no-preference){.ai-quota-warning{animation:aiQuotaIn .2s ease-out}@keyframes aiQuotaIn{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}}
        `;
        document.head.appendChild(style);
    }
    const alert = document.createElement("div");
    alert.id = "ai-quota-warning";
    alert.className = "ai-quota-warning";
    alert.setAttribute("role", "status");
    const text = document.createElement("p");
    text.textContent = message;
    const usageLink = document.createElement("a");
    usageLink.href = "/htmls/ai-usage.html";
    usageLink.textContent = "View usage";
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss AI usage warning");
    close.textContent = "×";
    const dismiss = () => {
        sessionStorage.setItem(dismissKey, "true");
        alert.remove();
    };
    close.addEventListener("click", dismiss);
    alert.append(text, usageLink, close);
    document.body.appendChild(alert);
    window.setTimeout(() => alert.remove(), 7_000);
}

async function checkAiQuotaWarning(user, force = false) {
    if (!user || (!force && quotaWarningCheckKey === user.uid)) return;
    if (quotaStatusRequests.has(user.uid)) return quotaStatusRequests.get(user.uid);
    quotaWarningCheckKey = user.uid;
    const request = (async () => {
        try {
            const quota = await getQuotaApiClient().fetchStatus(user);
            if (auth.currentUser?.uid !== user.uid) return;
            renderAiQuotaOverview(quota);
            const dismissKey = `aiQuotaWarningDismissed:${user.uid}:${new Date().toISOString().slice(0, 10)}:${window.location.pathname}`;
            if (quota.scope === "signed_in") {
                const remaining = Number(quota.remainingTokens);
                const limit = Number(quota.limit);
                if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0 || remaining / limit > 0.25) return;
                const used = Number(quota.usedTokens) || 0;
                const provider = Number(quota.providerTokens) || 0;
                const estimated = Number(quota.estimatedTokens) || 0;
                const detail = provider || estimated
                    ? ` Provider-reported: ${provider.toLocaleString()}; estimated: ${estimated.toLocaleString()}.`
                    : "";
                injectAiQuotaWarning(
                    remaining <= 0
                        ? `Your shared daily AI budget is exhausted (${used.toLocaleString()} of ${limit.toLocaleString()} tokens used). It resets at UTC midnight.${detail}`
                        : `AI usage is getting low: ${remaining.toLocaleString()} of ${limit.toLocaleString()} shared daily tokens remain.${detail}`,
                    dismissKey
                );
                return;
            }
            if (quota.scope !== "guest_ip") return;
            const live = quota.weeklyNeoBot;
            if (live && live.remainingTokens / live.limit <= 0.25) {
                injectAiQuotaWarning(
                    `Guest NeoBot voice allowance is low: ${live.remainingTokens.toLocaleString()} estimated token-equivalents remain this week.`,
                    dismissKey
                );
                return;
            }
            const chat = quota.dailyChat;
            if (chat && chat.remaining / chat.limit <= 0.25) {
                injectAiQuotaWarning(
                    `Guest chatbot allowance is low: ${chat.remaining} of ${chat.limit} daily chats remain.`,
                    dismissKey
                );
                return;
            }
            const other = quota.weeklyOtherAi;
            if (other && other.remaining / other.limit <= 0.25) {
                injectAiQuotaWarning(
                    `Guest AI allowance is low: ${other.remaining} of ${other.limit} weekly uses remain.`,
                    dismissKey
                );
            }
        } catch (error) {
            quotaWarningCheckKey = null;
            renderAiQuotaOverviewError(user, error);
            console.warn("[AI Quota] Could not check usage warning status.", error?.message || "unknown error");
        } finally {
            quotaStatusRequests.delete(user.uid);
        }
    })();
    quotaStatusRequests.set(user.uid, request);
    return request;
}

function observeAiQuotaResponses() {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
        const response = await nativeFetch(...args);
        const readNumberHeader = name => {
            const value = response.headers.get(name);
            return value === null ? Number.NaN : Number(value);
        };
        const tokenLimit = readNumberHeader("X-AI-Token-Limit");
        const tokenRemaining = readNumberHeader("X-AI-Token-Remaining");
        const guestLimit = readNumberHeader("X-AI-Quota-Limit");
        const guestRemaining = readNumberHeader("X-AI-Quota-Remaining");
        const scope = response.headers.get("X-AI-Quota-Scope");
        const hasQuotaHeaders = [tokenLimit, tokenRemaining, guestLimit, guestRemaining].some(Number.isFinite);
        if (hasQuotaHeaders) {
            scheduleQuotaRefresh(auth.currentUser);
            const userId = auth.currentUser?.uid || "guest";
            const dismissKey = `aiQuotaWarningDismissed:${userId}:${new Date().toISOString().slice(0, 10)}:${window.location.pathname}`;
            if (Number.isFinite(tokenLimit) && tokenLimit > 0 && Number.isFinite(tokenRemaining)) {
                if (tokenRemaining / tokenLimit <= 0.25) {
                    injectAiQuotaWarning(
                        tokenRemaining <= 0
                            ? `Your shared daily AI budget is exhausted. It resets at UTC midnight.`
                            : `AI usage is getting low: ${tokenRemaining.toLocaleString()} of ${tokenLimit.toLocaleString()} shared daily tokens remain.`,
                        dismissKey
                    );
                }
            } else if (
                scope &&
                Number.isFinite(guestLimit) &&
                guestLimit > 0 &&
                Number.isFinite(guestRemaining) &&
                guestRemaining / guestLimit <= 0.25
            ) {
                const unit = scope === "guest_chat" ? "daily chats" : "weekly AI uses";
                injectAiQuotaWarning(
                    guestRemaining <= 0
                        ? `Your guest ${unit} allowance is exhausted. Sign in for the full AI allowance.`
                        : `Guest AI allowance is low: ${guestRemaining} of ${guestLimit} ${unit} remain.`,
                    dismissKey
                );
            }
        } else if (response.status === 429) {
            void response.clone().json().then(body => {
                if (!["DAILY_TOKEN_BUDGET_EXCEEDED", "GUEST_CHAT_DAILY_LIMIT", "GUEST_OTHER_AI_WEEKLY_LIMIT"].includes(body?.code)) return;
                scheduleQuotaRefresh(auth.currentUser);
                const userId = auth.currentUser?.uid || "guest";
                const dismissKey = `aiQuotaWarningDismissed:${userId}:${new Date().toISOString().slice(0, 10)}:${window.location.pathname}`;
                const message = body.code === "DAILY_TOKEN_BUDGET_EXCEEDED"
                    ? "This request exceeds your remaining shared daily AI budget. It resets at UTC midnight."
                    : "Your guest AI allowance is exhausted. Sign in for the full AI allowance.";
                injectAiQuotaWarning(message, dismissKey);
            }).catch(() => {});
        }
        return response;
    };
}

document.addEventListener("DOMContentLoaded", () => {
    observeAiQuotaResponses();
    // Single source of truth for Auth State
    onAuthStateChanged(auth, async (user) => {
        const path = window.location.pathname;
        const isNeoApp = path.includes("/NeoBook") || path.includes("/NeoBot") || path.endsWith("/ai-usage.html");
        const isLandingPage = (path === "/" || path === "/index.html") && !isNeoApp;
        const isAuthPage = path.includes("sign.html") || path.includes("verify-email.html");
        const isEntryPage = isLandingPage || isAuthPage;
        if (user) {
            scheduleQuotaMidnightRefresh(user);
        } else {
            window.clearTimeout(quotaMidnightTimer);
            window.clearTimeout(quotaRefreshTimer);
            quotaWarningCheckKey = null;
        }

        if (user?.isAnonymous) {
            sessionStorage.setItem('isGuestMode', 'true');
            const accountOnlyPath = path.includes("/NeoBook") || path.startsWith("/NeoBoard/");
            if (accountOnlyPath) {
                window.location.replace("/htmls/sign.html");
                return;
            }
            if (isEntryPage) {
                window.location.replace("/htmls/dashboard.html");
                return;
            }
            injectGuestBanner();
            updateUserDisplay({ username: "Guest", bio: "Browsing as Guest" }, { displayName: "Guest" });
            document.dispatchEvent(new CustomEvent("userLoaded", {
                detail: { user, userData: { username: "Guest", bio: "Browsing as Guest" } }
            }));
            void checkAiQuotaWarning(user);
            document.body.style.opacity = "1";
            return;
        }

        if (user) {
            // --- LOGGED IN ---
            sessionStorage.removeItem('isGuestMode'); // Clear guest mode if logged in

            // Redirect if on landing/auth pages
            if (isEntryPage) {
                // If they need verification, don't auto-redirect to dashboard yet
                if (!user.emailVerified && !user.providerData.some(p => p.providerId === 'google.com')) {
                    // Let the signup handler finish sending the verification email.
                    const signupInProgress = sessionStorage.getItem("emailSignupInProgress") === "true";
                    if (!path.includes("verify-email.html") && !signupInProgress) {
                        window.location.replace("/htmls/verify-email.html");
                    }
                    return;
                }
                window.location.replace("/htmls/dashboard.html");
                return;
            }

            // Normal page load for authenticated routes
            const userData = await loadUserData(user);
            updateUserDisplay(userData, user);
            document.dispatchEvent(new CustomEvent("userLoaded", { detail: { user, userData } }));
            void checkAiQuotaWarning(user);
            document.body.style.opacity = "1";
        } else {
            // --- NOT LOGGED IN ---
            
            // Auto-enable guest mode if coming from landing page
            const referrer = document.referrer;
            const isFromLanding = referrer && (referrer.includes("index.html") || referrer === window.location.origin + "/");
            
            if (isFromLanding && !isEntryPage && sessionStorage.getItem('isGuestMode') !== 'true') {
                sessionStorage.setItem('isGuestMode', 'true');
            }

            if (isGuestUser()) {
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Could not establish server-verifiable guest access:", error);
                    sessionStorage.removeItem("isGuestMode");
                    window.location.replace("/htmls/sign.html");
                }
                return;
            }

            if (path.includes("/NeoBook") || path.startsWith("/NeoBoard/")) {
                window.location.replace("/htmls/sign.html");
                return;
            }

            if (isGuestUser()) {
                if (isEntryPage) {
                    // Let the user stay on the entry page (e.g. sign.html) so they can actually log in
                    document.body.style.opacity = "1";
                    return;
                }
                injectGuestBanner();
                updateUserDisplay({ username: "Guest", bio: "Browsing as Guest" }, { displayName: "Guest" });
                document.body.style.opacity = "1";
                return;
            }

            // Only allow entry pages or standalone public apps (e.g., NeoBook, NeoBot)
            if (path.includes("/NeoBook") || path.startsWith("/NeoBoard/")) {
                window.location.replace("/htmls/sign.html");
            } else if (!isEntryPage && !isNeoApp) {
                window.location.replace("/index.html");
            } else {
                document.body.style.opacity = "1";
            }
        }
    });

    import("./activity.js").catch((error) => console.error("Activity integration failed:", error));

    const logout = document.getElementById("logout");
    if (logout) {
        logout.addEventListener("click", async () => {
            try {
                if (!auth.currentUser && isGuestUser()) {
                    sessionStorage.removeItem('isGuestMode');
                    window.location.href = "/index.html";
                    return;
                }
                await signOut(auth);
                sessionStorage.removeItem('isGuestMode');
                window.location.href = "/index.html";
            } catch (error) {
                console.error("Logout Error:", error);
                showStatus("Failed to logout: " + error.message, true);
            }
        });
    }
});

export async function updateUserProfile(user, field, value) {
    try {
        await setDoc(doc(db, "users", user.uid), { [field]: value }, { merge: true });
        if (field === "username") {
            await updateProfile(user, { displayName: value });
        }
        return true;
    } catch (error) {
        console.error(`Error updating ${field}:`, error);
        throw error;
    }
}

export async function changeUserPassword(user, currentPassword, newPassword) {
    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        return true;
    } catch (error) {
        console.error("Error changing password:", error);
        throw error;
    }
}

export function showStatus(msg, isError = false) {
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
        statusDiv.textContent = msg;
        statusDiv.className = `status text-sm text-center ${isError ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`;
        statusDiv.style.opacity = "1";
        setTimeout(() => (statusDiv.style.opacity = "0"), 3000);
        setTimeout(() => (statusDiv.textContent = ""), 3300);
    } else {
        console.warn("Status div not found!");
    }
}

// Removed semi-intrusive full-screen request on page load