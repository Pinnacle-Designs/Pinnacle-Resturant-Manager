/**
 * Hero full-app iframe embed + expand popup (GitHub Pages).
 */
(function () {
  var cfg = window.PINNACLE_CONFIG || { appUrl: "http://localhost:3000" };
  var base = (cfg.appUrl || "").replace(/\/$/, "");
  var embedPath = "/embed";
  var embedUrl = base ? base + embedPath : "";

  function buildFrame(src, height) {
    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = "Pinnacle Restaurant Manager — Live Demo";
    iframe.className = "hero-app-iframe";
    iframe.setAttribute("loading", "eager");
    if (height) iframe.style.height = height;
    return iframe;
  }

  function initHeroEmbed() {
    var heroSlot = document.getElementById("hero-app-embed");
    var modal = document.getElementById("app-embed-modal");
    var modalBody = document.getElementById("app-embed-modal-body");
    var expandBtn = document.getElementById("hero-embed-expand");
    var closeBtn = document.getElementById("app-embed-close");
    var loader = document.getElementById("hero-embed-loader");

    if (!heroSlot) return;

    if (!embedUrl) {
      heroSlot.innerHTML =
        '<div class="hero-embed-error">Set <code>appUrl</code> in <code>config.js</code> to your running Pinnacle app.</div>';
      if (expandBtn) expandBtn.style.display = "none";
      return;
    }

    var inlineFrame = buildFrame(embedUrl, "min(520px, 70vh)");
    heroSlot.appendChild(inlineFrame);

    inlineFrame.addEventListener("load", function () {
      if (loader) loader.classList.add("hidden");
    });

    var modalFrame = null;

    function openModal() {
      if (!modal || !modalBody) return;
      modal.classList.add("open");
      document.body.classList.add("modal-open");
      if (!modalFrame) {
        modalFrame = buildFrame(embedUrl, "100%");
        modalFrame.style.flex = "1";
        modalFrame.style.minHeight = "0";
        modalBody.appendChild(modalFrame);
      }
    }

    function closeModal() {
      if (!modal) return;
      modal.classList.remove("open");
      document.body.classList.remove("modal-open");
    }

    if (expandBtn) expandBtn.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  }

  function wireAppLinks() {
    document.querySelectorAll("[data-app-link]").forEach(function (el) {
      var path = el.getAttribute("data-app-link") || "/";
      if (embedUrl) {
        el.setAttribute("href", base + path);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      } else {
        el.setAttribute("href", "#");
        el.addEventListener("click", function (e) {
          e.preventDefault();
          alert("Set appUrl in docs/config.js to your deployed Pinnacle app URL.");
        });
      }
    });
  }

  function initNav() {
    var toggle = document.getElementById("nav-toggle");
    var mobile = document.getElementById("nav-mobile");
    if (toggle && mobile) {
      toggle.addEventListener("click", function () {
        mobile.classList.toggle("open");
      });
      mobile.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () {
          mobile.classList.remove("open");
        });
      });
    }
  }

  function init() {
    initHeroEmbed();
    wireAppLinks();
    initNav();
    var year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
