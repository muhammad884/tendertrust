const fs = require("fs");
const { createPublicClient, createWalletClient, http, defineChain, parseEther, keccak256, toHex, zeroAddress } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const chain = defineChain({
  id: 1952, name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech/terigon"] } },
});
const key = fs.readFileSync(".env", "utf8").match(/DEPLOYER_KEY=(0x[0-9a-fA-F]{64})/)[1];
const { abi } = JSON.parse(fs.readFileSync("build/TenderTrust.json", "utf8"));
const { contract } = JSON.parse(fs.readFileSync("deployment.json", "utf8"));

const org = privateKeyToAccount(key);
const A = privateKeyToAccount(keccak256(toHex(key + "bidderA")));
const B = privateKeyToAccount(keccak256(toHex(key + "bidderB")));
const pub = createPublicClient({ chain, transport: http() });
const wal = (acc) => createWalletClient({ account: acc, chain, transport: http() });
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const sim = (acc, fn, args) => pub.simulateContract({ account: acc, address: contract, abi, functionName: fn, args });
const read = (fn, args = []) => pub.readContract({ address: contract, abi, functionName: fn, args });

async function send(acc, fn, args) {
  let request, lastErr;
  for (let i = 0; i < 6; i++) {
    try { ({ request } = await sim(acc, fn, args)); break; }
    catch (e) { lastErr = e; await sleep(4); }
  }
  if (!request) throw lastErr;
  const hash = await wal(acc).writeContract(request);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(fn + " failed onchain");
  console.log("  tx", fn, hash);
  await sleep(3);
  return r;
}

async function expectRevert(label, acc, fn, args, expected) {
  let last = "";
  for (let i = 0; i < 6; i++) {
    try {
      await sim(acc, fn, args);
      last = "did not revert";
    } catch (e) {
      const msg = e.shortMessage || e.message;
      if (msg.includes(expected)) { console.log("PASS:", label, "->", expected); return; }
      last = msg.split("\n").pop();
    }
    await sleep(4);
  }
  console.log("FAIL:", label, "| expected:", expected, "| got:", last);
  process.exitCode = 1;
}

async function waitUntil(ts, label) {
  console.log("Waiting for", label, "...");
  while ((await pub.getBlock()).timestamp < ts) await sleep(5);
  await sleep(8);
}

async function main() {
  for (const b of [A, B]) {
    if ((await pub.getBalance({ address: b.address })) < parseEther("0.01")) {
      const h = await wal(org).sendTransaction({ to: b.address, value: parseEther("0.02") });
      await pub.waitForTransactionReceipt({ hash: h });
      console.log("Funded bidder", b.address);
    }
  }

  const now = (await pub.getBlock()).timestamp;
  const commitDL = now + 100n, revealDL = now + 190n;
  const budget = 1000000n;

  console.log("1. Create tender");
  const rc = await send(org, "createTender", ["ipfs://demo-tender-1", keccak256(toHex("rules-v1")), budget, commitDL, revealDL, zeroAddress, 0n]);
  const id = BigInt(rc.logs[0].topics[1]);
  console.log("  tender id:", id);

  const bids = [
    { acc: A, price: 800000n, tech: 12, exp: 10, del: 9 },
    { acc: B, price: 600000n, tech: 8, exp: 9, del: 7 },
  ];
  for (const b of bids) {
    b.ph = keccak256(toHex("proposal-" + b.acc.address));
    b.salt = keccak256(toHex("salt-" + b.acc.address + Date.now()));
    for (let i = 0; i < 6 && !b.commitment; i++) {
      try { b.commitment = await read("computeCommitment", [id, b.acc.address, b.price, b.ph, b.salt]); }
      catch (e) { await sleep(4); }
    }
  }

  console.log("2. Commit phase");
  await expectRevert("organizer cannot bid", org, "commitBid", [id, bids[0].commitment], "Organizer cannot bid");
  await expectRevert("empty commitment", A, "commitBid", [id, "0x" + "00".repeat(32)], "Empty commitment");
  await send(A, "commitBid", [id, bids[0].commitment]);
  await send(B, "commitBid", [id, bids[1].commitment]);
  await expectRevert("duplicate commit", A, "commitBid", [id, bids[0].commitment], "Already committed");
  await expectRevert("reveal too early", A, "revealBid", [id, bids[0].price, bids[0].ph, bids[0].salt], "Not reveal phase");

  await waitUntil(commitDL, "commit deadline");
  console.log("3. Reveal phase");
  await expectRevert("commit after deadline", A, "commitBid", [id, bids[0].commitment], "Commit phase over");
  await expectRevert("wrong salt", A, "revealBid", [id, bids[0].price, bids[0].ph, keccak256(toHex("bad"))], "Commitment mismatch");
  for (const b of bids) await send(b.acc, "revealBid", [id, b.price, b.ph, b.salt]);

  await waitUntil(revealDL, "reveal deadline");
  console.log("4. Evaluation");
  await expectRevert("non-organizer evaluate", A, "evaluate", [id, A.address, 12, 10, 9, true, 99], "Only organizer");
  await expectRevert("finalize before evaluation", A, "finalize", [id], "Evaluation incomplete");
  for (const b of bids) {
    const ps = await read("scoreForPrice", [b.price, budget]);
    const total = await read("weightedScore", [b.tech, b.exp, b.del, ps]);
    console.log("  bidder", b.acc.address.slice(0, 8), "priceScore", ps, "total", total);
    await expectRevert("wrong circuit total", org, "evaluate", [id, b.acc.address, b.tech, b.exp, b.del, true, total + 1], "Circuit result mismatch");
    await send(org, "evaluate", [id, b.acc.address, b.tech, b.exp, b.del, true, total]);
  }

  console.log("5. Finalize");
  await send(A, "finalize", [id]);
  let t;
  for (let i = 0; i < 6; i++) {
    t = await read("getTender", [id]);
    if (t.finalized) break;
    await sleep(4);
  }
  console.log("WINNER:", t.winner, "score", t.winnerScore);
  console.log(t.winner === A.address ? "PASS: higher quality beat lower price" : "FAIL: unexpected winner");
}
main().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
