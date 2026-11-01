/**
 * guest-value-banner.js
 * Shows guest users a compelling "what you're missing" banner
 * that makes the value of creating an account tangible.
 *
 * - Injects into dashboard for guest users only.
 * - Uses real feature list (no fabricated numbers).
 * - Does NOT fire for signed-in users.
 * - Dismissible per session.
 */

(function () {
  "use strict";

  const DISMISSED_KEY = "nb_guest_banner_dismissed";

  function isGuestUser() {
    // Matches the isGuestUser() logic in auth.js:
    // guest mode is active when sessionStorage has 'isGuestMode' = 'true'
    // and no Firebase user is currently signed in (checked via auth state events)
    try { return sessionStorage.getItem("isGuestMode") === "true"; } catch { return false; }
  }

  function alreadyDismissed() {
    try { return sessionStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
  }

  function dismiss() {
    try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch {}
    const banner = document.getElementById("nbGuestValueBanner");
    if (banner) {
      banner.style.transition = "opacity 0.3s, transform 0.3s";
      banner.style.opacity = "0";
      banner.style.transform = "translateY(-8px)";
      setTimeout(() => banner.remove(), 350);
    }
  }

  const FEATURES = [
    { icon: "bi-fire", label: "Study Streak tracking across devices" },
    { icon: "bi-graph-up-arrow", label: "Personalised weak-topic detection" },
    { icon: "bi-map-fill", label: "Study Roadmap with target dates" },
    { icon: "bi-bookmark-star-fill", label: "Revision Library for saved questions" },
    { icon: "bi-robot", label: "AI Study Assistant (NeoBot)" },
    { icon: "bi-trophy-fill", label: "Achievements & learning milestones" },
    { icon: "bi-bar-chart-line-fill", label: "Performance analytics by subject" },
    { icon: "bi-person-fill-gear", label: "Personal Learning Workspace" }
  ];

  function injectBanner() {
    if (!isGuestUser() || alreadyDismissed()) return;
    if (document.getElementById("nbGuestValueBanner")) return;

    const featureItems = FEATURES.map(f =>
      `<li class="nb-gv-feature"><i class="bi ${f.icon}"></i><span>${f.label}</span></li>`
    ).join("");

    const banner = document.createElement("div");
    banner.id = "nbGuestValueBanner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Sign in benefits");
    banner.innerHTML = `
      <div class="nb-gv-inner">
        <button class="nb-gv-close" id="nbGvClose" aria-label="Dismiss banner" title="Dismiss">
          <i class="bi bi-x-lg"></i>
        </button>
        <div class="nb-gv-head">
          <div class="nb-gv-lock-icon" aria-hidden="true">
            <i class="bi bi-lock-fill"></i>
          </div>
          <div class="nb-gv-head-text">
            <h3 class="nb-gv-title">You're in Guest Mode</h3>
            <p class="nb-gv-sub">Create a free account to unlock your personal learning ecosystem:</p>
          </div>
        </div>
        <ul class="nb-gv-features">${featureItems}</ul>
        <div class="nb-gv-actions">
          <a href="/htmls/sign.html" class="nb-gv-cta" id="nbGvCta">
            <i class="bi bi-person-plus-fill"></i> Create Free Account
          </a>
          <a href="/htmls/sign.html#signin" class="nb-gv-secondary">Already have an account? Sign in</a>
        </div>
      </div>
      <style>
        #nbGuestValueBanner{
          position:relative;
          background:linear-gradient(135deg,rgba(30,27,75,.96),rgba(45,27,105,.95));
          border:1px solid rgba(167,139,250,.25);
          border-radius:16px;
          padding:1.5rem;
          margin:0 0 1.5rem;
          box-shadow:0 8px 32px rgba(0,0,0,.3);
          animation:nbGvSlideIn .35s cubic-bezier(.4,0,.2,1)
        }
        @keyframes nbGvSlideIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        .nb-gv-close{
          position:absolute;top:.75rem;right:.75rem;
          background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);
          border-radius:7px;width:30px;height:30px;
          display:flex;align-items:center;justify-content:center;
          color:rgba(255,255,255,.55);cursor:pointer;font-size:.8rem;
          transition:all .2s
        }
        .nb-gv-close:hover{background:rgba(255,255,255,.15);color:#fff}
        .nb-gv-inner{max-width:900px}
        .nb-gv-head{display:flex;align-items:center;gap:1rem;margin-bottom:1.1rem}
        .nb-gv-lock-icon{
          width:44px;height:44px;border-radius:12px;flex-shrink:0;
          background:linear-gradient(135deg,rgba(124,58,237,.4),rgba(167,139,250,.3));
          border:1px solid rgba(124,58,237,.35);
          display:flex;align-items:center;justify-content:center;
          font-size:1.2rem;color:#a78bfa
        }
        .nb-gv-title{font-size:1.05rem;font-weight:800;color:#fff;margin:0 0 .15rem}
        .nb-gv-sub{font-size:.82rem;color:rgba(255,255,255,.65);margin:0}
        .nb-gv-features{
          list-style:none;padding:0;margin:0 0 1.25rem;
          display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.4rem .75rem
        }
        .nb-gv-feature{
          display:flex;align-items:center;gap:.5rem;
          font-size:.8rem;color:rgba(255,255,255,.75);padding:.25rem 0
        }
        .nb-gv-feature i{color:#a78bfa;font-size:.85rem;flex-shrink:0}
        .nb-gv-actions{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
        .nb-gv-cta{
          display:inline-flex;align-items:center;gap:.4rem;
          padding:.6rem 1.5rem;border-radius:9px;
          background:linear-gradient(135deg,#7c3aed,#9333ea);
          color:#fff;font-weight:700;font-size:.9rem;text-decoration:none;
          box-shadow:0 4px 14px rgba(109,40,217,.45);
          transition:opacity .2s,transform .2s
        }
        .nb-gv-cta:hover{opacity:.9;transform:translateY(-1px)}
        .nb-gv-secondary{font-size:.78rem;color:rgba(255,255,255,.55);text-decoration:none}
        .nb-gv-secondary:hover{color:rgba(255,255,255,.8);text-decoration:underline}
        @media(max-width:600px){
          .nb-gv-features{grid-template-columns:1fr 1fr}
          .nb-gv-actions{flex-direction:column;align-items:flex-start}
        }
      </style>`;

    // Inject at the top of <main>
    const main = document.querySelector("main");
    if (main) {
      main.insertBefore(banner, main.firstChild);
    }

    document.getElementById("nbGvClose")?.addEventListener("click", dismiss);
  }

  // Run after auth state is determined
  // If userLoaded fires, the user is signed in — skip banner
  document.addEventListener("userLoaded", () => {
    const banner = document.getElementById("nbGuestValueBanner");
    if (banner) banner.remove();
  });

  // On DOMContentLoaded, assume guest until proven otherwise
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(injectBanner, 800));
  } else {
    setTimeout(injectBanner, 800);
  }
})();
