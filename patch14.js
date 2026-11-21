const fs = require("fs");
function edit(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(pairs.marker)) { console.log(file, "already patched"); return; }
  for (const [from, to] of pairs.list) {
    if (s.split(from).length - 1 !== 1) throw new Error(file + ": expected 1 match for: " + from.slice(0, 70));
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(file, s);
}
const R = '<Route path="/p/tender/:id/bid" element={<PBid />} />';
edit("frontend/src/App.tsx", { marker: "PEvaluate", list: [
  ['import PBid from "./pages/PBid";', 'import PBid from "./pages/PBid";\nimport PEvaluate from "./pages/PEvaluate";'],
  [R, R + '\n        <Route path="/p/tender/:id/evaluate" element={<PEvaluate />} />'],
] });
const L = '{data.status === 1 && <Link to={"/p/tender/" + id + "/bid"} className="btn-primary mt-4 w-full">Reveal your bid</Link>}';
edit("frontend/src/pages/PTender.tsx", { marker: "/evaluate", list: [
  [L, L + '\n      {data.status === 2 && <Link to={"/p/tender/" + id + "/evaluate"} className="btn-ghost mt-4 w-full">Panel: score, settle and finalize</Link>}'],
] });
console.log("Patched OK");
