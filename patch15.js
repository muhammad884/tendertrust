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
edit("frontend/src/App.tsx", "pages/Report", [
  ['import PEvaluate from "./pages/PEvaluate";', 'import PEvaluate from "./pages/PEvaluate";\nimport Report from "./pages/Report";'],
  ['<Route path="/security" element={<Security />} />', '<Route path="/security" element={<Security />} />\n        <Route path="/report/:ver/:id" element={<Report />} />'],
]);
const back2 = '<p className="mt-4 text-sm"><Link to={"/tender/" + id} className="text-trust-400 underline">Back to tender</Link></p>';
edit("frontend/src/pages/Verify.tsx", "/report/v2/", [[back2, back2 + '\n      <p className="mt-2 text-sm"><Link to={"/report/v2/" + id} className="text-trust-400 underline">Open the printable audit report</Link></p>']]);
const back3 = '<p className="mt-4 text-sm"><Link to={"/p/tender/" + id} className="text-trust-400 underline">Back to tender</Link></p>';
edit("frontend/src/pages/PVerify.tsx", "/report/v3/", [[back3, back3 + '\n      <p className="mt-2 text-sm"><Link to={"/report/v3/" + id} className="text-trust-400 underline">Open the printable audit report</Link></p>']]);
const css = "frontend/src/index.css";
let c = fs.readFileSync(css, "utf8");
if (!c.includes("@media print")) {
  c += "\n@media print {\n  header, nav, .no-print { display: none !important; }\n  body { background: #fff !important; }\n  main { padding: 0 !important; max-width: 100% !important; }\n}\n";
  fs.writeFileSync(css, c);
}
console.log("Patched OK");
