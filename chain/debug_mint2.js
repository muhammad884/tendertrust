const fs = require("fs");
const { createPublicClient, http, defineChain, parseAbi, parseEther, encodeFunctionData } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const me = privateKeyToAccount(key);
const pub = createPublicClient({ chain, transport: http(url) });
const factory = "0x1f09daefa827f02cbb40967cc91b259763760761";
const fAbi = parseAbi([
  "function createCPU(string name, string symbol, string story, uint256 transistorSupply, uint256 mintPrice) payable returns (address transistors, address circuits)",
  "function cpus(uint256) view returns (address)",
  "function deployFee() view returns (uint256)",
]);
const cAbi = parseAbi(["function transistors() view returns (address)"]);
const tAbi = parseAbi(["function mint(uint256 id, uint256 amount) payable", "function protocolFee() view returns (uint256)"]);

function reason(e) {
  let data;
  try { e.walk((x) => { const d = x && (x.raw ?? x.data); if (typeof d === "string" && d.startsWith("0x")) data = d; return false; }); } catch {}
  return data ? "data " + data.slice(0, 74) : "no revert data";
}
async function attempt(label, address, abi, functionName, args, value) {
  try {
    await pub.simulateContract({ account: me, address, abi, functionName, args, value });
    console.log("  OK    ", label);
  } catch (e) { console.log("  REVERT", label, "|", reason(e)); }
}

(async () => {
  const circuits = await pub.readContract({ address: factory, abi: fAbi, functionName: "cpus", args: [422n] });
  const tok = await pub.readContract({ address: circuits, abi: cAbi, functionName: "transistors" });
  const pf = await pub.readContract({ address: tok, abi: tAbi, functionName: "protocolFee" });
  const fee = await pub.readContract({ address: factory, abi: fAbi, functionName: "deployFee" });
  console.log("mint on CPU#422 transistors", tok, "| protocolFee(wei)", pf.toString());
  const mv = [["0 wei", 0n], ["1 wei", 1n], ["protocolFee", pf], ["10 x protocolFee", pf * 10n], ["1 gwei", 1000000000n], ["0.00066 OKB", parseEther("0.00066")]];
  for (const [l, v] of mv) {
    await attempt("mint(0,170) value " + l, tok, tAbi, "mint", [0n, 170n], v);
    await attempt("mint(0,1)   value " + l, tok, tAbi, "mint", [0n, 1n], v);
  }
  console.log("\ncreateCPU:");
  const cv = [["0 wei", 0n], ["1 wei", 1n], ["deployFee", fee], ["0.0066 OKB", parseEther("0.0066")]];
  for (const [l, v] of cv) await attempt("createCPU value " + l, factory, fAbi, "createCPU", ["TenderTrust", "TTRUST", "Scoring circuits.", 10000n, 0n], v);

  console.log("\ndebug_traceCall (may be unsupported by this RPC):");
  try {
    const data = encodeFunctionData({ abi: tAbi, functionName: "mint", args: [0n, 170n] });
    const t = await pub.request({ method: "debug_traceCall", params: [{ from: me.address, to: tok, data, value: "0x" + pf.toString(16) }, "latest", { tracer: "callTracer" }] });
    console.log(JSON.stringify(t).slice(0, 800));
  } catch (e) { console.log("  trace not available:", (e.shortMessage || e.message).split("\n")[0].slice(0, 100)); }
})().catch((e) => console.error("FAILED:", e.shortMessage || e.message));
