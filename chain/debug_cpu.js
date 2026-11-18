const fs = require("fs");
const { createPublicClient, http, defineChain, parseAbi, parseEther, formatEther, toFunctionSelector, decodeAbiParameters } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const me = privateKeyToAccount(key);
const pub = createPublicClient({ chain, transport: http(url) });
const factory = "0x1f09daefa827f02cbb40967cc91b259763760761";
const abi = parseAbi([
  "function createCPU(string name, string symbol, string story, uint256 transistorSupply, uint256 mintPrice) payable returns (address transistors, address circuits)",
  "function deployFee() view returns (uint256)",
  "function protocolFee() view returns (uint256)",
  "function owner() view returns (address)",
  "function isSealed() view returns (bool)",
]);

function info(e) {
  let data;
  try { e.walk((x) => { const d = x && (x.raw ?? x.data); if (typeof d === "string" && d.startsWith("0x")) data = d; return false; }); } catch {}
  if (!data) return "no revert data";
  if (data.startsWith("0x08c379a0")) { try { return "Error(" + decodeAbiParameters([{ type: "string" }], "0x" + data.slice(10))[0] + ")"; } catch {} }
  return "data " + data;
}

(async () => {
  console.log("Wallet balance:", formatEther(await pub.getBalance({ address: me.address })));
  const slot = await pub.getStorageAt({ address: factory, slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" });
  const impl = "0x" + slot.slice(26);
  console.log("Factory implementation now:", impl);
  console.log("Implementation in the doc :", "0x74956236ab64ed143933040b4137e8a352e4d17b", impl.toLowerCase() === "0x74956236ab64ed143933040b4137e8a352e4d17b" ? "(same)" : "(CHANGED - factory was upgraded)");
  for (const f of ["deployFee", "protocolFee", "owner", "isSealed"]) {
    try { const v = await pub.readContract({ address: factory, abi, functionName: f }); console.log(f + ":", typeof v === "bigint" ? v.toString() + " wei" : v); } catch (e) { console.log(f + ": read failed"); }
  }
  const code = await pub.getCode({ address: impl });
  const sigs = [
    "createCPU(string,string,string,uint256,uint256)",
    "createCPU(string,string,string,uint256)",
    "createCPU(string,string,uint256,uint256)",
    "createCPU(string,string,string,uint256,uint256,uint256)",
    "createCPU(string,string,string,uint256,uint256,address)",
  ];
  for (const s of sigs) console.log(s, code.includes("63" + toFunctionSelector(s).slice(2)) ? "-> PRESENT in implementation" : "-> not found");

  const fee = await pub.readContract({ address: factory, abi, functionName: "deployFee" });
  const values = [["deployFee()", fee], ["0.0066 OKB", parseEther("0.0066")], ["0.01 OKB", parseEther("0.01")]];
  const combos = [[10000n, 0n], [1000000n, 0n], [1000000n, 10000000000000n]];
  console.log("\nSimulation matrix (free, nothing sent):");
  for (const [vl, v] of values) for (const [sup, mp] of combos) {
    try {
      await pub.simulateContract({ account: me, address: factory, abi, functionName: "createCPU", args: ["TenderTrust", "TTRUST", "Procurement scoring circuits.", sup, mp], value: v });
      console.log("OK     value", vl, "supply", sup.toString(), "mintPrice", mp.toString());
    } catch (e) { console.log("REVERT value", vl, "supply", sup.toString(), "mintPrice", mp.toString(), "|", info(e)); }
  }
})().catch((e) => console.error("FAILED:", e.shortMessage || e.message));
