const fs = require("fs");
function rep(file, from, to) {
  const s = fs.readFileSync(file, "utf8");
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(file + ": expected 1 match, found " + n + " for: " + from.slice(0, 70));
  fs.writeFileSync(file, s.replace(from, () => to));
}
rep(
  "frontend/src/lib/wallet.ts",
  "const hash = await wallet.writeContract(sim.request);",
  [
    "let fees: any = {};",
    "  try {",
    "    const f = await publicClient.estimateFeesPerGas();",
    "    if (f.maxFeePerGas && f.maxPriorityFeePerGas) {",
    "      fees = { maxFeePerGas: (f.maxFeePerGas * 13n) / 10n, maxPriorityFeePerGas: f.maxPriorityFeePerGas };",
    "    }",
    "  } catch {",
    "    /* let the wallet choose the fee */",
    "  }",
    "  const hash = await wallet.writeContract({ ...sim.request, ...fees });",
  ].join("\n"),
);
console.log("Patched OK");
