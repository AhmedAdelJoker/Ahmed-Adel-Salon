/**
 * theme-init.js — runs before first paint so the page never flashes the wrong
 * colour scheme.
 *
 * This lives in its own file rather than inline in index.html on purpose:
 * an inline <script> forces `script-src 'unsafe-inline'` in the Content
 * Security Policy, which would also permit any injected inline script. A
 * same-origin file lets the policy stay `script-src 'self'`.
 *
 * The salon's own palette is the default ("system"), so an OS dark preference
 * must not paint the page dark before React resolves it. Only an explicit
 * "dark" choice does that. The remaining palette writes happen in
 * `applyThemeMode()`, which owns every `--c-*` property.
 *
 * Must stay tiny and dependency-free; it is render-blocking by design.
 */
(function () {
  var root = document.documentElement;
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored === "dark" ? "dark" : "light";
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  } catch (error) {
    root.dataset.theme = "light";
    root.style.colorScheme = "light";
  }
})();
