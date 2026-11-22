import { ha } from "./ha";

export type Lang = "en" | "ha";

export function getLang(): Lang {
  try {
    return localStorage.getItem("tt-lang") === "ha" ? "ha" : "en";
  } catch {
    return "en";
  }
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem("tt-lang", l);
  } catch {
    /* storage unavailable */
  }
  window.location.reload();
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const dict = new Map<string, string>();
for (const [k, v] of Object.entries(ha)) dict.set(norm(k), v);

const rules: [RegExp, string][] = [
  [/^Bid on tender #(\d+)$/, "Bid a kan tender #$1"],
  [/^Published as tender #(\d+)$/, "An wallafa a matsayin tender #$1"],
  [/^Evaluator (\d) address \(0x…\)$/, "Adireshin mai duba $1 (0x…)"],
  [/^Price must be a whole number between 1 and the budget \((\d+)\)\.$/, "Farashi dole ya zama cikakken lamba tsakanin 1 da budget ($1)."],
];

function tr(text: string): string | null {
  const key = norm(text);
  if (!key) return null;
  const hit = dict.get(key);
  if (hit !== undefined) return hit;
  for (const [re, to] of rules) if (re.test(key)) return key.replace(re, to);
  return null;
}

function translateText(n: Text) {
  const raw = n.nodeValue ?? "";
  const out = tr(raw);
  if (out === null) return;
  const lead = raw.match(/^\s*/)?.[0] ?? "";
  const trail = raw.match(/\s*$/)?.[0] ?? "";
  const next = lead + out + trail;
  if (next !== raw) n.nodeValue = next;
}

function translateAttrs(root: ParentNode) {
  root.querySelectorAll("[placeholder]").forEach((el) => {
    const cur = el.getAttribute("placeholder") ?? "";
    const out = tr(cur);
    if (out !== null && out !== cur) el.setAttribute("placeholder", out);
  });
}

function walk(root: Node) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null = w.nextNode();
  while (n) {
    translateText(n as Text);
    n = w.nextNode();
  }
  if (root instanceof Element || root instanceof Document) translateAttrs(root as ParentNode);
}

export function startTranslator() {
  if (getLang() !== "ha") return;
  document.documentElement.lang = "ha";
  walk(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") translateText(m.target as Text);
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 3) translateText(node as Text);
        else walk(node);
      });
    }
    translateAttrs(document.body);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
