const fs = require("fs");
const nIn = 17; // t:0-3 e:4-7 d:8-11 p:12-15 ok:16
let next = 2 + nIn; // signal 0 = const 0, 1 = const 1, inputs start at 2
const gates = [];
const nand = (a, b) => { gates.push([a, b]); return next++; };
const IN = (i) => 2 + i;

function fa(a, b, c) {
  const n1 = nand(a, b), n2 = nand(a, n1), n3 = nand(b, n1), x1 = nand(n2, n3);
  const n4 = nand(x1, c), n5 = nand(x1, n4), n6 = nand(c, n4);
  return [nand(n5, n6), nand(n1, n4)]; // [sum, carry]
}
function ha(a, b) {
  const n1 = nand(a, b), n2 = nand(a, n1), n3 = nand(b, n1);
  return [nand(n2, n3), nand(n1, n1)]; // [xor, and]
}
function add(x, y) {
  const n = Math.max(x.length, y.length);
  const out = [];
  let c = 0;
  for (let i = 0; i < n; i++) {
    const ops = [i < x.length ? x[i] : 0, i < y.length ? y[i] : 0, c].filter((s) => s !== 0);
    if (ops.length === 0) { out.push(0); c = 0; }
    else if (ops.length === 1) { out.push(ops[0]); c = 0; }
    else if (ops.length === 2) { const [s, co] = ha(ops[0], ops[1]); out.push(s); c = co; }
    else { const [s, co] = fa(ops[0], ops[1], ops[2]); out.push(s); c = co; }
  }
  if (c !== 0) out.push(c);
  return out;
}

const t = [0, 1, 2, 3].map((i) => IN(i));
const e = [0, 1, 2, 3].map((i) => IN(4 + i));
const d = [0, 1, 2, 3].map((i) => IN(8 + i));
const p = [0, 1, 2, 3].map((i) => IN(12 + i));
const ok = IN(16);

// 4t + 3e + 2d + p  =  (t<<2) + e + (e<<1) + (d<<1) + p
const sum = add(add(add([0, 0, ...t], e), [0, ...e]), add([0, ...d], p));
if (sum.length < 8) throw new Error("sum too short");

// gate with eligible flag; the last 8 gates are the outputs (LSB first)
const m = [];
for (let i = 0; i < 8; i++) m.push(nand(sum[i], ok));
for (let i = 0; i < 8; i++) nand(m[i], m[i]);

function run(x) {
  const v = new Array(next).fill(0);
  v[1] = 1;
  for (let i = 0; i < nIn; i++) v[2 + i] = (x >> i) & 1;
  gates.forEach(([a, b], i) => { v[2 + nIn + i] = (v[a] & v[b]) ^ 1; });
  let out = 0;
  for (let k = 0; k < 8; k++) out |= v[next - 8 + k] << k;
  return out;
}

let bad = 0;
for (let x = 0; x < 1 << nIn; x++) {
  const T = x & 15, E = (x >> 4) & 15, D = (x >> 8) & 15, P = (x >> 12) & 15, OK = (x >> 16) & 1;
  const want = OK ? 4 * T + 3 * E + 2 * D + P : 0;
  if (run(x) !== want) { if (bad++ < 5) console.log("MISMATCH", { T, E, D, P, OK, want, got: run(x) }); }
}
console.log("Gate count:", gates.length);
console.log(bad === 0 ? "ALL " + (1 << nIn) + " cases PASS" : "FAILED cases: " + bad);
const ex = (T, E, D, P, OK) => run(T | (E << 4) | (D << 8) | (P << 12) | (OK << 16));
console.log("Example A (12,10,9,3, eligible):", ex(12, 10, 9, 3, 1), "(expected 99)");
console.log("Example B (8,9,7,6, eligible):", ex(8, 9, 7, 6, 1), "(expected 79)");
console.log("Max (15,15,15,15, eligible):", ex(15, 15, 15, 15, 1), "(expected 150)");
console.log("Not eligible:", ex(15, 15, 15, 15, 0), "(expected 0)");
if (bad === 0) fs.writeFileSync("score_circuit.json", JSON.stringify({ nIn, nOut: 8, gateCount: gates.length, gates }));
