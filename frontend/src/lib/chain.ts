import { createPublicClient, defineChain, fallback, http } from "viem";
import { deployment } from "./deployment";

export { tenderTrustAbi } from "./TenderTrustV2.abi";

export const xlayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
});

export const TENDER_TRUST = deployment.contract as `0x${string}`;
export const PROCESSOR = deployment.processor as `0x${string}`;
export const CIRCUIT_ID = BigInt(deployment.circuitId);
export const EXPLORER = "https://www.oklink.com/x-layer";

export const publicClient = createPublicClient({
  chain: xlayer,
  transport: fallback([http("/rpc"), http("https://rpc.xlayer.tech")]),
});
