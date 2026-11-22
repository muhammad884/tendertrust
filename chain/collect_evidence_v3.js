const fs = require("fs");
const { createPublicClient, http, defineChain, keccak256, toHex } = require("viem");
const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const pub = createPublicClient({ chain, transport: http(url, { retryCount: 6, retryDelay: 1500, timeout: 30000 }) });
const { abi } = JSON.parse(fs.readFileSync("build/TenderTrustV3.json", "utf8"));
const contract = JSON.parse(fs.readFileSync("deployment_mainnet_v3.json", "utf8")).contract;
const N = BigInt(process.argv[2] || "0");
const note = process.argv[3] || "Created and run through the website with separate test wallets: one organizer, three evaluators and two bidders. One evaluator gave an outlier score and the median ignored it.";
if (N < 1n) { console.log("Usage: node collect_evidence_v3.js <tenderId> [note]"); process.exit(1); }
const sig = (s) => keccak256(toHex(s));
const sel = {
  created: sig("TenderCreated(uint256,address,bytes32,string,uint256)"),
  committed: sig("BidCommitted(uint256,address,bytes32)"),
  revealed: sig("BidRevealed(uint256,address,uint256,bytes32)"),
  scored: sig("ScoreSubmitted(uint256,address,address,bytes32)"),
  settled: sig("BidSettled(uint256,address,bool,uint16)"),
  finalized: sig("TenderFinalized(uint256,address,uint16)"),
};
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const addrOf = (t) => "0x" + t.slice(26);
async function rc(fn, tries = 6) {
  let last;
  for (let i = 0; i < tries; i++) { try { return await fn(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2500)); } }
  throw last;
}
(async () => {
  const t = await rc(() => pub.readContract({ address: contract, abi, functionName: "getTender", args: [N] }));
  const latest = await rc(() => pub.getBlockNumber());
  const bl = await rc(() => pub.getBlock({ blockNumber: latest }));
  const old = latest > 20000n ? latest - 20000n : 1n;
  const bo = await rc(() => pub.getBlock({ blockNumber: old }));
  const bt = Number(bl.timestamp - bo.timestamp) / Number(latest - old);
  const blockAt = (ts) => { const n = latest - BigInt(Math.round(Number(bl.timestamp - ts) / bt)); return n < 1n ? 1n : n > latest ? latest : n; };
  const from = blockAt(t.commitDeadline - 1800n) - 50n;
  console.log("Tender", N.toString(), "| scanning blocks", from.toString(), "to", latest.toString());
  const txs = {};
  let calls = 0;
  for (let s = from; s <= latest && calls < 600; s += 90n, calls++) {
    const e = s + 89n > latest ? latest : s + 89n;
    const logs = await rc(() => pub.getLogs({ address: contract, fromBlock: s, toBlock: e }));
    for (const l of logs) {
      if (!l.topics[1] || BigInt(l.topics[1]) !== N) continue;
      const a2 = l.topics[2] ? short(addrOf(l.topics[2])) : "";
      const a3 = l.topics[3] ? short(addrOf(l.topics[3])) : "";
      const h = l.transactionHash;
      if (l.topics[0] === sel.created) txs["createTender"] = h;
      else if (l.topics[0] === sel.committed) txs["commit " + a2] = h;
      else if (l.topics[0] === sel.revealed) txs["reveal " + a2] = h;
      else if (l.topics[0] === sel.scored) txs["score " + a3 + " on " + a2] = h;
      else if (l.topics[0] === sel.settled) txs["settle " + a2] = h;
      else if (l.topics[0] === sel.finalized) txs["finalize"] = h;
    }
  }
  console.log("Collected", Object.keys(txs).length, "transactions (expected 14 for 2 bidders and 3 evaluators):");
  Object.keys(txs).forEach((k) => console.log("  ", k));
  fs.writeFileSync("evidence_v3_tender_" + N + ".json", JSON.stringify({ tenderId: Number(N), contract, note, txs }, null, 2));
  console.log("Saved evidence_v3_tender_" + N + ".json | finalized:", t.finalized);
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
