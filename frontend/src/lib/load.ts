import { publicClient, TENDER_TRUST, tenderTrustAbi } from "./chain";

const call = async (functionName: string, args: any[] = []): Promise<any> => {
  let last: any;
  for (let i = 0; i < 4; i++) {
    try {
      return await publicClient.readContract({ address: TENDER_TRUST, abi: tenderTrustAbi, functionName, args } as any);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 900));
    }
  }
  throw last;
};

export type Bid = {
  bidder: string;
  commitment: string;
  proposalHash: string;
  price: bigint;
  revealed: boolean;
  evaluated: boolean;
  eligible: boolean;
  tech: number;
  experience: number;
  delivery: number;
  priceScore: number;
  total: number;
};

export async function loadTender(id: number) {
  const n = BigInt(id);
  const tender: any = await call("getTender", [n]);
  const status = Number(await call("status", [n]));
  const addrs: string[] = await call("getBidders", [n]);
  const bids: Bid[] = [];
  for (const a of addrs) {
    const b: any = await call("getBid", [n, a]);
    bids.push({
      bidder: a,
      commitment: b.commitment,
      proposalHash: b.proposalHash,
      price: b.price,
      revealed: b.revealed,
      evaluated: b.evaluated,
      eligible: b.eligible,
      tech: Number(b.tech),
      experience: Number(b.experience),
      delivery: Number(b.delivery),
      priceScore: Number(b.priceScore),
      total: Number(b.total),
    });
  }
  return { tender, status, bids };
}

export async function previewScore(id: number, b: Bid): Promise<number> {
  const r: any = await call("previewScore", [BigInt(id), b.tech, b.experience, b.delivery, b.price, b.eligible]);
  return Number(r[0]);
}

export const formula = (t: number, e: number, d: number, p: number, ok: boolean) =>
  ok ? 4 * t + 3 * e + 2 * d + p : 0;
