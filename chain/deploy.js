const fs = require("fs");
const { createPublicClient, createWalletClient, http, defineChain, formatEther } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const chain = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech/terigon"] } },
});

async function main() {
  const key = fs.readFileSync(".env", "utf8").match(/DEPLOYER_KEY=(0x[0-9a-fA-F]{64})/)[1];
  const account = privateKeyToAccount(key);
  const pub = createPublicClient({ chain, transport: http() });
  const wallet = createWalletClient({ account, chain, transport: http() });

  const id = await pub.getChainId();
  console.log("Chain ID:", id);
  if (id !== 1952) throw new Error("Wrong network");

  const bal = await pub.getBalance({ address: account.address });
  console.log("Balance:", formatEther(bal), "OKB");
  if (bal === 0n) throw new Error("No test OKB yet. Use the faucet first.");

  const { abi, bytecode } = JSON.parse(fs.readFileSync("build/TenderTrust.json", "utf8"));
  const hash = await wallet.deployContract({ abi, bytecode });
  console.log("Deploy tx:", hash);

  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status);
  console.log("Contract address:", receipt.contractAddress);

  if (receipt.status === "success") {
    fs.writeFileSync(
      "deployment.json",
      JSON.stringify({ chainId: 1952, contract: receipt.contractAddress, txHash: hash }, null, 2)
    );
    console.log("Saved to deployment.json");
  }
}

main().catch((e) => {
  console.error("FAILED:", e.shortMessage || e.message);
  process.exit(1);
});
