import { keccak256, parseAbi } from "viem";
import { publicClient } from "./chain";
import { deployment } from "./deployment";
import { designedNetlist } from "./netlist";

const abi = parseAbi([
  "function circuitInfo(uint256 id) view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount)",
  "function netlist(uint256 id) view returns (bytes)",
  "function eval(uint256 id, bytes inputs) view returns (bytes)",
]);

const processor = deployment.processor as `0x${string}`;
const circuitId = BigInt(deployment.circuitId);

const rd = (functionName: string, args: any[]): Promise<any> =>
  publicClient.readContract({ address: processor, abi, functionName, args } as any);

export type Report = {
  nIn: number;
  nOut: number;
  nState: number;
  gateCount: number;
  netlistBytes: number;
  netlistHash: string;
  parsed: boolean;
  sameAsRepo: boolean;
  allChecked: number;
  allMatch: number;
  chainChecked: number;
  chainMatch: number;
  note: string;
};

function toBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function parseNetlist(bytes: Uint8Array, nIn: number): [number, number][] | null {
  const gates: [number, number][] = [];
  let o = 0;
  let sig = 2 + nIn;
  while (o < bytes.length) {
    if (bytes[o] !== 0 || o + 7 > bytes.length) return null;
    const a = (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];
    const b = (bytes[o + 4] << 16) | (bytes[o + 5] << 8) | bytes[o + 6];
    if (a >= sig || b >= sig) return null;
    gates.push([a, b]);
    sig++;
    o += 7;
  }
  return gates;
}

function makeSim(gates: [number, number][], nIn: number, nOut: number) {
  const total = 2 + nIn + gates.length;
  const v = new Uint8Array(total);
  v[1] = 1;
  const ga = gates.map((g) => g[0]);
  const gb = gates.map((g) => g[1]);
  return (x: number): number => {
    for (let i = 0; i < nIn; i++) v[2 + i] = (x >> i) & 1;
    for (let g = 0; g < ga.length; g++) v[2 + nIn + g] = (v[ga[g]] & v[gb[g]]) ^ 1;
    let out = 0;
    for (let k = 0; k < nOut; k++) out |= v[total - nOut + k] << k;
    return out;
  };
}

export async function checkCircuit(onStep: (s: string) => void): Promise<Report> {
  onStep("Reading the circuit from X Layer…");
  const info: any = await rd("circuitInfo", [circuitId]);
  const nIn = Number(info[0]);
  const nOut = Number(info[1]);
  const nState = Number(info[2]);
  const gateCount = Number(info[3]);
  const nlHex: string = await rd("netlist", [circuitId]);
  const bytes = toBytes(nlHex);

  const report: Report = {
    nIn, nOut, nState, gateCount,
    netlistBytes: bytes.length,
    netlistHash: keccak256(bytes),
    parsed: false,
    sameAsRepo: nlHex.toLowerCase() === designedNetlist.toLowerCase(),
    allChecked: 0, allMatch: 0, chainChecked: 0, chainMatch: 0,
    note: "",
  };

  const gates = parseNetlist(bytes, nIn);
  if (!gates || gates.length !== gateCount || nIn !== 17 || nOut !== 8 || nState !== 0) {
    report.note = "The stored circuit does not match the expected scoring layout, so it was not tested.";
    return report;
  }
  report.parsed = true;

  onStep("Testing all 131,072 inputs in your browser…");
  await new Promise((r) => setTimeout(r, 80));
  const sim = makeSim(gates, nIn, nOut);
  for (let x = 0; x < 1 << 17; x++) {
    const t = x & 15, e = (x >> 4) & 15, d = (x >> 8) & 15, p = (x >> 12) & 15, ok = (x >> 16) & 1;
    const want = ok ? 4 * t + 3 * e + 2 * d + p : 0;
    report.allChecked++;
    if (sim(x) === want) report.allMatch++;
  }

  onStep("Comparing with the live circuit on-chain…");
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(Math.random() * (1 << 17));
    const input = "0x" + [x & 255, (x >> 8) & 255, (x >> 16) & 255].map((b) => b.toString(16).padStart(2, "0")).join("");
    try {
      const out: string = await rd("eval", [circuitId, input]);
      report.chainChecked++;
      if (parseInt(out.slice(2, 4), 16) === sim(x)) report.chainMatch++;
    } catch {
      /* RPC hiccup: skip this sample */
    }
  }
  return report;
}
