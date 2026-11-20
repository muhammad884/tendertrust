import { keccak256, toHex } from "viem";

export type DocEntry = { name: string; size: number; hash: string };

export async function hashFile(file: File): Promise<DocEntry> {
  const buf = new Uint8Array(await file.arrayBuffer());
  return { name: file.name, size: file.size, hash: keccak256(buf) };
}

export function buildPackage(tender: string, bidder: string, price: string, proposal: string, files: DocEntry[]): string {
  return JSON.stringify({ v: 1, tender, bidder: bidder.toLowerCase(), price, proposal, files });
}

export const hashPackage = (pkg: string) => keccak256(toHex(pkg));
