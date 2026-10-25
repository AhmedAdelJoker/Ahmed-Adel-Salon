/**
 * locale-init.js — runs before first paint so the page never flashes the
 * wrong text direction.
 *
 * ## Why this is needed
 *
 * The document ships with `lang="ar" dir="rtl"`, because Arabic is the
 * product's primary language and the server has no way to know the
 * visitor's stored preference.
 *
 * `I18nContext` sets `lang` and `dir` from the active locale, but it does so
 * in an effect — after React has mounted. An English visitor would therefore
 * get one frame of a right-to-left page: the columns laid out mirrored, the
 * navigation reversed, and the copy in the wrong order within the frame.
 *
 * This reads the same stored locale the provider reads and applies it to the
 * document element before anything is painted, so the first frame is already
 * the right way round.
 *
 * ## Why it is its own file
 *
 * An inline `<script>` forces `script-src 'unsafe-inline'` in the Content
 * Security Policy, which would also permit any injected inline script. A
 * same-origin file lets the policy stay `script-src 'self'` — the same reason
 * `theme-init.js` is a file rather than a block of inline script.
 *
 * Must stay tiny and dependency-free; it is render-blocking by design.
 */
(function () {
  var root = document.documentElement;
  try {
    var stored = localStorage.getItem("salon-locale");
    if (stored === "en") {
      root.lang = "en";
      root.dir = "ltr";
    } else if (stored === "ar") {
      root.lang = "ar";
      root.dir = "rtl";
    }
  } catch (error) {
    /* A browser that refuses localStorage keeps the document's own
       `lang="ar" dir="rtl"`, which is the right default. */
  }
})();
