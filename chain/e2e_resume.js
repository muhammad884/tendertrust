const fs = require("fs");
const { createPublicClient, createWalletClient, http, defineChain, formatEther, keccak256, toHex } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const tr = http(url, { retryCount: 8, retryDelay: 1500, timeout: 30000 });
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const { abi } = JSON.parse(fs.readFileSync("build/TenderTrustV2.json", "utf8"));
const dep = JSON.parse(fs.readFileSync("deployment_mainnet_v2.json", "utf8"));
const contract = dep.contract, processor = dep.processor, circuitId = BigInt(dep.circuitId);
const ID = 1n;

const org = privateKeyToAccount(key);
const mk = (label) => privateKeyToAccount(keccak256(toHex(key + label)));
const A = mk("mainnet-bidderA"), B = mk("mainnet-bidderB"), C = mk("mainnet-bidderC");
const pub = createPublicClient({ chain, transport: tr });
const wal = (acc) => createWalletClient({ account: acc, chain, transport: tr });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sim = (acc, fn, args) => pub.simulateContract({ account: acc, address: contract, abi, functionName: fn, args });
const addrOf = (t) => "0x" + t.slice(26);
const txs = {};
let failures = 0;

async function retryCall(fn, tries = 8) {
  let last;
  for (let i = 0; i < tries; i++) { try { return await fn(); } catch (e) { last = e; await sleep(3000); } }
  throw last;
}
const read = (fn, args = []) => retryCall(() => pub.readContract({ address: contract, abi, functionName: fn, args }));
async function readUntil(fn, args, cond) {
  for (let i = 0; i < 10; i++) { const v = await read(fn, args); if (cond(v)) return v; await sleep(3000); }
  throw new Error("state not updated for " + fn);
}
async function send(acc, label, fn, args) {
  let request, lastErr;
  for (let i = 0; i < 6; i++) { try { ({ request } = await sim(acc, fn, args)); break; } catch (e) { lastErr = e; await sleep(4000); } }
  if (!request) throw lastErr;
  const hash = await wal(acc).writeContract(request);
  const r = await retryCall(() => pub.waitForTransactionReceipt({ hash }));
  if (r.status !== "success") throw new Error(label + " failed onchain: " + hash);
  txs[label] = hash;
  console.log("  tx", label, hash.slice(0, 20) + "...");
  await sleep(3000);
  return r;
}
async function expectRevert(label, acc, fn, args, expected) {
  let last = "";
  for (let i = 0; i < 6; i++) {
    try { await sim(acc, fn, args); last = "did not revert"; }
    catch (e) {
      const msg = e.shortMessage || e.message;
      if (msg.includes(expected)) { console.log("PASS:", label, "->", expected); return; }
      last = msg.split("\n").pop();
    }
    await sleep(4000);
  }
  console.log("FAIL:", label, "| expected:", expected, "| got:", last);
  failures++;
}
async function waitUntil(ts, label) {
  console.log("Waiting for", label, "...");
  for (;;) {
    try { if ((await pub.getBlock()).timestamp >= ts) break; } catch (e) { console.log("  (network hiccup, retrying)"); }
    await sleep(5000);
  }
  await sleep(8000);
}
const want = (t, e, d, p, ok) => (ok ? 4 * t + 3 * e + 2 * d + p : 0);

async function blockAtOrAfter(ts) {
  let lo = 0n, hi = await retryCall(() => pub.getBlockNumber());
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const b = await retryCall(() => pub.getBlock({ blockNumber: mid }));
    if (b.timestamp < ts) lo = mid + 1n; else hi = mid;
  }
  return lo;
}
async function collectLogs(commitDeadline) {
  const sel = {
    created: keccak256(toHex("TenderCreated(uint256,address,bytes32,string,uint256,uint64,uint64,address,uint256)")),
    committed: keccak256(toHex("BidCommitted(uint256,address,bytes32)")),
    revealed: keccak256(toHex("BidRevealed(uint256,address,uint256,bytes32)")),
    evaluated: keccak256(toHex("BidEvaluated(uint256,address,bool,uint8,uint8,uint8,uint8,uint16)")),
    finalized: keccak256(toHex("TenderFinalized(uint256,address,uint16)")),
  };
  const who = { [A.address.toLowerCase()]: "A", [B.address.toLowerCase()]: "B", [C.address.toLowerCase()]: "C" };
  const found = {};
  const from = await blockAtOrAfter(commitDeadline - 150n);
  const latest = await retryCall(() => pub.getBlockNumber());
  for (let s = from; s <= latest; s += 500n) {
    const e = s + 499n > latest ? latest : s + 499n;
    const logs = await retryCall(() => pub.getLogs({ address: contract, fromBlock: s, toBlock: e }));
    for (const l of logs) {
      if (BigInt(l.topics[1]) !== ID) continue;
      const w = l.topics[2] ? who[addrOf(l.topics[2]).toLowerCase()] : undefined;
      if (l.topics[0] === sel.created) found.createTender = l.transactionHash;
      else if (l.topics[0] === sel.committed && w) found["commit" + w] = l.transactionHash;
      else if (l.topics[0] === sel.revealed && w) found["reveal" + w] = l.transactionHash;
      else if (l.topics[0] === sel.evaluated && w) found["evaluate" + w] = l.transactionHash;
      else if (l.topics[0] === sel.finalized) found.finalize = l.transactionHash;
    }
  }
  return found;
}

(async () => {
  console.log("Resuming mainnet test on tender", ID.toString());
  const t0 = await read("getTender", [ID]);
  if (t0.organizer.toLowerCase() !== org.address.toLowerCase() || t0.tapeProcessor.toLowerCase() !== processor.toLowerCase() || t0.tapeCircuitId !== circuitId) {
    console.log("ABORT: tender 1 does not match expected organizer/processor/circuit."); return;
  }
  console.log("Tender found | finalized:", t0.finalized, "| reveal deadline:", new Date(Number(t0.revealDeadline) * 1000).toLocaleString());

  const bids = [
    { n: "A", acc: A, price: 800000n, t: 12, e: 10, d: 9, docs: true },
    { n: "B", acc: B, price: 600000n, t: 8, e: 9, d: 7, docs: true },
    { n: "C", acc: C, price: 300000n, t: 15, e: 15, d: 15, docs: false },
  ];
  for (const b of bids) {
    b.cur = await read("getBid", [ID, b.acc.address]);
    console.log("bid", b.n, "| revealed:", b.cur.revealed, "| evaluated:", b.cur.evaluated);
  }
  const budget = t0.budget;

  await waitUntil(t0.revealDeadline, "reveal deadline");

  console.log("\n4. Evaluation (score computed by the TapeOut circuit inside the contract)");
  if (!t0.finalized && !bids.some((b) => b.cur.evaluated)) {
    await expectRevert("non-organizer evaluate", A, "evaluate", [ID, A.address, 12, 10, 9, true], "Only organizer");
    await expectRevert("finalize before evaluation", A, "finalize", [ID], "Evaluation incomplete");
  }
  for (const b of bids) {
    if (!b.cur.revealed || b.cur.evaluated) continue;
    const pv = await read("previewScore", [ID, b.t, b.e, b.d, b.price, b.docs && b.price <= budget]);
    const ps = Number(pv[1]);
    const w = want(b.t, b.e, b.d, ps, b.docs);
    console.log("  bidder", b.n, "preview total (circuit):", pv[0], "| priceScore", ps, "| formula:", w, Number(pv[0]) === w ? "MATCH" : "MISMATCH");
    if (Number(pv[0]) !== w) failures++;
    await send(org, "evaluate" + b.n, "evaluate", [ID, b.acc.address, b.t, b.e, b.d, b.docs]);
  }
  for (const b of bids) {
    if (!b.cur.revealed) continue;
    const r = await readUntil("getBid", [ID, b.acc.address], (v) => v.evaluated);
    console.log("  bid", b.n, "| eligible:", r.eligible, "| total:", r.total, "| expected:", want(b.t, b.e, b.d, Number(r.priceScore), b.docs));
  }

  console.log("\n5. Finalize");
  let t = await read("getTender", [ID]);
  if (!t.finalized) { await send(A, "finalize", "finalize", [ID]); t = await readUntil("getTender", [ID], (v) => v.finalized); }
  console.log("WINNER:", t.winner, "| score", t.winnerScore);
  const ok = t.winner === A.address && Number(t.winnerScore) === 99;
  console.log(ok ? "PASS: A wins with 99; C (cheapest, top scores) excluded because documents were not verified" : "FAIL: unexpected winner");
  if (!ok) failures++;

  console.log("\nCollecting full transaction hashes from the chain...");
  const found = await collectLogs(t0.commitDeadline);
  const all = { ...found, ...txs };
  const evidence = { chainId: 196, contract, processor, circuitId: Number(circuitId), tenderId: Number(ID), winner: t.winner, winnerScore: Number(t.winnerScore), bidders: { A: A.address, B: B.address, C: C.address }, txs: all, failures };
  fs.writeFileSync("mainnet_e2e_evidence.json", JSON.stringify(evidence, null, 2));
  console.log("Transactions recorded:", Object.keys(all).join(", "));
  console.log("Saved mainnet_e2e_evidence.json | failures:", failures);
  if (all.finalize) console.log("Finalize tx: https://www.okx.com/web3/explorer/xlayer/tx/" + all.finalize);
  console.log("Organizer balance now:", formatEther(await pub.getBalance({ address: org.address })), "OKB");
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
