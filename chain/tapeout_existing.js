const fs = require("fs");
const readline = require("readline");
const { createPublicClient, createWalletClient, http, defineChain, parseAbi, formatEther, parseEther, keccak256, toHex } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const CPU_INDEX = 180n;
const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const me = privateKeyToAccount(key);
const pub = createPublicClient({ chain, transport: http(url) });
const wal = createWalletClient({ account: me, chain, transport: http(url) });

const factory = "0x1f09daefa827f02cbb40967cc91b259763760761";
const fAbi = parseAbi(["function cpus(uint256) view returns (address)", "function isCPU(address) view returns (bool)"]);
const tAbi = parseAbi([
  "function mint(uint256 id, uint256 amount) payable",
  "function mintPrice() view returns (uint256)",
  "function protocolFee() view returns (uint256)",
  "function supplyCap() view returns (uint256)",
  "function minted() view returns (uint256)",
  "function balanceOf(address,uint256) view returns (uint256)",
]);
const cAbi = parseAbi([
  "function tapeout(bytes nl, uint32 nIn, uint32 nOut) payable returns (uint256)",
  "function TAPEOUT_FEE() view returns (uint256)",
  "function nextId() view returns (uint256)",
  "function transistors() view returns (address)",
  "function ownerOf(uint256) view returns (address)",
  "function circuitInfo(uint256) view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount)",
  "function eval(uint256 id, bytes inputs) view returns (bytes)",
]);

const nl = fs.readFileSync("../circuit/score_netlist.hex", "utf8").trim();
const MINT_AMOUNT = 400n, NEED = 170n, MAX_TOTAL = parseEther("0.004");
const PROGRESS = "mainnet_progress2.json";
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
  const circuits = await pub.readContract({ address: factory, abi: fAbi, functionName: "cpus", args: [CPU_INDEX] });
  const isCpu = await pub.readContract({ address: factory, abi: fAbi, functionName: "isCPU", args: [circuits] });
  const tok = await pub.readContract({ address: circuits, abi: cAbi, functionName: "transistors" });
  const rd = (f) => pub.readContract({ address: tok, abi: tAbi, functionName: f });
  const [cap, minted, mp, pf] = [await rd("supplyCap"), await rd("minted"), await rd("mintPrice"), await rd("protocolFee")];
  const tapeFee = await pub.readContract({ address: circuits, abi: cAbi, functionName: "TAPEOUT_FEE" });
  const existing = await pub.readContract({ address: circuits, abi: cAbi, functionName: "nextId" });
  const gasPrice = await pub.getGasPrice();
  const mintValue = MINT_AMOUNT * mp + pf;
  const total = mintValue + tapeFee + gasPrice * 1300000n;

  console.log("Wallet:", me.address, "| balance:", formatEther(bal), "OKB");
  console.log("Target CPU #" + CPU_INDEX, "| processor (circuits):", circuits);
  console.log("Transistors:", tok, "| registered CPU:", isCpu, "| circuits already on it:", existing.toString());
  console.log("Supply left:", (cap - minted).toString(), "| mintPrice(wei):", mp.toString(), "| mint cost:", formatEther(mintValue), "| tapeout fee:", formatEther(tapeFee));
  console.log("ESTIMATED TOTAL:", formatEther(total), "OKB (limit", formatEther(MAX_TOTAL) + ")");
  if (!isCpu) { console.log("ABORT: not a registered CPU."); return; }
  if (cap - minted < MINT_AMOUNT) { console.log("ABORT: not enough supply."); return; }
  if (mintValue > parseEther("0.001")) { console.log("ABORT: mint cost too high."); return; }
  if (total > MAX_TOTAL || total > bal) { console.log("ABORT: cost too high or balance too low."); return; }
  if (prog.circuitId) { console.log("Already done. Circuit id:", prog.circuitId); return; }

  const ans = await ask("Type SEND to broadcast real mainnet transactions: ");
  if (ans.trim() !== "SEND") { console.log("Cancelled. Nothing sent."); return; }

  if (!prog.minted) {
    const { hash } = await sendTx("1/2 mint NAND", tok, tAbi, "mint", [0n, MINT_AMOUNT], mintValue);
    prog.minted = true; prog.txMint = hash; save();
  }
  const nand = await retry(() => pub.readContract({ address: tok, abi: tAbi, functionName: "balanceOf", args: [me.address, 0n] }).then((b) => (b >= NEED ? b : undefined)));
  console.log("NAND balance:", nand.toString());

  const { hash: txTape, r } = await sendTx("2/2 tapeout", circuits, cAbi, "tapeout", [nl, 17, 8], tapeFee);
  const taped = keccak256(toHex("TapedOut(uint256,address,uint32,uint32)"));
  let id;
  const l1 = r.logs.find((l) => l.address.toLowerCase() === circuits.toLowerCase() && l.topics[0] === taped);
  const l2 = r.logs.find((l) => l.address.toLowerCase() === circuits.toLowerCase() && l.topics.length === 3 && addrOf(l.topics[2]).toLowerCase() === me.address.toLowerCase());
  const l3 = r.logs.find((l) => l.address.toLowerCase() === circuits.toLowerCase() && l.topics.length === 4 && addrOf(l.topics[2]).toLowerCase() === me.address.toLowerCase());
  if (l1) id = BigInt(l1.topics[1]); else if (l2) id = BigInt(l2.topics[1]); else if (l3) id = BigInt(l3.topics[3]);
  if (id === undefined) throw new Error("could not find circuit id in receipt " + txTape);
  prog.circuitId = id.toString(); prog.txTapeout = txTape; save();
  console.log("Our circuit id:", id.toString());

  const owner = await retry(() => pub.readContract({ address: circuits, abi: cAbi, functionName: "ownerOf", args: [id] }));
  console.log("NFT owner is our wallet:", owner.toLowerCase() === me.address.toLowerCase());
  const info = await retry(() => pub.readContract({ address: circuits, abi: cAbi, functionName: "circuitInfo", args: [id] }));
  console.log("circuitInfo: nIn", info[0], "nOut", info[1], "nState", info[2], "gateCount", info[3], "(expected 17, 8, 0, 170)");
  const run = async (t, e, d, p, ok) => {
    const out = await retry(() => pub.readContract({ address: circuits, abi: cAbi, functionName: "eval", args: [id, pack(t, e, d, p, ok)] }));
    return parseInt(out.slice(2, 4), 16);
  };
  const want = (t, e, d, p, ok) => (ok ? 4 * t + 3 * e + 2 * d + p : 0);
  let pass = 0, n = 0;
  const cases = [[12, 10, 9, 3, 1], [8, 9, 7, 6, 1], [15, 15, 15, 15, 1], [15, 15, 15, 15, 0], [0, 0, 0, 0, 1]];
  for (let i = 0; i < 15; i++) cases.push([Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), Math.floor(Math.random() * 2)]);
  for (const c of cases) { const got = await run(...c); n++; if (got === want(...c)) pass++; else console.log("MISMATCH", c, "got", got, "want", want(...c)); }
  console.log("ONCHAIN eval vs formula:", pass + "/" + n, pass === n ? "ALL MATCH" : "PROBLEM");
  const gas = await pub.estimateContractGas({ address: circuits, abi: cAbi, functionName: "eval", args: [id, pack(12, 10, 9, 3, 1)], account: me.address });
  console.log("eval gas estimate:", gas.toString());

  const dep = { chainId: 196, cpuIndex: Number(CPU_INDEX), processor: circuits, transistors: tok, circuitId: Number(id), nIn: 17, nOut: 8, gateCount: 170, txMint: prog.txMint, txTapeout: txTape, evalGas: gas.toString(), onchainTests: pass + "/" + n };
  fs.writeFileSync("mainnet_deployment.json", JSON.stringify(dep, null, 2));
  console.log("\nSaved mainnet_deployment.json");
  console.log("Tapeout tx: https://www.okx.com/web3/explorer/xlayer/tx/" + txTape);
  console.log("Remaining balance:", formatEther(await pub.getBalance({ address: me.address })), "OKB");
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
