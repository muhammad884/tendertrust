const fs = require("fs");
const { createPublicClient, http, defineChain, parseAbi, parseEther, formatEther } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const url = "https://rpc.xlayer.tech";
const chain = defineChain({
  id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [url] } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const me = privateKeyToAccount(key);
const pub = createPublicClient({ chain, transport: http(url) });
const factory = "0x1f09daefa827f02cbb40967cc91b259763760761";
const fAbi = parseAbi(["function cpuCount() view returns (uint256)", "function cpus(uint256) view returns (address)"]);
const cAbi = parseAbi([
  "function nextId() view returns (uint256)",
  "function transistors() view returns (address)",
  "function circuitInfo(uint256) view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount)",
  "function eval(uint256 id, bytes inputs) view returns (bytes)",
]);
const tAbi = parseAbi([
  "function mint(uint256 id, uint256 amount) payable",
  "function supplyCap() view returns (uint256)", "function minted() view returns (uint256)",
  "function mintPrice() view returns (uint256)", "function protocolFee() view returns (uint256)",
]);
const range = (k) => Array.from({ length: k }, (_, i) => i);
const mc = (contracts, batchSize) => pub.multicall({ contracts, allowFailure: true, batchSize });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NAMES = {
  "1,1:1,0": "NOT",
  "2,1:1,1,1,0": "NAND", "2,1:0,0,0,1": "AND", "2,1:0,1,1,0": "XOR", "2,1:0,1,1,1": "OR", "2,1:1,0,0,0": "NOR", "2,1:1,0,0,1": "XNOR",
  "2,2:0,1,1,2": "HALF_ADDER sum=out0 carry=out1", "2,2:0,2,2,1": "HALF_ADDER carry=out0 sum=out1",
  "3,2:0,1,1,2,1,2,2,3": "FULL_ADDER sum=out0 carry=out1", "3,2:0,2,2,1,2,1,1,3": "FULL_ADDER carry=out0 sum=out1",
};

(async () => {
  const n = Number(await pub.readContract({ address: factory, abi: fAbi, functionName: "cpuCount" }));
  const circ = (await mc(range(n).map((i) => ({ address: factory, abi: fAbi, functionName: "cpus", args: [BigInt(i)] })), 16384))
    .map((r) => (r.status === "success" ? r.result : null));
  const last = (await mc(circ.map((a) => ({ address: a || factory, abi: cAbi, functionName: "nextId" })), 16384))
    .map((r, i) => (circ[i] && r.status === "success" ? Number(r.result) : 0));

  console.log("=== B) Public building-block circuits (free scan) ===");
  const list = [];
  circ.forEach((a, i) => { for (let id = 1; id <= Math.min(last[i], 300); id++) list.push({ i, a, id }); });
  console.log("CPUs:", n, "| circuits found:", list.length);
  const infos = await mc(list.map((x) => ({ address: x.a, abi: cAbi, functionName: "circuitInfo", args: [BigInt(x.id)] })), 16384);
  const small = [];
  infos.forEach((r, k) => {
    if (r.status !== "success") return;
    const [nIn, nOut, nState, gates] = r.result;
    if (nState === 0 && nIn >= 1 && nIn <= 3 && nOut >= 1 && nOut <= 2 && gates <= 12) small.push({ ...list[k], nIn, nOut, gates });
  });
  console.log("small combinational circuits to test:", small.length);
  const calls = [];
  small.forEach((s, k) => { for (let x = 0; x < 1 << s.nIn; x++) calls.push({ k, x }); });
  const ev = await mc(calls.map((c) => ({ address: small[c.k].a, abi: cAbi, functionName: "eval", args: [BigInt(small[c.k].id), "0x" + c.x.toString(16).padStart(2, "0")] })), 4096);
  const tts = small.map(() => []);
  ev.forEach((r, j) => { const c = calls[j]; tts[c.k][c.x] = r.status === "success" ? parseInt(r.result.slice(2, 4) || "00", 16) : -1; });
  const found = {};
  small.forEach((s, k) => {
    const name = NAMES[s.nIn + "," + s.nOut + ":" + tts[k].join(",")];
    if (!name) return;
    (found[name] = found[name] || []).push({ cpu: s.i, circuits: s.a, id: s.id, gates: s.gates });
  });
  Object.keys(found).forEach((nm) => found[nm].sort((a, b) => a.gates - b.gates || a.cpu - b.cpu));
  for (const nm of Object.keys(found)) {
    console.log(nm, "| found", found[nm].length);
    found[nm].slice(0, 2).forEach((f) => console.log("   CPU#" + f.cpu, f.circuits, "id", f.id, "gates", f.gates));
  }
  fs.writeFileSync("primitives.json", JSON.stringify(found, null, 1));
  console.log("Saved primitives.json");

  console.log("\n=== A) Does mint work on any existing CPU? (simulation only) ===");
  const toks = (await mc(circ.map((a) => ({ address: a || factory, abi: cAbi, functionName: "transistors" })), 16384))
    .map((r, i) => (circ[i] && r.status === "success" ? r.result : null));
  const F = ["supplyCap", "minted", "mintPrice", "protocolFee"];
  const fr = await mc(toks.flatMap((t) => F.map((f) => ({ address: t || factory, abi: tAbi, functionName: f }))), 16384);
  const cands = [];
  for (let i = 0; i < n; i++) {
    if (!toks[i]) continue;
    const g = (j) => (fr[i * 4 + j].status === "success" ? fr[i * 4 + j].result : null);
    const [cap, minted, mp, pf] = [g(0), g(1), g(2), g(3)];
    if ([cap, minted, mp, pf].some((v) => v === null)) continue;
    const cost = 170n * mp + pf;
    if (cap - minted >= 170n && cost <= parseEther("0.002")) cands.push({ i, tok: toks[i], cost });
  }
  cands.sort((a, b) => (a.cost < b.cost ? -1 : 1));
  const oks = [];
  for (const c of cands.slice(0, 45)) {
    try {
      await pub.simulateContract({ account: me, address: c.tok, abi: tAbi, functionName: "mint", args: [0n, 170n], value: c.cost });
      oks.push(c);
    } catch (e) {}
    await sleep(120);
  }
  console.log("Tested", Math.min(45, cands.length), "CPUs. mint OK on:", oks.length);
  oks.slice(0, 5).forEach((c) => console.log("   CPU#" + c.i, "transistors", c.tok, "cost", formatEther(c.cost), "OKB"));
})().catch((e) => console.error("FAILED:", e.shortMessage || e.message));
