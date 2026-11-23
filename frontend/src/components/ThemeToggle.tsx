import { useState } from "react";

type Theme = "dark" | "light";

function apply(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "light" ? "#F3EEDF" : "#0B1220");
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark",
  );

  function flip() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem("tt-theme", next);
    } catch {
      /* storage unavailable */
    }
  }

  return (
    <button
      className="rounded-lg border border-ink-600 p-1.5 text-ink-100"
      aria-label="Switch between the dark theme and the eye-care light theme"
      onClick={flip}
    >
      {theme === "light" ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
