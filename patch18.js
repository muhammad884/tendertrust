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
edit("frontend/src/components/Layout.tsx", "ThemeToggle", [
  ['import LangToggle from "./LangToggle";', 'import LangToggle from "./LangToggle";\nimport ThemeToggle from "./ThemeToggle";'],
  ["<LangToggle />", "<LangToggle />\n            <ThemeToggle />"],
]);
const html = "frontend/index.html";
let h = fs.readFileSync(html, "utf8");
if (!h.includes("tt-theme")) {
  const from = '<meta charset="UTF-8" />';
  if (h.split(from).length - 1 !== 1) throw new Error("index.html: charset meta not found exactly once");
  const block = from +
    '\n    <meta name="theme-color" content="#0B1220" />' +
    "\n    <script>" +
    '\n      try {' +
    '\n        if (localStorage.getItem("tt-theme") === "light") {' +
    '\n          document.documentElement.setAttribute("data-theme", "light");' +
    '\n          document.querySelector(\'meta[name="theme-color"]\').setAttribute("content", "#F3EEDF");' +
    "\n        }" +
    "\n      } catch (e) {}" +
    "\n    </script>";
  h = h.replace(from, () => block);
  h = h.replace("<title>frontend</title>", "<title>TenderTrust: verifiable procurement on X Layer</title>");
  fs.writeFileSync(html, h);
}
console.log("Patched OK");
