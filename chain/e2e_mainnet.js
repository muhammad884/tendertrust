const fs = require("fs");
const readline = require("readline");
const { createPublicClient, createWalletClient, http, defineChain, parseEther, formatEther, keccak256, toHex } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const { abi } = JSON.parse(fs.readFileSync("build/TenderTrustV2.json", "utf8"));
const dep = JSON.parse(fs.readFileSync("deployment_mainnet_v2.json", "utf8"));
const contract = dep.contract, processor = dep.processor, circuitId = BigInt(dep.circuitId);

const org = privateKeyToAccount(key);
const mk = (label) => privateKeyToAccount(keccak256(toHex(key + label)));
const A = mk("mainnet-bidderA"), B = mk("mainnet-bidderB"), C = mk("mainnet-bidderC");
const pub = createPublicClient({ chain, transport: http(url) });
const wal = (acc) => createWalletClient({ account: acc, chain, transport: http(url) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a); }); });
const sim = (acc, fn, args) => pub.simulateContract({ account: acc, address: contract, abi, functionName: fn, args });
const read = (fn, args = []) => pub.readContract({ address: contract, abi, functionName: fn, args });
const txs = {};
let failures = 0;

async function readUntil(fn, args, cond) {
  for (let i = 0; i < 8; i++) { const v = await read(fn, args); if (cond(v)) return v; await sleep(3000); }
  throw new Error("state not updated for " + fn);
}
async function send(acc, label, fn, args) {
  let request, lastErr;
  for (let i = 0; i < 6; i++) { try { ({ request } = await sim(acc, fn, args)); break; } catch (e) { lastErr = e; await sleep(4000); } }
  if (!request) throw lastErr;
  const hash = await wal(acc).writeContract(request);
  const r = await pub.waitForTransactionReceipt({ hash });
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
  while ((await pub.getBlock()).timestamp < ts) await sleep(5000);
  await sleep(8000);
}
const want = (t, e, d, p, ok) => (ok ? 4 * t + 3 * e + 2 * d + p : 0);

(async () => {
  const bal = await pub.getBalance({ address: org.address });
  console.log("Organizer wallet:", org.address, "| balance:", formatEther(bal), "OKB");
  console.log("TenderTrustV2:", contract, "\nProcessor:", processor, "| circuit id:", circuitId.toString());
  console.log("Bidders A/B/C:", A.address, B.address, C.address);
  console.log("Plan: fund 3 bidders (0.0002 OKB each, recoverable) + ~0.0003 OKB gas. Real mainnet transactions.");
  if (bal < parseEther("0.002")) { console.log("ABORT: balance too low."); return; }
  const ans = await ask("Type SEND to run the mainnet end-to-end test: ");
  if (ans.trim() !== "SEND") { console.log("Cancelled. Nothing sent."); return; }

  for (const b of [A, B, C]) {
    if ((await pub.getBalance({ address: b.address })) < parseEther("0.0001")) {
      const h = await wal(org).sendTransaction({ to: b.address, value: parseEther("0.0002") });
      await pub.waitForTransactionReceipt({ hash: h });
      console.log("Funded", b.address);
    }
  }

  const rulesHash = keccak256(toHex("tendertrust-rules-v1: technical 40, experience 30, delivery 20, price 10; circuit " + processor + "#" + circuitId));
  const budget = 1000000n;
  const now0 = (await pub.getBlock()).timestamp;
  console.log("\n0. Spec checks on createTender");
  const dl = [now0 + 100n, now0 + 200n];
  await expectRevert("processor must be a contract", org, "createTender", ["demo:x", rulesHash, budget, dl[0], dl[1], org.address, circuitId], "Processor not a contract");
  await expectRevert("circuit id 1 has another spec", org, "createTender", ["demo:x", rulesHash, budget, dl[0], dl[1], processor, 1n], "Circuit spec mismatch");
  await expectRevert("nonexistent circuit", org, "createTender", ["demo:x", rulesHash, budget, dl[0], dl[1], processor, 999999n], "no circuit");

  console.log("\n1. Create tender");
  const now = (await pub.getBlock()).timestamp;
  const commitDL = now + 100n, revealDL = now + 200n;
  const rc = await send(org, "createTender", "createTender", ["demo:mainnet-tender-1", rulesHash, budget, commitDL, revealDL, processor, circuitId]);
  const id = BigInt(rc.logs[0].topics[1]);
  console.log("  tender id:", id.toString());

  const bids = [
    { n: "A", acc: A, price: 800000n, t: 12, e: 10, d: 9, docs: true },
    { n: "B", acc: B, price: 600000n, t: 8, e: 9, d: 7, docs: true },
    { n: "C", acc: C, price: 300000n, t: 15, e: 15, d: 15, docs: false },
  ];
  for (const b of bids) {
    b.ph = keccak256(toHex("proposal-" + b.n + "-" + id));
    b.salt = keccak256(toHex("salt-" + b.n + "-" + Date.now()));
    for (let i = 0; i < 6 && !b.commitment; i++) {
      try { b.commitment = await read("computeCommitment", [id, b.acc.address, b.price, b.ph, b.salt]); } catch { await sleep(4000); }
    }
  }

  console.log("\n2. Commit phase");
  await expectRevert("organizer cannot bid", org, "commitBid", [id, bids[0].commitment], "Organizer cannot bid");
  await expectRevert("empty commitment", A, "commitBid", [id, "0x" + "00".repeat(32)], "Empty commitment");
  for (const b of bids) await send(b.acc, "commit" + b.n, "commitBid", [id, b.commitment]);
  await expectRevert("duplicate commit", A, "commitBid", [id, bids[0].commitment], "Already committed");
  await expectRevert("reveal too early", A, "revealBid", [id, bids[0].price, bids[0].ph, bids[0].salt], "Not reveal phase");

  await waitUntil(commitDL, "commit deadline");
  console.log("\n3. Reveal phase");
  await expectRevert("commit after deadline", A, "commitBid", [id, bids[0].commitment], "Commit phase over");
  await expectRevert("wrong salt", A, "revealBid", [id, bids[0].price, bids[0].ph, keccak256(toHex("bad"))], "Commitment mismatch");
  for (const b of bids) await send(b.acc, "reveal" + b.n, "revealBid", [id, b.price, b.ph, b.salt]);

  await waitUntil(revealDL, "reveal deadline");
  console.log("\n4. Evaluation (score computed by the TapeOut circuit inside the contract)");
  await expectRevert("non-organizer evaluate", A, "evaluate", [id, A.address, 12, 10, 9, true], "Only organizer");
  await expectRevert("finalize before evaluation", A, "finalize", [id], "Evaluation incomplete");
  for (const b of bids) {
    const pv = await read("previewScore", [id, b.t, b.e, b.d, b.price, b.docs && b.price <= budget]);
    const ps = Number(pv[1]);
    const w = want(b.t, b.e, b.d, ps, b.docs);
    console.log("  bidder", b.n, "preview total (circuit):", pv[0], "| priceScore", ps, "| formula:", w, Number(pv[0]) === w ? "MATCH" : "MISMATCH");
    if (Number(pv[0]) !== w) failures++;
    await send(org, "evaluate" + b.n, "evaluate", [id, b.acc.address, b.t, b.e, b.d, b.docs]);
  }
  for (const b of bids) {
    const r = await readUntil("getBid", [id, b.acc.address], (v) => v.evaluated);
    console.log("  bid", b.n, "| eligible:", r.eligible, "| total:", r.total, "| expected:", want(b.t, b.e, b.d, Number(r.priceScore), b.docs));
  }

  console.log("\n5. Finalize");
  await send(A, "finalize", "finalize", [id]);
  const t = await readUntil("getTender", [id], (v) => v.finalized);
  console.log("WINNER:", t.winner, "| score", t.winnerScore);
  const ok = t.winner === A.address && Number(t.winnerScore) === 99;
  console.log(ok ? "PASS: A wins with 99; C (cheapest, top scores) excluded because documents were not verified" : "FAIL: unexpected winner");
  if (!ok) failures++;

  const evidence = { chainId: 196, contract, processor, circuitId: Number(circuitId), tenderId: Number(id), winner: t.winner, winnerScore: Number(t.winnerScore), bidders: { A: A.address, B: B.address, C: C.address }, txs, failures };
  fs.writeFileSync("mainnet_e2e_evidence.json", JSON.stringify(evidence, null, 2));
  console.log("\nSaved mainnet_e2e_evidence.json | failures:", failures);
  console.log("Finalize tx: https://www.okx.com/web3/explorer/xlayer/tx/" + txs.finalize);
  console.log("Organizer balance now:", formatEther(await pub.getBalance({ address: org.address })), "OKB");
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
