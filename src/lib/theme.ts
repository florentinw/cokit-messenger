/** Sync `html.dark` with the OS color scheme (no user override). */
export function initTheme() {
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function apply() {
    document.documentElement.classList.toggle("dark", media.matches);
  }

  apply();
  media.addEventListener("change", apply);
}
