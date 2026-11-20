const fs = require("fs");
function rep(file, from, to) {
  const s = fs.readFileSync(file, "utf8");
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(file + ": expected 1 match, found " + n + " for: " + from.slice(0, 70));
  fs.writeFileSync(file, s.replace(from, () => to));
}
const A = "frontend/src/App.tsx";
rep(A, 'import Security from "./pages/Security";', 'import Security from "./pages/Security";\nimport Circuit from "./pages/Circuit";');
rep(A, '<Route path="/security" element={<Security />} />', '<Route path="/security" element={<Security />} />\n        <Route path="/circuit" element={<Circuit />} />');
const link = '<Link to="/security" className="mt-3 inline-block text-sm text-trust-400 underline">Trust and limits: what the chain proves, and what it does not</Link>';
rep("frontend/src/pages/Home.tsx", link, '<Link to="/circuit" className="mt-3 mr-4 inline-block text-sm text-trust-400 underline">Inspect the circuit yourself</Link>\n        ' + link);
console.log("Patched OK");
