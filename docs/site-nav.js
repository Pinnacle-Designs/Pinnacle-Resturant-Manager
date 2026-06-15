/**
 * Shared marketing site navigation — single source of truth for all docs pages.
 */
(function () {
  var SECTION_LINKS = [
    { hash: "#top", label: "Live Demo" },
    { hash: "#features", label: "Features" },
    { hash: "#command-center", label: "AI" },
    { hash: "#analytics", label: "Analytics" },
    { hash: "#pricing", label: "Pricing" },
  ];

  function isPitchPage() {
    return /pitch\.html$/i.test(location.pathname);
  }

  function homeBase() {
    return isPitchPage() ? "./index.html" : "";
  }

  function sectionHref(hash) {
    return homeBase() + hash;
  }

  function investorsHref() {
    return "./pitch.html";
  }

  function logoHref() {
    return sectionHref("#top");
  }

  function demoCtaHref() {
    return sectionHref("#top");
  }

  function currentAttr(page) {
    if (page === "pitch" && isPitchPage()) return ' aria-current="page"';
    return "";
  }

  function link(href, label, extra) {
    return '<a href="' + href + '"' + (extra || "") + ">" + label + "</a>";
  }

  function renderNav() {
    var mount = document.getElementById("site-nav");
    if (!mount) return;

    var desktop = SECTION_LINKS.map(function (item) {
      return link(sectionHref(item.hash), item.label);
    }).join("");
    desktop += link(investorsHref(), "Investors", currentAttr("pitch"));

    var mobile = desktop;
    mobile += link("#", "Sign in", ' data-app-link="/login" hidden');
    mobile +=
      '<a href="' +
      demoCtaHref() +
      '" class="btn btn-primary" style="text-align:center">Try live demo</a>';

    mount.innerHTML =
      '<div class="container">' +
      '<div class="nav-inner">' +
      '<a href="' +
      logoHref() +
      '" class="nav-logo-link"><img src="./assets/logo-nav.svg" alt="Pinnacle Restaurant Manager" class="nav-logo" width="200" height="40" /></a>' +
      '<nav class="nav-links" aria-label="Main">' +
      desktop +
      "</nav>" +
      '<div class="nav-actions">' +
      link("#", "Sign in", ' class="btn btn-ghost" data-app-link="/login" hidden') +
      link(demoCtaHref(), "Try live demo", ' class="btn btn-primary"') +
      "</div>" +
      '<button type="button" class="nav-toggle" id="nav-toggle" aria-label="Open menu">☰</button>' +
      "</div>" +
      '<nav class="nav-mobile" id="nav-mobile" aria-label="Mobile">' +
      mobile +
      "</nav>" +
      "</div>";
  }

  renderNav();
})();
