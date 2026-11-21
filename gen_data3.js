const fs = require("fs");
const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const d3 = rd("chain/deployment_mainnet_v3.json");
const m = rd("chain/mainnet_deployment.json");
const abi3 = rd("chain/build/TenderTrustV3.json").abi;
fs.writeFileSync("frontend/src/lib/TenderTrustV3.abi.ts", "export const tenderTrustAbi = " + JSON.stringify(abi3) + " as const;\n");
const byTender = {};
for (const f of fs.readdirSync("chain")) {
  if (!/^evidence_v3_tender_\d+\.json$/.test(f)) continue;
  const e = rd("chain/" + f);
  byTender[String(e.tenderId)] = { note: e.note, txs: e.txs };
}
if (fs.existsSync("chain/v3_test_results.json")) {
  const r = rd("chain/v3_test_results.json");
  byTender[String(r.tenderId)] = {
    note: "Automated mainnet test run with our own test wallets: " + r.passed + " checks passed, " + r.failed + " failed. Three evaluators and four bidders (one never revealed). Bidder A won with 99 after the median ignored an outlier score.",
    txs: r.txs,
  };
}
const dep = { chainId: 196, contract: d3.contract, deployTx: d3.txHash, processor: d3.processor, circuitId: d3.circuitId, tapeoutTx: m.txTapeout };
fs.writeFileSync(
  "frontend/src/lib/deployment3.ts",
  "export const deployment = " + JSON.stringify(dep, null, 2) + " as const;\nexport const evidenceByTender: Record<string, { note: string; txs: Record<string, string> }> = " + JSON.stringify(byTender, null, 2) + ";\n",
);
console.log("OK V3 contract", d3.contract, "| evidence for V3 tenders:", Object.keys(byTender).join(", "));
