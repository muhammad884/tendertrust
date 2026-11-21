const fs = require("fs");
const A = "frontend/src/App.tsx";
let s = fs.readFileSync(A, "utf8");
if (s.includes("Create3")) { console.log("Already patched"); process.exit(0); }
const swap = (from, to) => {
  if (s.split(from).length - 1 !== 1) throw new Error("expected 1 match for: " + from);
  s = s.replace(from, () => to);
};
swap('import Create from "./pages/Create";', 'import Create3 from "./pages/Create3";\nimport PTender from "./pages/PTender";\nimport PBid from "./pages/PBid";\nimport PVerify from "./pages/PVerify";');
swap('<Route path="/create" element={<Create />} />', '<Route path="/create" element={<Create3 />} />');
const R = '<Route path="/circuit" element={<Circuit />} />';
swap(R, R + "\n" + [
  '        <Route path="/p/tender/:id" element={<PTender />} />',
  '        <Route path="/p/tender/:id/bid" element={<PBid />} />',
  '        <Route path="/p/verify" element={<PVerify />} />',
  '        <Route path="/p/verify/:id" element={<PVerify />} />',
].join("\n"));
fs.writeFileSync(A, s);
console.log("Patched OK");
