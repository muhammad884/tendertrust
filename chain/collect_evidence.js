const fs = require("fs");
const { createPublicClient, http, defineChain, keccak256, toHex } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const pub = createPublicClient({ chain, transport: http(url, { retryCount: 6, retryDelay: 1500, timeout: 30000 }) });
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const { abi } = JSON.parse(fs.readFileSync("build/TenderTrustV2.json", "utf8"));
const dep = JSON.parse(fs.readFileSync("deployment_mainnet_v2.json", "utf8"));
const contract = dep.contract, processor = dep.processor, circuitId = dep.circuitId;
const ID = 1n;
const mk = (label) => privateKeyToAccount(keccak256(toHex(key + label))).address;
const bidders = { A: mk("mainnet-bidderA"), B: mk("mainnet-bidderB"), C: mk("mainnet-bidderC") };
const who = {};
Object.entries(bidders).forEach(([k, v]) => (who[v.toLowerCase()] = k));
const addrOf = (t) => "0x" + t.slice(26);
const sel = {
  created: keccak256(toHex("TenderCreated(uint256,address,bytes32,string,uint256,uint64,uint64,address,uint256)")),
  committed: keccak256(toHex("BidCommitted(uint256,address,bytes32)")),
  revealed: keccak256(toHex("BidRevealed(uint256,address,uint256,bytes32)")),
  evaluated: keccak256(toHex("BidEvaluated(uint256,address,bool,uint8,uint8,uint8,uint8,uint16)")),
  finalized: keccak256(toHex("TenderFinalized(uint256,address,uint16)")),
};
const short = (e) => ((e.shortMessage || e.message || "").split("\n")[0] + " | " + (e.details || "")).slice(0, 140);
const found = {};

function handle(logs) {
  for (const l of logs) {
    if (!l.topics[1] || BigInt(l.topics[1]) !== ID) continue;
    const w = l.topics[2] ? who[addrOf(l.topics[2]).toLowerCase()] : undefined;
    if (l.topics[0] === sel.created) found.createTender = l.transactionHash;
    else if (l.topics[0] === sel.committed && w) found["commit" + w] = l.transactionHash;
    else if (l.topics[0] === sel.revealed && w) found["reveal" + w] = l.transactionHash;
    else if (l.topics[0] === sel.evaluated && w) found["evaluate" + w] = l.transactionHash;
    else if (l.topics[0] === sel.finalized) found.finalize = l.transactionHash;
  }
}

(async () => {
  const t = await pub.readContract({ address: contract, abi, functionName: "getTender", args: [ID] });
  const bids = {};
  for (const k of Object.keys(bidders)) {
    const b = await pub.readContract({ address: contract, abi, functionName: "getBid", args: [ID, bidders[k]] });
    bids[k] = { address: bidders[k], eligible: b.eligible, total: Number(b.total), priceScore: Number(b.priceScore) };
  }
  console.log("Tender finalized:", t.finalized, "| winner:", t.winner, "| score", t.winnerScore);

  let logsOk = false;
  try {
    const latest = await pub.getBlockNumber();
    const older = latest > 20000n ? latest - 20000n : 1n;
    const bl = await pub.getBlock({ blockNumber: latest });
    const bo = await pub.getBlock({ blockNumber: older });
    const bt = Number(bl.timestamp - bo.timestamp) / Number(latest - older);
    console.log("OK   block time (s/block):", bt.toFixed(2));
    const blockAt = (ts) => { const n = latest - BigInt(Math.round(Number(bl.timestamp - ts) / bt)); return n < 1n ? 1n : n > latest ? latest : n; };
    const windows = [
      [blockAt(t.commitDeadline - 400n), blockAt(t.revealDeadline + 400n)],
      [latest - BigInt(Math.ceil(2400 / bt)), latest],
    ];
    let size = null;
    for (const sz of [500, 200, 50, 10]) {
      try {
        await pub.getLogs({ address: contract, fromBlock: windows[0][0], toBlock: windows[0][0] + BigInt(sz) - 1n });
        size = sz; console.log("OK   getLogs works with range", sz); break;
      } catch (e) { console.log("FAIL getLogs range", sz, "|", short(e)); }
    }
    if (size) {
      for (const [from, to] of windows) {
        for (let s = from; s <= to; s += BigInt(size)) {
          const e = s + BigInt(size) - 1n > to ? to : s + BigInt(size) - 1n;
          handle(await pub.getLogs({ address: contract, fromBlock: s, toBlock: e }));
        }
      }
      logsOk = true;
    }
  } catch (e) { console.log("FAIL log collection |", short(e)); }

  const expected = ["createTender", "commitA", "commitB", "commitC", "revealA", "revealB", "revealC", "evaluateA", "evaluateB", "evaluateC", "finalize"];
  const missing = expected.filter((k) => !found[k]);
  console.log("Collected:", Object.keys(found).length + "/" + expected.length, missing.length ? "| missing: " + missing.join(", ") : "| all found");
  const evidence = {
    chainId: 196, contract, processor, circuitId, tenderId: Number(ID),
    winner: t.winner, winnerScore: Number(t.winnerScore), finalized: t.finalized, bids,
    txs: found, note: "Demo with our own test wallets (bidders A/B/C). Bidder C was cheapest with top scores but excluded because documents were not verified.",
  };
  fs.writeFileSync("mainnet_e2e_evidence.json", JSON.stringify(evidence, null, 2));
  console.log("Saved mainnet_e2e_evidence.json", logsOk ? "" : "(without tx hashes: take them from the explorer)");
  if (found.finalize) console.log("Finalize tx: https://www.okx.com/web3/explorer/xlayer/tx/" + found.finalize);
})().catch((e) => { console.error("FAILED:", short(e)); process.exit(1); });
