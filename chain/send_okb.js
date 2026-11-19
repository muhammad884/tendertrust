const fs = require("fs");
const readline = require("readline");
const { createPublicClient, createWalletClient, http, defineChain, isAddress, parseEther, formatEther } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const to = (process.argv[2] || "").toLowerCase();
const amount = process.argv[3] || "";
if (!isAddress(to) || /^0x0+$/.test(to) || !/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 0.003) {
  console.log("Usage: node send_okb.js <address> <amount up to 0.003>");
  process.exit(1);
}
const url = "https://rpc.xlayer.tech";
const chain = defineChain({ id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
const me = privateKeyToAccount(key);
const pub = createPublicClient({ chain, transport: http(url, { retryCount: 6, retryDelay: 1500 }) });
const wal = createWalletClient({ account: me, chain, transport: http(url, { retryCount: 6, retryDelay: 1500 }) });
const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a); }); });

(async () => {
  console.log("Chain ID:", await pub.getChainId());
  console.log("From:", me.address, "| balance:", formatEther(await pub.getBalance({ address: me.address })), "OKB");
  console.log("To:  ", to, "| balance:", formatEther(await pub.getBalance({ address: to })), "OKB");
  console.log("Amount:", amount, "OKB on X Layer mainnet");
  const ans = await ask("Compare the To address with your wallet app. Type SEND to confirm: ");
  if (ans.trim() !== "SEND") { console.log("Cancelled. Nothing sent."); return; }
  const hash = await wal.sendTransaction({ to, value: parseEther(amount) });
  console.log("tx:", hash);
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log("Status:", r.status);
  await new Promise((s) => setTimeout(s, 4000));
  console.log("To balance now:", formatEther(await pub.getBalance({ address: to })), "OKB");
  console.log("From balance now:", formatEther(await pub.getBalance({ address: me.address })), "OKB");
})().catch((e) => { console.error("FAILED:", e.shortMessage || e.message); process.exit(1); });
