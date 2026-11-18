const fs = require("fs");
const { createPublicClient, http, defineChain, parseAbi, parseEther, formatEther, toFunctionSelector } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const me = privateKeyToAccount(key);
const pub = createPublicClient({ chain, transport: http(url) });
const factory = "0x1f09daefa827f02cbb40967cc91b259763760761";
const fAbi = parseAbi(["function cpus(uint256) view returns (address)"]);
const cAbi = parseAbi(["function transistors() view returns (address)"]);
const tAbi = parseAbi([
  "function mint(uint256 id, uint256 amount) payable",
  "function mintPrice() view returns (uint256)", "function protocolFee() view returns (uint256)",
  "function creator() view returns (address)", "function paused() view returns (bool)",
]);
const bAbi = parseAbi(["function implementation() view returns (address)"]);
const docs = {
  transistorBeacon: ["0x1059ad62cabb6a6925bb65aa617300556c60a51b", "0x265bf10fab9ddec0ee0a649c6b9db845f1b9a06b"],
  circuitBeacon: ["0xf70d1ed4f62cf3780157b0b421b7e2f45bd0991c", "0x977f217887e085d298cb3819cdad5a0ee35f29b2"],
};
const short = (e) => ((e.shortMessage || "").split("\n")[0] + " | " + (e.details || "")).slice(0, 110);

(async () => {
  console.log("Balance:", formatEther(await pub.getBalance({ address: me.address })));
  let tImpl;
  for (const [n, [b, docImpl]] of Object.entries(docs)) {
    try {
      const impl = (await pub.readContract({ address: b, abi: bAbi, functionName: "implementation" })).toLowerCase();
      console.log(n, "impl now", impl, impl === docImpl ? "(same as doc)" : "(CHANGED)");
      if (n === "transistorBeacon") tImpl = impl;
    } catch (e) { console.log(n, "read failed"); }
  }
  if (tImpl) {
    const code = await pub.getCode({ address: tImpl });
    console.log("mint(uint256,uint256) selector in impl:", code.includes("63" + toFunctionSelector("mint(uint256,uint256)").slice(2)));
  }
  for (const i of [422n, 419n, 423n]) {
    const circuits = await pub.readContract({ address: factory, abi: fAbi, functionName: "cpus", args: [i] });
    const tok = await pub.readContract({ address: circuits, abi: cAbi, functionName: "transistors" });
    const mp = await pub.readContract({ address: tok, abi: tAbi, functionName: "mintPrice" });
    const pf = await pub.readContract({ address: tok, abi: tAbi, functionName: "protocolFee" });
    const creator = await pub.readContract({ address: tok, abi: tAbi, functionName: "creator" });
    let paused = "n/a";
    try { paused = await pub.readContract({ address: tok, abi: tAbi, functionName: "paused" }); } catch {}
    console.log("\nCPU#" + i, "| transistors", tok, "| creator", creator, "| paused", paused);
    const tries = [
      ["me, 1 NAND, flat fee", me.address, 1n, 1n * mp + pf, undefined],
      ["me, 170 NAND, flat fee", me.address, 170n, 170n * mp + pf, undefined],
      ["me, 170 NAND, fee per NAND", me.address, 170n, 170n * (mp + pf), undefined],
      ["me, 170 NAND, 0.001 OKB", me.address, 170n, parseEther("0.001"), undefined],
      ["CREATOR, 170 NAND, flat fee", creator, 170n, 170n * mp + pf, [{ address: creator, balance: parseEther("1") }]],
    ];
    for (const [label, acc, amt, val, so] of tries) {
      try {
        await pub.simulateContract({ account: acc, address: tok, abi: tAbi, functionName: "mint", args: [0n, amt], value: val, stateOverride: so });
        console.log("  OK    ", label);
      } catch (e) { console.log("  REVERT", label, "|", short(e)); }
    }
  }
})().catch((e) => console.error("FAILED:", e.shortMessage || e.message));
