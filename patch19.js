const fs = require("fs");
const F = "frontend/src/pages/PVerify.tsx";
let s = fs.readFileSync(F, "utf8");
const from = "the organizer reviews evidence off-chain.";
const to = "the evaluators review evidence off-chain.";
if (s.includes(to)) { console.log("already patched"); }
else {
  if (s.split(from).length - 1 !== 1) throw new Error("expected 1 match in PVerify.tsx");
  fs.writeFileSync(F, s.replace(from, () => to));
  console.log("Patched OK");
}
