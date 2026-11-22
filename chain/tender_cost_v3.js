const fs = require("fs");
const { createPublicClient, http, defineChain, formatEther } = require("viem");
const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const pub = createPublicClient({ chain, transport: http(url, { retryCount: 6, retryDelay: 1500, timeout: 30000 }) });
const N = process.argv[2];
if (!N) { console.log("Usage: node tender_cost.js <tenderId>"); process.exit(1); }
const ev = JSON.parse(fs.readFileSync("evidence_v3_tender_" + N + ".json", "utf8"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let totalGas = 0n, totalFee = 0n, totalL1 = 0n;
  for (const [k, h] of Object.entries(ev.txs)) {
    let raw;
    for (let i = 0; i < 5 && !raw; i++) {
      try { raw = await pub.request({ method: "eth_getTransactionReceipt", params: [h] }); } catch { await wait(2000); }
    }
    if (!raw) { console.log(k, "could not be read"); continue; }
    const gas = BigInt(raw.gasUsed);
    const price = BigInt(raw.effectiveGasPrice || "0x0");
    const l1 = BigInt(raw.l1Fee || "0x0");
    const fee = gas * price + l1;
    totalGas += gas; totalFee += fee; totalL1 += l1;
    console.log(k.padEnd(26), "gas", gas.toString().padStart(8), "| fee", formatEther(fee), "OKB");
  }
  console.log("\nTender", N, "TOTAL gas:", totalGas.toString());
  console.log("TOTAL fee:", formatEther(totalFee), "OKB (of which L1 data fee:", formatEther(totalL1) + " OKB)");
  console.log("Multiply by the current OKB price (in dollars) to get the real cost of one tender with 2 bidders.");
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
