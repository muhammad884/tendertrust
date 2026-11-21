const fs = require("fs");
const readline = require("readline");
const { createPublicClient, createWalletClient, http, defineChain, parseEther, formatEther, keccak256, toHex, zeroAddress } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const tr = http(url, { retryCount: 8, retryDelay: 1500, timeout: 30000 });
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const { abi } = JSON.parse(fs.readFileSync("build/TenderTrustV3.json", "utf8"));
const dep = JSON.parse(fs.readFileSync("deployment_mainnet_v3.json", "utf8"));
const contract = dep.contract, processor = dep.processor, circuitId = BigInt(dep.circuitId);

const org = privateKeyToAccount(key);
const mk = (l) => privateKeyToAccount(keccak256(toHex(key + "v3-" + l)));
const EV = [mk("eval1"), mk("eval2"), mk("eval3")];
const A = mk("bidA"), B = mk("bidB"), C = mk("bidC"), D = mk("bidD");
const pub = createPublicClient({ chain, transport: tr });
const wal = (acc) => createWalletClient({ account: acc, chain, transport: tr });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a); }); });
const ZERO32 = "0x" + "00".repeat(32);
const txs = {};
const results = [];
let passed = 0, failed = 0;

function check(name, cond, extra) {
  if (cond) { passed++; console.log("PASS:", name, extra || ""); } else { failed++; console.log("FAIL:", name, extra || ""); }
  results.push({ name, ok: !!cond });
}
const sim = (acc, fn, args) => pub.simulateContract({ account: acc, address: contract, abi, functionName: fn, args });
async function rd(fn, args = []) {
  let last;
  for (let i = 0; i < 6; i++) {
    try { return await pub.readContract({ address: contract, abi, functionName: fn, args }); } catch (e) { last = e; await sleep(2500); }
  }
  throw last;
}
async function send(acc, label, fn, args) {
  let request, lastErr;
  for (let i = 0; i < 6; i++) { try { ({ request } = await sim(acc, fn, args)); break; } catch (e) { lastErr = e; await sleep(4000); } }
  if (!request) throw lastErr;
  const hash = await wal(acc).writeContract(request);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(label + " failed onchain: " + hash);
  txs[label] = hash;
  console.log("  tx", label, hash.slice(0, 18) + "...");
  await sleep(2500);
  return r;
}
async function expectRevert(name, acc, fn, args, expected) {
  let last = "";
  for (let i = 0; i < 4; i++) {
    try { await sim(acc, fn, args); last = "did not revert"; }
    catch (e) {
      const msg = e.shortMessage || e.message;
      if (msg.includes(expected)) { check(name, true, "-> " + expected); return; }
      last = msg.split("\n").pop();
    }
    await sleep(3000);
  }
  check(name, false, "expected: " + expected + " | got: " + last);
}
async function waitUntil(ts, label) {
  console.log("Waiting for", label, "...");
  for (;;) {
    try { if ((await pub.getBlock()).timestamp >= ts) break; } catch (e) { console.log("  (network hiccup, retrying)"); }
    await sleep(4000);
  }
  await sleep(6000);
}
const J = (s) => keccak256(toHex("rationale: " + s));

(async () => {
  const bal = await pub.getBalance({ address: org.address });
  console.log("Organizer:", org.address, "| balance:", formatEther(bal), "OKB");
  console.log("TenderTrustV3:", contract, "\nProcessor:", processor, "| circuit", circuitId.toString());
  console.log("Plan: fund 7 test wallets (0.0001 OKB each) and run about 38 checks with about 20 real transactions.");
  if (bal < parseEther("0.001")) { console.log("ABORT: balance too low (need about 0.001 OKB)."); return; }
  const ans = await ask("Type SEND to run the V3 mainnet test: ");
  if (ans.trim() !== "SEND") { console.log("Cancelled. Nothing sent."); return; }

  for (const w of [...EV, A, B, C, D]) {
    if ((await pub.getBalance({ address: w.address })) < parseEther("0.00005")) {
      const h = await wal(org).sendTransaction({ to: w.address, value: parseEther("0.0001") });
      await pub.waitForTransactionReceipt({ hash: h });
      console.log("Funded", w.address);
      await sleep(1500);
    }
  }

  const rulesHash = keccak256(toHex("tendertrust-v3 rules: weights 40/30/20/10, 3 evaluators, median scores"));
  const T0 = (await pub.getBlock()).timestamp;
  const mkParams = (o = {}) => ({
    metadataURI: "demo:v3-test", rulesHash, budget: 1000000n,
    commitDeadline: T0 + 200n, revealDeadline: T0 + 300n, evalDeadline: T0 + 500n,
    tapeProcessor: processor, tapeCircuitId: circuitId,
    evaluators: [EV[0].address, EV[1].address, EV[2].address], ...o,
  });

  console.log("\n0. createTender validation (simulation only)");
  await expectRevert("processor must be a contract", org, "createTender", [mkParams({ tapeProcessor: org.address })], "Processor not a contract");
  await expectRevert("circuit id 1 has another spec", org, "createTender", [mkParams({ tapeCircuitId: 1n })], "Circuit spec mismatch");
  await expectRevert("nonexistent circuit", org, "createTender", [mkParams({ tapeCircuitId: 999999n })], "no circuit");
  await expectRevert("duplicate evaluators rejected", org, "createTender", [mkParams({ evaluators: [EV[0].address, EV[0].address, EV[2].address] })], "Duplicate evaluator");
  await expectRevert("zero-address evaluator rejected", org, "createTender", [mkParams({ evaluators: [EV[0].address, zeroAddress, EV[2].address] })], "Zero evaluator");
  await expectRevert("evaluation deadline must follow reveal", org, "createTender", [mkParams({ evalDeadline: T0 + 300n })], "Bad evaluation deadline");
  await expectRevert("evaluation window capped at 30 days", org, "createTender", [mkParams({ evalDeadline: T0 + 300n + 31n * 86400n })], "Bad evaluation deadline");
  await expectRevert("empty metadata rejected", org, "createTender", [mkParams({ metadataURI: "" })], "Missing metadata");
  await expectRevert("zero rules hash rejected", org, "createTender", [mkParams({ rulesHash: ZERO32 })], "Missing rules hash");
  await expectRevert("zero budget rejected", org, "createTender", [mkParams({ budget: 0n })], "Bad budget");

  console.log("\n1. Create the tender");
  const now = (await pub.getBlock()).timestamp;
  const commitDL = now + 120n, revealDL = now + 230n, evalDL = now + 420n;
  const rc = await send(org, "createTender", "createTender", [mkParams({ commitDeadline: commitDL, revealDeadline: revealDL, evalDeadline: evalDL })]);
  const id = BigInt(rc.logs[0].topics[1]);
  console.log("  tender id:", id.toString());
  check("evaluator list recorded", (await rd("isEvaluator", [id, EV[1].address])) === true && (await rd("isEvaluator", [id, A.address])) === false);

  const bids = [
    { n: "A", acc: A, price: 800000n },
    { n: "B", acc: B, price: 600000n },
    { n: "C", acc: C, price: 300000n },
    { n: "D", acc: D, price: 500000n },
  ];
  for (const b of bids) {
    b.ph = keccak256(toHex("v3 proposal " + b.n));
    b.salt = keccak256(toHex("v3 salt " + b.n + Date.now()));
    b.commitment = await rd("computeCommitment", [id, b.acc.address, b.price, b.ph, b.salt]);
  }

  console.log("\n2. Commit phase");
  await expectRevert("organizer cannot bid", org, "commitBid", [id, bids[0].commitment], "Organizer cannot bid");
  await expectRevert("an evaluator cannot bid", EV[0], "commitBid", [id, bids[0].commitment], "Evaluator cannot bid");
  await expectRevert("empty commitment rejected", A, "commitBid", [id, ZERO32], "Empty commitment");
  for (const b of bids) await send(b.acc, "commit" + b.n, "commitBid", [id, b.commitment]);
  await expectRevert("duplicate commit rejected", A, "commitBid", [id, bids[0].commitment], "Already committed");
  await expectRevert("reveal before the reveal phase", A, "revealBid", [id, bids[0].price, bids[0].ph, bids[0].salt], "Not reveal phase");
  await expectRevert("scoring before the evaluation phase", EV[0], "submitScores", [id, A.address, 12, 10, 9, true, J("early")], "Not evaluation phase");

  await waitUntil(commitDL, "commit deadline");
  console.log("\n3. Reveal phase (bidder D never reveals)");
  await expectRevert("commit after the deadline", A, "commitBid", [id, bids[0].commitment], "Commit phase over");
  await expectRevert("wrong salt rejected", A, "revealBid", [id, bids[0].price, bids[0].ph, keccak256(toHex("bad"))], "Commitment mismatch");
  for (const b of bids.slice(0, 3)) await send(b.acc, "reveal" + b.n, "revealBid", [id, b.price, b.ph, b.salt]);

  await waitUntil(revealDL, "reveal deadline");
  console.log("\n4. Evaluation phase");
  await expectRevert("the organizer cannot score", org, "submitScores", [id, A.address, 12, 10, 9, true, J("x")], "Only evaluator");
  await expectRevert("an unrevealed bid cannot be scored", EV[0], "submitScores", [id, D.address, 12, 10, 9, true, J("x")], "Bid not revealed");
  await expectRevert("score above 15 rejected", EV[0], "submitScores", [id, B.address, 16, 5, 5, true, J("x")], "Score too high");
  await expectRevert("justification is required", EV[0], "submitScores", [id, B.address, 5, 5, 5, true, ZERO32], "Missing justification");

  const score = (i, b, t, e, d, docs) => send(EV[i], "score" + b.n + "_E" + (i + 1), "submitScores", [id, b.acc.address, t, e, d, docs, J(b.n + " by evaluator " + (i + 1))]);
  // Bid A: evaluator 3 is an outlier and says documents are not verified
  await score(0, bids[0], 12, 10, 9, true);
  await score(1, bids[0], 14, 12, 11, true);
  await score(2, bids[0], 3, 2, 1, false);
  await expectRevert("an evaluator cannot score the same bid twice", EV[0], "submitScores", [id, A.address, 12, 10, 9, true, J("again")], "Already scored");
  // Bid B: all three agree
  await score(0, bids[1], 8, 9, 7, true);
  await score(1, bids[1], 8, 9, 7, true);
  await score(2, bids[1], 8, 9, 7, true);
  // Bid C: top scores but documents not verified by most evaluators; only two scores so far
  await score(0, bids[2], 15, 15, 15, false);
  await score(1, bids[2], 15, 15, 15, false);
  await expectRevert("cannot settle with 2 of 3 evaluations before the deadline", D, "settleBid", [id, C.address], "Not enough evaluations");
  await expectRevert("cannot finalize before bids are settled", D, "finalize", [id], "Evaluation incomplete");
  await score(2, bids[2], 15, 15, 15, true);

  console.log("\n5. Settle (anyone can do it: bidder D sends these)");
  for (const b of bids.slice(0, 3)) await send(D, "settle" + b.n, "settleBid", [id, b.acc.address]);
  const getB = async (b) => {
    for (let i = 0; i < 8; i++) { const v = await rd("getBid", [id, b.acc.address]); if (v.evaluated) return v; await sleep(3000); }
    throw new Error("state not updated");
  };
  const bA = await getB(bids[0]), bB = await getB(bids[1]), bC = await getB(bids[2]);
  check("bid A: median technical score is 12 (outlier 3 ignored)", Number(bA.tech) === 12, "got " + bA.tech);
  check("bid A: median experience 10 and delivery 9", Number(bA.experience) === 10 && Number(bA.delivery) === 9);
  check("bid A: 2 of 3 verified documents, so eligible", bA.eligible === true);
  check("bid A: circuit total is 99", Number(bA.total) === 99, "got " + bA.total);
  check("bid B: circuit total is 79", Number(bB.total) === 79 && bB.eligible === true, "got " + bB.total);
  check("bid C: top scores but documents not verified, so total 0", Number(bC.total) === 0 && bC.eligible === false);
  await expectRevert("a bid cannot be settled twice", D, "settleBid", [id, A.address], "Already settled");
  await expectRevert("scoring a settled bid is rejected", EV[0], "submitScores", [id, A.address, 1, 1, 1, true, J("late")], "Already settled");
  const pv = await rd("previewScore", [id, 12, 10, 9, 800000n, true]);
  check("previewScore matches the settled result", Number(pv[0]) === 99 && Number(pv[1]) === 3);

  console.log("\n6. Finalize (bidder D never revealed, so it does not block)");
  await send(D, "finalize", "finalize", [id]);
  let t;
  for (let i = 0; i < 8; i++) { t = await rd("getTender", [id]); if (t.finalized) break; await sleep(3000); }
  check("winner is bidder A with score 99", t.winner === A.address && Number(t.winnerScore) === 99, "winner " + t.winner);
  await expectRevert("finalize cannot run twice", D, "finalize", [id], "Already finalized");
  await expectRevert("scoring after finalize is rejected", EV[0], "submitScores", [id, B.address, 1, 1, 1, true, J("late")], "Finalized");
  await waitUntil(evalDL, "evaluation deadline");
  await expectRevert("scoring after the evaluation deadline is rejected", EV[0], "submitScores", [id, B.address, 1, 1, 1, true, J("late")], "Not evaluation phase");

  console.log("\nTESTS:", passed, "passed,", failed, "failed");
  fs.writeFileSync("v3_test_results.json", JSON.stringify({ contract, tenderId: Number(id), passed, failed, txs, results }, null, 2));
  console.log("Saved v3_test_results.json");
  console.log("Organizer balance now:", formatEther(await pub.getBalance({ address: org.address })), "OKB");
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
