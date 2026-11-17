const fs = require("fs");
const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");

if (!fs.existsSync(".env")) {
  fs.writeFileSync(".env", "DEPLOYER_KEY=" + generatePrivateKey() + "\n");
  console.log("New test wallet created in .env");
}
const env = fs.readFileSync(".env", "utf8");
const key = env.match(/DEPLOYER_KEY=(0x[0-9a-fA-F]{64})/)[1];
console.log("Address:", privateKeyToAccount(key).address);
