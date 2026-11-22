const fs = require("fs");
function edit(file, marker, list) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(marker)) { console.log(file, "already patched"); return; }
  for (const [from, to] of list) {
    if (s.split(from).length - 1 !== 1) throw new Error(file + ": expected 1 match for: " + from.slice(0, 70));
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(file, s);
}
const P = "frontend/src/";
edit(P + "components/Layout.tsx", "LangToggle", [
  ['import { Link, NavLink, Outlet } from "react-router-dom";', 'import { Link, NavLink, Outlet } from "react-router-dom";\nimport LangToggle from "./LangToggle";'],
  ['<span className="badge bg-ink-700 text-ink-300">X Layer Mainnet</span>', '<div className="flex items-center gap-2">\n            <LangToggle />\n            <span className="badge bg-ink-700 text-ink-300">X Layer Mainnet</span>\n          </div>'],
]);
let m = fs.readFileSync(P + "main.tsx", "utf8");
if (!m.includes("startTranslator")) {
  const from = 'import "./index.css";';
  if (m.split(from).length - 1 !== 1) throw new Error("main.tsx: expected 1 match");
  m = m.replace(from, () => from + '\nimport { startTranslator } from "./lib/i18n";');
  m = m.trimEnd() + "\n\nstartTranslator();\n";
  fs.writeFileSync(P + "main.tsx", m);
}
edit(P + "components/PBidEval.tsx", "documents or samples", [
  ["I reviewed the documents and they are verified", "I reviewed the documents or samples and they are verified"],
]);
console.log("Patched OK");
