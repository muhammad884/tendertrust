const fs = require("fs");
const readline = require("readline");
const { createPublicClient, createWalletClient, http, defineChain, parseAbi, formatEther, parseEther, keccak256, toHex } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const me = privateKeyToAccount(key);
const pub = createPublicClient({ chain, transport: http(url) });
const wal = createWalletClient({ account: me, chain, transport: http(url) });

const factory = "0x1f09daefa827f02cbb40967cc91b259763760761";
const fAbi = parseAbi([
  "function createCPU(string name, string symbol, string story, uint256 transistorSupply, uint256 mintPrice) payable returns (address transistors, address circuits)",
  "function deployFee() view returns (uint256)",
  "function cpuCount() view returns (uint256)",
  "function cpus(uint256) view returns (address)",
  "function isCPU(address) view returns (bool)",
]);
const tAbi = parseAbi([
  "function mint(uint256 id, uint256 amount) payable",
  "function mintPrice() view returns (uint256)",
  "function protocolFee() view returns (uint256)",
  "function balanceOf(address,uint256) view returns (uint256)",
]);
const cAbi = parseAbi([
  "function tapeout(bytes nl, uint32 nIn, uint32 nOut) payable returns (uint256)",
  "function TAPEOUT_FEE() view returns (uint256)",
  "function nextId() view returns (uint256)",
  "function transistors() view returns (address)",
  "function circuitInfo(uint256) view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount)",
  "function eval(uint256 id, bytes inputs) view returns (bytes)",
]);

const nl = fs.readFileSync("../circuit/score_netlist.hex", "utf8").trim();
const MINT_AMOUNT = 2000n, NEED = 170n, MAX_TOTAL = parseEther("0.006");
const PROGRESS = "mainnet_progress.json";
const prog = fs.existsSync(PROGRESS) ? JSON.parse(fs.readFileSync(PROGRESS, "utf8")) : {};
const save = () => fs.writeFileSync(PROGRESS, JSON.stringify(prog, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a); }); });
async function retry(fn, tries = 8, ms = 3000) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { const r = await fn(); if (r !== undefined) return r; } catch (e) { last = e; }
    await sleep(ms);
  }
  throw last || new Error("retry failed");
}
async function sendTx(label, address, abi, functionName, args, value) {
  const { request } = await retry(() => pub.simulateContract({ account: me, address, abi, functionName, args, value }));
  const hash = await wal.writeContract(request);
  console.log(label, "tx:", hash);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(label + " reverted onchain: " + hash);
  console.log(label, "confirmed. gas used:", r.gasUsed.toString());
  return { hash, r };
}
const addrOf = (t) => "0x" + t.slice(26);
const pack = (t, e, d, p, ok) => { const x = t | (e << 4) | (d << 8) | (p << 12) | (ok << 16); return "0x" + [x & 255, (x >> 8) & 255, (x >> 16) & 255].map((b) => b.toString(16).padStart(2, "0")).join(""); };

(async () => {
  const bal = await pub.getBalance({ address: me.address });
  const deployFee = await pub.readContract({ address: factory, abi: fAbi, functionName: "deployFee" });
  const count = await pub.readContract({ address: factory, abi: fAbi, functionName: "cpuCount" });
  const refCpu = await pub.readContract({ address: factory, abi: fAbi, functionName: "cpus", args: [count - 1n] });
  const tapeFee = await pub.readContract({ address: refCpu, abi: cAbi, functionName: "TAPEOUT_FEE" });
  const refTok = await pub.readContract({ address: refCpu, abi: cAbi, functionName: "transistors" });
  const protoFee = await pub.readContract({ address: refTok, abi: tAbi, functionName: "protocolFee" });
  const gasPrice = await pub.getGasPrice();
  const gasCost = gasPrice * 2000000n;
  const total = deployFee + protoFee + tapeFee + gasCost;

  console.log("Wallet:", me.address, "| balance:", formatEther(bal), "OKB");
  console.log("Live fees: deployFee", formatEther(deployFee), "| mint protocolFee", formatEther(protoFee), "| tapeout fee", formatEther(tapeFee));
  console.log("Gas price (gwei):", Number(gasPrice) / 1e9, "| estimated gas cost:", formatEther(gasCost));
  console.log("ESTIMATED TOTAL:", formatEther(total), "OKB (limit", formatEther(MAX_TOTAL) + ")");
  if (total > MAX_TOTAL || total > bal) { console.log("ABORT: cost too high or balance too low."); return; }
  if (prog.circuitId) { console.log("Already done. Circuit id:", prog.circuitId); return; }
  if (prog.circuits) console.log("Resuming. CPU already created:", prog.circuits);

  const ans = await ask("Type SEND to broadcast real mainnet transactions: ");
  if (ans.trim() !== "SEND") { console.log("Cancelled. Nothing sent."); return; }

  // 1. create our own CPU
  if (!prog.circuits) {
    const { hash, r } = await sendTx("1/3 createCPU", factory, fAbi, "createCPU",
      ["TenderTrust", "TTRUST", "Verifiable procurement scoring circuits for TenderTrust.", 10000n, 0n], deployFee);
    const topic = keccak256(toHex("CPUCreated(address,address,address,string,uint256,uint256)"));
    const log = r.logs.find((l) => l.address.toLowerCase() === factory && l.topics[0] === topic)
      || r.logs.find((l) => l.address.toLowerCase() === factory && l.topics.length === 4);
    if (!log) throw new Error("CPUCreated event not found in " + hash);
    const circuits = addrOf(log.topics[1]), transistors = addrOf(log.topics[2]);
    if (addrOf(log.topics[3]).toLowerCase() !== me.address.toLowerCase()) throw new Error("creator mismatch, aborting");
    const ok = await retry(() => pub.readContract({ address: factory, abi: fAbi, functionName: "isCPU", args: [circuits] }).then((v) => v || undefined));
    const tok = await retry(() => pub.readContract({ address: circuits, abi: cAbi, functionName: "transistors" }));
    if (!ok || tok.toLowerCase() !== transistors.toLowerCase()) throw new Error("sanity check failed for new CPU");
    prog.circuits = circuits; prog.transistors = transistors; prog.txCreate = hash; save();
    console.log("CPU created. Processor (circuits):", circuits, "| transistors:", transistors);
  }

  // 2. mint NAND
  if (!prog.minted) {
    const mp = await retry(() => pub.readContract({ address: prog.transistors, abi: tAbi, functionName: "mintPrice" }).then((v) => v));
    const pf = await retry(() => pub.readContract({ address: prog.transistors, abi: tAbi, functionName: "protocolFee" }));
    const value = MINT_AMOUNT * mp + pf;
    if (value > parseEther("0.003")) throw new Error("mint cost unexpectedly high: " + formatEther(value));
    const { hash } = await sendTx("2/3 mint NAND", prog.transistors, tAbi, "mint", [0n, MINT_AMOUNT], value);
    prog.minted = true; prog.txMint = hash; save();
  }
  const nand = await retry(() => pub.readContract({ address: prog.transistors, abi: tAbi, functionName: "balanceOf", args: [me.address, 0n] }).then((b) => (b >= NEED ? b : undefined)));
  console.log("NAND balance:", nand.toString());

  // 3. tape out the circuit
  const fee = await retry(() => pub.readContract({ address: prog.circuits, abi: cAbi, functionName: "TAPEOUT_FEE" }));
  if (fee > parseEther("0.003")) throw new Error("tapeout fee unexpectedly high: " + formatEther(fee));
  const { hash: txTape } = await sendTx("3/3 tapeout", prog.circuits, cAbi, "tapeout", [nl, 17, 8], fee);
  const id = await retry(() => pub.readContract({ address: prog.circuits, abi: cAbi, functionName: "nextId" }).then((v) => (v >= 1n ? v : undefined)));
  prog.circuitId = id.toString(); prog.txTapeout = txTape; save();

  // 4. verify on chain
  const info = await retry(() => pub.readContract({ address: prog.circuits, abi: cAbi, functionName: "circuitInfo", args: [id] }));
  console.log("circuitInfo: nIn", info[0], "nOut", info[1], "nState", info[2], "gateCount", info[3], "(expected 17, 8, 0, 170)");
  const run = async (t, e, d, p, ok) => {
    const out = await retry(() => pub.readContract({ address: prog.circuits, abi: cAbi, functionName: "eval", args: [id, pack(t, e, d, p, ok)] }));
    return parseInt(out.slice(2, 4), 16);
  };
  const want = (t, e, d, p, ok) => (ok ? 4 * t + 3 * e + 2 * d + p : 0);
  let pass = 0, n = 0;
  const cases = [[12, 10, 9, 3, 1], [8, 9, 7, 6, 1], [15, 15, 15, 15, 1], [15, 15, 15, 15, 0], [0, 0, 0, 0, 1]];
  for (let i = 0; i < 15; i++) cases.push([Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), Math.floor(Math.random() * 2)]);
  for (const c of cases) { const got = await run(...c); n++; if (got === want(...c)) pass++; else console.log("MISMATCH", c, "got", got, "want", want(...c)); }
  console.log("ONCHAIN eval vs formula:", pass + "/" + n, pass === n ? "ALL MATCH" : "PROBLEM");
  const gas = await pub.estimateContractGas({ address: prog.circuits, abi: cAbi, functionName: "eval", args: [id, pack(12, 10, 9, 3, 1)], account: me.address });
  console.log("eval gas estimate:", gas.toString());

  const dep = { chainId: 196, processor: prog.circuits, transistors: prog.transistors, circuitId: Number(id), nIn: 17, nOut: 8, gateCount: 170, txCreateCPU: prog.txCreate, txMint: prog.txMint, txTapeout: txTape, evalGas: gas.toString(), onchainTests: pass + "/" + n };
  fs.writeFileSync("mainnet_deployment.json", JSON.stringify(dep, null, 2));
  console.log("\nSaved mainnet_deployment.json");
  console.log("Tapeout tx: https://www.okx.com/web3/explorer/xlayer/tx/" + txTape);
  console.log("Remaining balance:", formatEther(await pub.getBalance({ address: me.address })), "OKB");
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
