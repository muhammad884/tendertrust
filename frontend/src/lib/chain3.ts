import { deployment } from "./deployment3";

export { publicClient, xlayer, EXPLORER } from "./chain";
export { tenderTrustAbi } from "./TenderTrustV3.abi";

export const TENDER_TRUST = deployment.contract as `0x${string}`;
export const PROCESSOR = deployment.processor as `0x${string}`;
export const CIRCUIT_ID = BigInt(deployment.circuitId);
