import { getLang, setLang } from "../lib/i18n";

export default function LangToggle() {
  const cur = getLang();
  return (
    <button
      className="rounded-lg border border-ink-600 px-2 py-1 text-xs font-semibold text-ink-100"
      aria-label="Change language"
      onClick={() => setLang(cur === "ha" ? "en" : "ha")}
    >
      {cur === "ha" ? "EN" : "HA"}
    </button>
  );
}
