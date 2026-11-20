const fs = require("fs");
const hex = fs.readFileSync("circuit/score_netlist.hex", "utf8").trim();
fs.writeFileSync("frontend/src/lib/netlist.ts", 'export const designedNetlist = "' + hex + '";\n');
console.log("OK netlist bytes:", (hex.length - 2) / 2);
