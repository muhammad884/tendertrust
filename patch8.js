const fs = require("fs");
function rep(file, from, to) {
  const s = fs.readFileSync(file, "utf8");
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(file + ": expected 1 match, found " + n + " for: " + from.slice(0, 70));
  fs.writeFileSync(file, s.replace(from, () => to));
}
const F = "frontend/src/App.tsx";
rep(F, 'import Evaluate from "./pages/Evaluate";', 'import Evaluate from "./pages/Evaluate";\nimport Security from "./pages/Security";');
rep(F, '<Route path="/tender/:id/evaluate" element={<Evaluate />} />', '<Route path="/tender/:id/evaluate" element={<Evaluate />} />\n        <Route path="/security" element={<Security />} />');
console.log("Patched OK");
