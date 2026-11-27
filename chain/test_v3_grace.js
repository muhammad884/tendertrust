const fs = require("fs");
const { createPublicClient, createWalletClient, http, defineChain, parseEther, formatEther, keccak256, toHex } = require("viem");
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
const A = mk("bidA"), B = mk("bidB");
const pub = createPublicClient({ chain, transport: tr });
const wal = (acc) => createWalletClient({ account: acc, chain, transport: tr });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STATE = "v3_grace_state.json";
const txs = {};
let passed = 0, failed = 0;

const check = (name, ok, extra) => { if (ok) { passed++; console.log("PASS:", name, extra || ""); } else { failed++; console.log("FAIL:", name, extra || ""); } };
const sim = (acc, fn, args) => pub.simulateContract({ account: acc, address: contract, abi, functionName: fn, args });
async function rd(fn, args = []) {
  let last;
  for (let i = 0; i < 6; i++) { try { return await pub.readContract({ address: contract, abi, functionName: fn, args }); } catch (e) { last = e; await sleep(2500); } }
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

async function start() {
  console.log("Organizer balance:", formatEther(await pub.getBalance({ address: org.address })), "OKB");
  for (const w of [...EV, A, B]) {
    if ((await pub.getBalance({ address: w.address })) < parseEther("0.00005")) {
      const h = await wal(org).sendTransaction({ to: w.address, value: parseEther("0.0001") });
      await pub.waitForTransactionReceipt({ hash: h });
      console.log("Funded", w.address);
      await sleep(1500);
    }
  }
  const rulesHash = keccak256(toHex("tendertrust-v3 grace-period test"));
  const now = (await pub.getBlock()).timestamp;
  const commitDL = now + 100n, revealDL = now + 190n, evalDL = now + 330n;
  const rc = await send(org, "createTender", "createTender", [{
    metadataURI: "demo:v3-grace-test", rulesHash, budget: 1000000n,
    commitDeadline: commitDL, revealDeadline: revealDL, evalDeadline: evalDL,
    tapeProcessor: processor, tapeCircuitId: circuitId,
    evaluators: [EV[0].address, EV[1].address, EV[2].address],
  }]);
  const id = BigInt(rc.logs[0].topics[1]);
  console.log("  tender id:", id.toString());
  const bids = [{ n: "A", acc: A, price: 800000n }, { n: "B", acc: B, price: 600000n }];
  for (const b of bids) {
    b.ph = keccak256(toHex("grace proposal " + b.n));
    b.salt = keccak256(toHex("grace salt " + b.n + Date.now()));
    b.commitment = await rd("computeCommitment", [id, b.acc.address, b.price, b.ph, b.salt]);
    await send(b.acc, "commit" + b.n, "commitBid", [id, b.commitment]);
  }
  await waitUntil(commitDL, "commit deadline");
  for (const b of bids) await send(b.acc, "reveal" + b.n, "revealBid", [id, b.price, b.ph, b.salt]);
  await waitUntil(revealDL, "reveal deadline");

  await send(EV[0], "scoreA_E1", "submitScores", [id, A.address, 12, 10, 9, true, J("A1")]);
  await send(EV[1], "scoreA_E2", "submitScores", [id, A.address, 14, 12, 11, true, J("A2")]);
  await send(EV[0], "scoreB_E1", "submitScores", [id, B.address, 8, 9, 7, true, J("B1")]);
  await expectRevert("2 of 3 evaluations: no settlement before the evaluation deadline", org, "settleBid", [id, A.address], "Not enough evaluations");

  await waitUntil(evalDL, "evaluation deadline");
  await send(org, "settleA", "settleBid", [id, A.address]);
  let bA;
  for (let i = 0; i < 8; i++) { bA = await rd("getBid", [id, A.address]); if (bA.evaluated) break; await sleep(3000); }
  check("after the deadline, bid A settles with 2 evaluations (lower value of the two)", Number(bA.total) === 99 && bA.eligible === true, "total " + bA.total);
  await expectRevert("bid B with only 1 evaluation cannot be settled", org, "settleBid", [id, B.address], "Not enough evaluations");
  await expectRevert("finalize is refused before the one-day grace period", org, "finalize", [id], "Evaluation incomplete");

  const graceAt = evalDL + 86400n;
  fs.writeFileSync(STATE, JSON.stringify({ tenderId: Number(id), graceAt: graceAt.toString(), txs, passed, failed }, null, 2));
  console.log("\nPART 1 DONE:", passed, "passed,", failed, "failed.");
  console.log("Run 'node test_v3_grace.js finish' after", new Date(Number(graceAt) * 1000).toLocaleString());
}

async function finish() {
  const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
  Object.assign(txs, st.txs);
  passed = st.passed; failed = st.failed;
  const id = BigInt(st.tenderId), graceAt = BigInt(st.graceAt);
  const nowTs = (await pub.getBlock()).timestamp;
  if (nowTs < graceAt) { console.log("The grace period is not over yet. About", (Number(graceAt - nowTs) / 3600).toFixed(1), "hours remain."); return; }
  await send(org, "finalize", "finalize", [id]);
  let t;
  for (let i = 0; i < 8; i++) { t = await rd("getTender", [id]); if (t.finalized) break; await sleep(3000); }
  check("after the grace period the tender finalizes although bid B was never settled", t.finalized === true);
  check("winner is bid A with 99", t.winner === A.address && Number(t.winnerScore) === 99);
  const bB = await rd("getBid", [id, B.address]);
  check("bid B stayed unsettled and not eligible", bB.evaluated === false && bB.eligible === false);
  await expectRevert("settling after finalization is rejected", org, "settleBid", [id, B.address], "Finalized");
  console.log("\nGRACE TEST:", passed, "passed,", failed, "failed");
  fs.writeFileSync("v3_grace_results.json", JSON.stringify({ contract, tenderId: Number(id), passed, failed, txs }, null, 2));
  console.log("Saved v3_grace_results.json");
}

const mode = process.argv[2];
(mode === "start" ? start() : mode === "finish" ? finish() : Promise.reject(new Error("Usage: node test_v3_grace.js start | finish")))
  .catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
