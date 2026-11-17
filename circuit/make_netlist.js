const fs = require("fs");
const { nIn, nOut, gateCount, gates } = JSON.parse(fs.readFileSync("score_circuit.json", "utf8"));

const u24 = (n) => Buffer.from([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
const parts = [];
gates.forEach(([a, b]) => parts.push(Buffer.from([0]), u24(a), u24(b)));
const nl = Buffer.concat(parts);

// parse the bytes back exactly like the chain does
let sig = 2 + nIn;
const g2 = [];
for (let o = 0; o < nl.length; o += 7) {
  if (nl[o] !== 0) throw new Error("bad element type");
  const a = (nl[o + 1] << 16) | (nl[o + 2] << 8) | nl[o + 3];
  const b = (nl[o + 4] << 16) | (nl[o + 5] << 8) | nl[o + 6];
  if (a >= sig || b >= sig) throw new Error("future signal at gate " + g2.length);
  g2.push([a, b]);
  sig++;
}
if (g2.length !== gateCount) throw new Error("gate count mismatch");
if (gateCount < nOut) throw new Error("too few signals for outputs");

function run(x) {
  const total = 2 + nIn + g2.length;
  const v = new Array(total).fill(0);
  v[1] = 1;
  for (let i = 0; i < nIn; i++) v[2 + i] = (x >> i) & 1;
  g2.forEach(([a, b], i) => { v[2 + nIn + i] = (v[a] & v[b]) ^ 1; });
  let out = 0;
  for (let k = 0; k < nOut; k++) out |= v[total - nOut + k] << k;
  return out;
}

let bad = 0;
for (let x = 0; x < 1 << nIn; x++) {
  const T = x & 15, E = (x >> 4) & 15, D = (x >> 8) & 15, P = (x >> 12) & 15, OK = (x >> 16) & 1;
  if (run(x) !== (OK ? 4 * T + 3 * E + 2 * D + P : 0)) bad++;
}
console.log("Netlist bytes:", nl.length, "| NAND gates (transistors needed):", g2.length, "| nIn", nIn, "| nOut", nOut);
console.log(bad === 0 ? "Re-parsed bytes: ALL " + (1 << nIn) + " cases PASS" : "FAILED cases: " + bad);
if (bad === 0) {
  fs.writeFileSync("score_netlist.hex", "0x" + nl.toString("hex"));
  console.log("Saved score_netlist.hex");
}
