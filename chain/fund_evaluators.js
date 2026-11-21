const fs = require("fs");
const readline = require("readline");
const { createPublicClient, createWalletClient, http, defineChain, parseEther, formatEther } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const tr = http(url, { retryCount: 6, retryDelay: 1500 });
const me = privateKeyToAccount(fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1]);
const pub = createPublicClient({ chain, transport: tr });
const wal = createWalletClient({ account: me, chain, transport: tr });
const list = [
  ["Account 4", "0x133b040575382be8a1b33c8c58d5a6dc933ace96"],
  ["Account 5", "0x60a70aa2b04295326dcddc4083adb75e07a2e25a"],
  ["Account 6", "0xdf93523783a1ae192d8131aca19702b424f8154f"],
];
const AMOUNT = "0.0002";
const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a); }); });
(async () => {
  console.log("From:", me.address, "| balance:", formatEther(await pub.getBalance({ address: me.address })), "OKB");
  for (const [n, a] of list) console.log(n.padEnd(10), a, "| balance:", formatEther(await pub.getBalance({ address: a })));
  console.log("Will send", AMOUNT, "OKB to each of the three addresses.");
  const ans = await ask("Compare the addresses with your wallet app. Type SEND to confirm: ");
  if (ans.trim() !== "SEND") { console.log("Cancelled. Nothing sent."); return; }
  for (const [n, a] of list) {
    const h = await wal.sendTransaction({ to: a, value: parseEther(AMOUNT) });
    await pub.waitForTransactionReceipt({ hash: h });
    console.log(n, "funded:", h.slice(0, 18) + "...");
  }
  await new Promise((s) => setTimeout(s, 3000));
  for (const [n, a] of list) console.log(n.padEnd(10), "balance now:", formatEther(await pub.getBalance({ address: a })));
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
