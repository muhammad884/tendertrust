const { createPublicClient, http, defineChain, parseAbi } = require("viem");
const mk = (id, name, url) => createPublicClient({
  chain: defineChain({ id, name, nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } }),
  transport: http(url),
});
const nets = [
  { label: "TESTNET 1952", c: mk(1952, "X Layer Testnet", "https://testrpc.xlayer.tech/terigon") },
  { label: "MAINNET 196", c: mk(196, "X Layer", "https://rpc.xlayer.tech") },
];
const known = {
  factory: "0x1f09daefa827f02cbb40967cc91b259763760761",
  opener: "0x536add8f30f03b69f6fbf29d425a816a0dc50106",
  transistorBeacon: "0x1059ad62cabb6a6925bb65aa617300556c60a51b",
  circuitBeacon: "0xf70d1ed4f62cf3780157b0b421b7e2f45bd0991c",
};
const factoryAbi = parseAbi(["function cpuCount() view returns (uint256)", "function cpus(uint256) view returns (address)"]);
const circuitsAbi = parseAbi([
  "function nextId() view returns (uint256)",
  "function circuitInfo(uint256) view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount)",
  "function eval(uint256 id, bytes inputs) view returns (bytes)",
]);

async function probe({ label, c }) {
  console.log("\n=== " + label + " ===");
  console.log("chainId:", await c.getChainId());
  for (const [n, a] of Object.entries(known)) {
    try {
      const code = await c.getCode({ address: a });
      console.log(n, code && code !== "0x" ? "HAS CODE (" + (code.length - 2) / 2 + " bytes)" : "no code");
    } catch (e) { console.log(n, "error:", e.shortMessage || e.message); }
  }
  let count;
  try {
    count = await c.readContract({ address: known.factory, abi: factoryAbi, functionName: "cpuCount" });
    console.log("factory.cpuCount =", count.toString());
  } catch (e) {
    console.log("factory not usable on this network");
    return;
  }
  let found = false;
  for (let i = count - 1n; i >= 0n && i > count - 25n && !found; i--) {
    let circuits, last;
    try {
      circuits = await c.readContract({ address: known.factory, abi: factoryAbi, functionName: "cpus", args: [i] });
      last = await c.readContract({ address: circuits, abi: circuitsAbi, functionName: "nextId" });
    } catch { continue; }
    for (let id = 1n; id <= last && id <= 5n; id++) {
      try {
        const [nIn, nOut, nState, gates] = await c.readContract({ address: circuits, abi: circuitsAbi, functionName: "circuitInfo", args: [id] });
        if (nState !== 0) continue;
        const inp = "0x" + "00".repeat(Math.max(1, Math.ceil(nIn / 8)));
        const out = await c.readContract({ address: circuits, abi: circuitsAbi, functionName: "eval", args: [id, inp] });
        const gas = await c.estimateContractGas({ address: circuits, abi: circuitsAbi, functionName: "eval", args: [id, inp], account: "0x0000000000000000000000000000000000000001" });
        console.log("CPU#" + i, "circuits", circuits, "| circuit id", id.toString(), "| nIn", nIn, "nOut", nOut, "gates", gates);
        console.log("  eval(" + inp + ") ->", out, "| est. gas:", gas.toString());
        found = true;
        break;
      } catch (e) {}
    }
  }
  if (!found) console.log("no combinational circuit found in the newest CPUs");
}
(async () => { for (const n of nets) await probe(n); })();
