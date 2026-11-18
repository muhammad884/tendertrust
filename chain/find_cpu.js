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
const fAbi = parseAbi([
  "function createCPU(string name, string symbol, string story, uint256 transistorSupply, uint256 mintPrice) payable returns (address transistors, address circuits)",
  "function deployFee() view returns (uint256)",
  "function cpuCount() view returns (uint256)",
  "function cpus(uint256) view returns (address)",
]);
const cAbi = parseAbi(["function transistors() view returns (address)", "function nextId() view returns (uint256)"]);
const tAbi = parseAbi([
  "function supplyCap() view returns (uint256)", "function minted() view returns (uint256)",
  "function mintPrice() view returns (uint256)", "function protocolFee() view returns (uint256)",
  "function circuits() view returns (address)",
]);

async function partA() {
  console.log("A) createCPU diagnosis (free, nothing sent)");
  const fee = await pub.readContract({ address: factory, abi: fAbi, functionName: "deployFee" });
  const r = Date.now() % 100000;
  const variants = [
    { gas: 3000000n, name: "TenderTrust", sym: "TTRUST", sup: 10000n },
    { gas: 8000000n, name: "TenderTrust", sym: "TTRUST", sup: 10000n },
    { gas: 20000000n, name: "TT Scoring " + r, sym: "TT" + (r % 1000), sup: 10000000n },
  ];
  for (const v of variants) {
    try {
      await pub.simulateContract({ account: me, address: factory, abi: fAbi, functionName: "createCPU", args: [v.name, v.sym, "Procurement scoring circuits.", v.sup, 0n], value: fee, gas: v.gas });
      console.log("  OK with gas", v.gas.toString(), "|", v.name, v.sym);
    } catch (e) {
      console.log("  REVERT gas", v.gas.toString(), "|", (e.shortMessage || "").split("\n")[0].slice(0, 100), "|", (e.details || "").slice(0, 100));
    }
  }
}

async function partB() {
  console.log("\nB) Existing CPUs with free supply (free scan)");
  const n = Number(await pub.readContract({ address: factory, abi: fAbi, functionName: "cpuCount" }));
  const r1 = await pub.multicall({ contracts: Array.from({ length: n }, (_, i) => ({ address: factory, abi: fAbi, functionName: "cpus", args: [BigInt(i)] })), allowFailure: true });
  const circ = r1.map((r) => (r.status === "success" ? r.result : null));
  const r2 = await pub.multicall({ contracts: circ.map((a) => ({ address: a || factory, abi: cAbi, functionName: "transistors" })), allowFailure: true });
  const toks = r2.map((r, i) => (circ[i] && r.status === "success" ? r.result : null));
  const fields = ["supplyCap", "minted", "mintPrice", "protocolFee", "circuits"];
  const res = await pub.multicall({ contracts: toks.flatMap((t) => fields.map((f) => ({ address: t || factory, abi: tAbi, functionName: f }))), allowFailure: true });
  const rows = [];
  for (let i = 0; i < n; i++) {
    if (!circ[i] || !toks[i]) continue;
    const g = (j) => (res[i * 5 + j].status === "success" ? res[i * 5 + j].result : null);
    const cap = g(0), minted = g(1), mp = g(2), pf = g(3), back = g(4);
    if ([cap, minted, mp, pf].some((x) => x === null)) continue;
    if (back && back.toLowerCase() !== circ[i].toLowerCase()) continue;
    const remaining = cap - minted;
    const cost = 170n * mp + pf;
    if (remaining >= 170n && cost <= parseEther("0.002")) rows.push({ i, circuits: circ[i], tok: toks[i], remaining, mp, pf, cost });
  }
  rows.sort((a, b) => (a.cost < b.cost ? -1 : a.cost > b.cost ? 1 : b.remaining > a.remaining ? 1 : -1));
  console.log("Candidates:", rows.length, "of", n, "CPUs");
  rows.slice(0, 10).forEach((x) => {
    console.log("CPU#" + x.i, "| circuits", x.circuits);
    console.log("   transistors", x.tok, "| supply left", x.remaining.toString(), "| mintPrice(wei)", x.mp.toString(), "| cost for 170 NAND", formatEther(x.cost), "OKB");
  });
}

(async () => {
  await partA().catch((e) => console.log("A failed:", e.shortMessage || e.message));
  await partB().catch((e) => console.log("B failed:", e.shortMessage || e.message));
})();
