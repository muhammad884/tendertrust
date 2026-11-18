const fs = require("fs");
const { createPublicClient, http, defineChain, parseAbi, parseEther, formatEther } = require("viem");
const url = "https://rpc.xlayer.tech";
const c = createPublicClient({
  chain: defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } }),
  transport: http(url),
});
const factory = "0x1f09daefa827f02cbb40967cc91b259763760761";
const fAbi = parseAbi(["function cpuCount() view returns (uint256)", "function cpus(uint256) view returns (address)"]);
const cAbi = parseAbi([
  "function nextId() view returns (uint256)",
  "function transistors() view returns (address)",
  "function TAPEOUT_FEE() view returns (uint256)",
  "function tapeout(bytes nl, uint32 nIn, uint32 nOut) payable returns (uint256)",
]);
const tAbi = parseAbi(["function creator() view returns (address)", "function balanceOf(address,uint256) view returns (uint256)"]);
const nl = fs.readFileSync("../circuit/score_netlist.hex", "utf8").trim();

(async () => {
  const count = await c.readContract({ address: factory, abi: fAbi, functionName: "cpuCount" });
  const addr = await c.readContract({ address: factory, abi: fAbi, functionName: "cpus", args: [count - 1n] });
  const tok = await c.readContract({ address: addr, abi: cAbi, functionName: "transistors" });
  const creator = await c.readContract({ address: tok, abi: tAbi, functionName: "creator" });
  const bal = await c.readContract({ address: tok, abi: tAbi, functionName: "balanceOf", args: [creator, 0n] });
  const fee = await c.readContract({ address: addr, abi: cAbi, functionName: "TAPEOUT_FEE" });
  const last = await c.readContract({ address: addr, abi: cAbi, functionName: "nextId" });
  console.log("Target circuits contract:", addr);
  console.log("NAND holder:", creator, "| NAND balance:", bal.toString(), "| fee:", formatEther(fee), "| circuits so far:", last.toString());
  console.log("Our netlist bytes:", (nl.length - 2) / 2);
  if (bal < 170n) { console.log("Holder has fewer than 170 NAND, cannot dry-run on this CPU."); return; }
  const call = {
    address: addr, abi: cAbi, functionName: "tapeout", args: [nl, 17, 8],
    account: creator, value: fee,
    stateOverride: [{ address: creator, balance: parseEther("1") }],
  };
  try {
    const sim = await c.simulateContract(call);
    console.log("DRY-RUN OK. It would create circuit id:", sim.result.toString());
    const gas = await c.estimateContractGas(call);
    console.log("Estimated tapeout gas:", gas.toString());
  } catch (e) {
    console.log("DRY-RUN FAILED:", (e.shortMessage || e.message).split("\n").slice(0, 4).join(" | "));
  }
})();
