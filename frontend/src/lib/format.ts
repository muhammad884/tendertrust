import { EXPLORER } from "./chain";

export const STATUS = ["Commit", "Reveal", "Evaluation", "Finalized"];
export const STATUS_COLOR = [
  "bg-trust-600/20 text-trust-400",
  "bg-amber-500/20 text-amber-300",
  "bg-sky-500/20 text-sky-300",
  "bg-ink-700 text-ink-300",
];
export const fmt = (ts: bigint) => new Date(Number(ts) * 1000).toLocaleString();
export const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
export const explorerTx = (h: string) => EXPLORER + "/tx/" + h;
export const explorerAddr = (a: string) => EXPLORER + "/address/" + a;
