const fs = require("fs");
function rep(file, from, to) {
  const s = fs.readFileSync(file, "utf8");
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(file + ": expected 1 match, found " + n + " for: " + from.slice(0, 70));
  fs.writeFileSync(file, s.replace(from, () => to));
}
const P = "frontend/src/";
const retryRead = [
  "async (functionName: string, args: any[]): Promise<any> => {",
  "  let last: any;",
  "  for (let i = 0; i < 4; i++) {",
  "    try {",
  "      return await publicClient.readContract({ address: TENDER_TRUST, abi: tenderTrustAbi, functionName, args } as any);",
  "    } catch (e) {",
  "      last = e;",
  "      await new Promise((r) => setTimeout(r, 900));",
  "    }",
  "  }",
  "  throw last;",
  "};",
].join("\n");
rep(
  P + "pages/Bid.tsx",
  "const read = (functionName: string, args: any[]): Promise<any> =>\n  publicClient.readContract({ address: TENDER_TRUST, abi: tenderTrustAbi, functionName, args } as any);",
  "const read = " + retryRead,
);
rep(P + "pages/Bid.tsx", "await refresh(a);", "await refresh(a).catch(() => { setSaved(loadSaved(id, a)); });");
rep(
  P + "pages/Bid.tsx",
  '      const existing: any = await read("getBid", [BigInt(id), account]);\n      if (existing.commitment !== ZERO) throw new Error("You already have a commitment on-chain for this tender.");',
  [
    "      try {",
    '        const existing: any = await read("getBid", [BigInt(id), account]);',
    '        if (existing.commitment !== ZERO) throw new Error("ALREADY");',
    "      } catch (e: any) {",
    '        if (e?.message === "ALREADY") throw new Error("You already have a commitment on-chain for this tender.");',
    "      }",
  ].join("\n"),
);
rep(
  P + "lib/load.ts",
  "const call = (functionName: string, args: any[] = []): Promise<any> =>\n  publicClient.readContract({ address: TENDER_TRUST, abi: tenderTrustAbi, functionName, args } as any);",
  "const call = " + retryRead.replace("args: any[])", "args: any[] = [])"),
);
rep(
  P + "lib/wallet.ts",
  'return e?.shortMessage ?? e?.message ?? "Request failed";',
  'return [e?.shortMessage ?? e?.message ?? "Request failed", e?.details ?? e?.cause?.shortMessage ?? ""].filter(Boolean).join(" | ");',
);
console.log("Patched OK");
