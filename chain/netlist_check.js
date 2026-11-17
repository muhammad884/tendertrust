const { createPublicClient, http, defineChain, parseAbi, formatEther } = require("viem");
const url = "https://rpc.xlayer.tech";
const c = createPublicClient({
  chain: defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } }),
  transport: http(url),
});
const factory = "0x1f09daefa827f02cbb40967cc91b259763760761";
const fAbi = parseAbi(["function cpuCount() view returns (uint256)", "function cpus(uint256) view returns (address)", "function deployFee() view returns (uint256)"]);
const cAbi = parseAbi([
  "function nextId() view returns (uint256)",
  "function circuitInfo(uint256) view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount)",
  "function netlist(uint256) view returns (bytes)",
  "function eval(uint256 id, bytes inputs) view returns (bytes)",
  "function TAPEOUT_FEE() view returns (uint256)",
  "function transistors() view returns (address)",
]);
const tAbi = parseAbi(["function mintPrice() view returns (uint256)", "function protocolFee() view returns (uint256)", "function supplyCap() view returns (uint256)", "function minted() view returns (uint256)"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parse(hex, nIn, endian) {
  const b = Buffer.from(hex.slice(2), "hex");
  const u24 = (o) => endian === "BE" ? (b[o] << 16) | (b[o + 1] << 8) | b[o + 2] : (b[o + 2] << 16) | (b[o + 1] << 8) | b[o];
  const gates = [];
  let o = 0, sig = 2 + nIn;
  while (o < b.length) {
    if (b[o] !== 0 || o + 7 > b.length) return null; // NAND-only circuits
    const x = u24(o + 1), y = u24(o + 4);
    if (x >= sig || y >= sig) return null;
    gates.push([x, y]); sig++; o += 7;
  }
  return gates;
}
function simulate(gates, nIn, nOut, inp) {
  const total = 2 + nIn + gates.length;
  const v = new Array(total).fill(0);
  v[1] = 1;
  for (let i = 0; i < nIn; i++) v[2 + i] = ((inp[i >> 3] || 0) >> (i & 7)) & 1;
  gates.forEach(([x, y], i) => { v[2 + nIn + i] = (v[x] & v[y]) ^ 1; });
  const out = Buffer.alloc(Math.ceil(nOut / 8));
  for (let k = 0; k < nOut; k++) if (v[total - nOut + k]) out[k >> 3] |= 1 << (k & 7);
  return out;
}

(async () => {
  const count = await c.readContract({ address: factory, abi: fAbi, functionName: "cpuCount" });
  for (let i = count - 1n; i >= 0n && i > count - 40n; i--) {
    let addr, last;
    try {
      addr = await c.readContract({ address: factory, abi: fAbi, functionName: "cpus", args: [i] });
      last = await c.readContract({ address: addr, abi: cAbi, functionName: "nextId" });
    } catch { continue; }
    for (let id = 1n; id <= last && id <= 8n; id++) {
      try {
        const [nIn, nOut, nState, gc] = await c.readContract({ address: addr, abi: cAbi, functionName: "circuitInfo", args: [id] });
        if (nState !== 0 || nIn === 0 || nIn > 24 || gc > 400) continue;
        const nl = await c.readContract({ address: addr, abi: cAbi, functionName: "netlist", args: [id] });
        let used = null, gates = null;
        for (const e of ["BE", "LE"]) {
          const g = parse(nl, nIn, e);
          if (g && g.length === Number(gc)) { used = e; gates = g; break; }
        }
        if (!used) continue;
        console.log("Circuit: CPU#" + i, addr, "id", id.toString(), "| nIn", nIn, "nOut", nOut, "gates", gc);
        console.log("Netlist first 14 bytes:", nl.slice(0, 2 + 28));
        console.log("u24 byte order detected:", used === "BE" ? "BIG-endian" : "LITTLE-endian");
        let pass = 0;
        const N = 30, nb = Math.ceil(nIn / 8);
        for (let k = 0; k < N; k++) {
          const inp = Buffer.from(Array.from({ length: nb }, () => Math.floor(Math.random() * 256)));
          const want = "0x" + simulate(gates, nIn, nOut, inp).toString("hex");
          const got = await c.readContract({ address: addr, abi: cAbi, functionName: "eval", args: [id, "0x" + inp.toString("hex")] });
          if (got.toLowerCase() === want.toLowerCase()) pass++;
          await sleep(150);
        }
        console.log("Simulator vs onchain eval:", pass + "/" + N, pass === N ? "MATCH" : "MISMATCH");
        try {
          const tok = await c.readContract({ address: addr, abi: cAbi, functionName: "transistors" });
          const fee = await c.readContract({ address: addr, abi: cAbi, functionName: "TAPEOUT_FEE" });
          const dep = await c.readContract({ address: factory, abi: fAbi, functionName: "deployFee" });
          const mp = await c.readContract({ address: tok, abi: tAbi, functionName: "mintPrice" });
          const pf = await c.readContract({ address: tok, abi: tAbi, functionName: "protocolFee" });
          const cap = await c.readContract({ address: tok, abi: tAbi, functionName: "supplyCap" });
          const mn = await c.readContract({ address: tok, abi: tAbi, functionName: "minted" });
          console.log("LIVE FEES: TAPEOUT_FEE", formatEther(fee), "| deployFee", formatEther(dep), "| this CPU mintPrice", formatEther(mp), "protocolFee", formatEther(pf), "| minted", mn.toString(), "/ cap", cap.toString());
        } catch (e) { console.log("fee read failed:", e.shortMessage || e.message); }
        return;
      } catch (e) {}
    }
  }
  console.log("No suitable NAND-only circuit found.");
})();
