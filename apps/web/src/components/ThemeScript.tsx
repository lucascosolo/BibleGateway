const THEME_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("jot-preferences");
    var theme = "system";
    if (raw) {
      var parsed = JSON.parse(raw);
      theme = (parsed && parsed.state && parsed.state.theme) || "system";
    }
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (e) {}
})();
`;

/**
 * Runs synchronously before first paint so an explicit light/dark
 * preference is applied before React hydrates — avoids a theme flash and
 * any [data-theme] hydration mismatch. When the preference is "system"
 * (the default) it sets nothing, and the CSS `prefers-color-scheme` block
 * in globals.css takes over.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
