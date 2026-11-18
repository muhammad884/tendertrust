const fs = require("fs");
const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");
if (!fs.existsSync(".env.mainnet")) {
  fs.writeFileSync(".env.mainnet", "MAINNET_KEY=" + generatePrivateKey() + "\n");
  console.log("New mainnet wallet created in .env.mainnet");
}
const key = fs.readFileSync(".env.mainnet", "utf8").match(/MAINNET_KEY=(0x[0-9a-fA-F]{64})/)[1];
console.log("Mainnet address:", privateKeyToAccount(key).address);
