const fs = require("fs");
const readline = require("readline");
const { createPublicClient, createWalletClient, http, defineChain, parseAbi, formatEther } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const me = privateKeyToAccount(key);
const pub = createPublicClient({ chain, transport: http(url) });
const wal = createWalletClient({ account: me, chain, transport: http(url) });
const { abi, bytecode } = JSON.parse(fs.readFileSync("build/TenderTrustV2.json", "utf8"));
const circuit = JSON.parse(fs.readFileSync("mainnet_deployment.json", "utf8"));
const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (fs.existsSync("deployment_mainnet_v2.json")) { console.log("Already deployed:\n" + fs.readFileSync("deployment_mainnet_v2.json", "utf8")); return; }
  const bal = await pub.getBalance({ address: me.address });
  const gas = await pub.estimateGas({ account: me.address, data: bytecode });
  const gp = await pub.getGasPrice();
  const cost = gas * gp;
  console.log("Wallet:", me.address, "| balance:", formatEther(bal), "OKB");
  console.log("Estimated deploy gas:", gas.toString(), "| estimated cost:", formatEther(cost), "OKB");
  if (cost > 1000000000000000n || cost > bal) { console.log("ABORT: cost too high or balance too low."); return; }
  const ans = await new Promise((res) => ask("Type SEND to deploy TenderTrustV2 to X Layer MAINNET: ").then(res));
  if (ans.trim() !== "SEND") { console.log("Cancelled. Nothing sent."); return; }

  const hash = await wal.deployContract({ abi, bytecode });
  console.log("Deploy tx:", hash);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error("deploy reverted: " + hash);
  console.log("Status:", r.status, "| contract:", r.contractAddress);

  const a = parseAbi(["function CIRCUIT_N_IN() view returns (uint32)", "function tenderCount() view returns (uint256)"]);
  let nIn;
  for (let i = 0; i < 8 && nIn === undefined; i++) {
    try { nIn = await pub.readContract({ address: r.contractAddress, abi: a, functionName: "CIRCUIT_N_IN" }); } catch { await sleep(3000); }
  }
  console.log("Sanity check CIRCUIT_N_IN =", nIn, nIn === 17 ? "(OK)" : "(PROBLEM)");
  fs.writeFileSync("deployment_mainnet_v2.json", JSON.stringify({ chainId: 196, contract: r.contractAddress, txHash: hash, processor: circuit.processor, circuitId: circuit.circuitId }, null, 2));
  console.log("Saved deployment_mainnet_v2.json");
  console.log("Remaining balance:", formatEther(await pub.getBalance({ address: me.address })), "OKB");
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
