const fs = require("fs");
const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const d = rd("chain/deployment_mainnet_v2.json");
const m = rd("chain/mainnet_deployment.json");
const abi = rd("chain/build/TenderTrustV2.json").abi;
fs.mkdirSync("frontend/src/lib", { recursive: true });
fs.writeFileSync("frontend/src/lib/TenderTrustV2.abi.ts", "export const tenderTrustAbi = " + JSON.stringify(abi) + " as const;\n");
const dep = { chainId: 196, contract: d.contract, deployTx: d.txHash, processor: m.processor, circuitId: m.circuitId, tapeoutTx: m.txTapeout, mintTx: m.txMint };
const byTender = {};
const e1 = rd("chain/mainnet_e2e_evidence.json");
byTender[String(e1.tenderId)] = { note: e1.note, txs: e1.txs };
for (const f of fs.readdirSync("chain")) {
  if (!/^evidence_tender_\d+\.json$/.test(f)) continue;
  const e = rd("chain/" + f);
  byTender[String(e.tenderId)] = { note: e.note, txs: e.txs };
}
fs.writeFileSync("frontend/src/lib/deployment.ts", "export const deployment = " + JSON.stringify(dep, null, 2) + " as const;\nexport const evidenceByTender = " + JSON.stringify(byTender, null, 2) + " as const;\n");
console.log("OK evidence for tenders:", Object.keys(byTender).join(", "));
