const fs = require("fs");
const { createPublicClient, http, defineChain, keccak256, toHex } = require("viem");
const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const pub = createPublicClient({ chain, transport: http(url, { retryCount: 6, retryDelay: 1500, timeout: 30000 }) });
const { abi } = JSON.parse(fs.readFileSync("build/TenderTrustV2.json", "utf8"));
const contract = JSON.parse(fs.readFileSync("deployment_mainnet_v2.json", "utf8")).contract;
const N = BigInt(process.argv[2] || "0");
const note = process.argv[3] || "Created and run through the website by separate wallets: one organizer and two bidders.";
if (N < 1n) { console.log("Usage: node collect_evidence_n.js <tenderId> [note]"); process.exit(1); }

const sel = {
  created: keccak256(toHex("TenderCreated(uint256,address,bytes32,string,uint256,uint64,uint64,address,uint256)")),
  committed: keccak256(toHex("BidCommitted(uint256,address,bytes32)")),
  revealed: keccak256(toHex("BidRevealed(uint256,address,uint256,bytes32)")),
  evaluated: keccak256(toHex("BidEvaluated(uint256,address,bool,uint8,uint8,uint8,uint8,uint16)")),
  finalized: keccak256(toHex("TenderFinalized(uint256,address,uint16)")),
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
  const from = blockAt(t.commitDeadline - 5400n) - 50n;
  console.log("Tender", N.toString(), "| scanning blocks", from.toString(), "to", latest.toString(), "(100-block chunks)");

  const txs = {};
  let calls = 0;
  for (let s = from; s <= latest && calls < 400; s += 90n, calls++) {
    const e = s + 89n > latest ? latest : s + 89n;
    const logs = await rc(() => pub.getLogs({ address: contract, fromBlock: s, toBlock: e }));
    for (const l of logs) {
      if (!l.topics[1] || BigInt(l.topics[1]) !== N) continue;
      const who = l.topics[2] ? short(addrOf(l.topics[2])) : "";
      if (l.topics[0] === sel.created) txs["createTender"] = l.transactionHash;
      else if (l.topics[0] === sel.committed) txs["commit " + who] = l.transactionHash;
      else if (l.topics[0] === sel.revealed) txs["reveal " + who] = l.transactionHash;
      else if (l.topics[0] === sel.evaluated) txs["evaluate " + who] = l.transactionHash;
      else if (l.topics[0] === sel.finalized) txs["finalize"] = l.transactionHash;
    }
  }
  console.log("Collected", Object.keys(txs).length, "transactions:");
  Object.keys(txs).forEach((k) => console.log("  ", k));
  fs.writeFileSync("evidence_tender_" + N + ".json", JSON.stringify({ tenderId: Number(N), contract, note, txs }, null, 2));
  console.log("Saved evidence_tender_" + N + ".json | finalized:", t.finalized);
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
