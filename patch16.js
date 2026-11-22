const fs = require("fs");
const F = "frontend/src/App.tsx";
let s = fs.readFileSync(F, "utf8");
if (s.includes("NotFound")) { console.log("Already patched"); process.exit(0); }
const swap = (from, to) => {
  if (s.split(from).length - 1 !== 1) throw new Error("expected 1 match for: " + from);
  s = s.replace(from, () => to);
};
swap('import Report from "./pages/Report";', 'import Report from "./pages/Report";\nimport NotFound from "./pages/NotFound";');
const R = '<Route path="/report/:ver/:id" element={<Report />} />';
swap(R, R + '\n        <Route path="/trust" element={<Security />} />\n        <Route path="*" element={<NotFound />} />');
fs.writeFileSync(F, s);
console.log("Patched OK");
