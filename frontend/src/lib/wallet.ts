import { createWalletClient, custom } from "viem";
import { publicClient, TENDER_TRUST, tenderTrustAbi, xlayer } from "./chain";

const eth = () => (window as any).ethereum;

export async function switchToXLayer() {
  try {
    await eth().request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xc4" }] });
  } catch (e: any) {
    if (e?.code === 4902 || e?.code === -32603) {
      await eth().request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0xc4",
          chainName: "X Layer",
          nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
          rpcUrls: ["https://rpc.xlayer.tech"],
          blockExplorerUrls: ["https://www.oklink.com/x-layer"],
        }],
      });
    } else {
      throw e;
    }
  }
}

export async function connect(): Promise<string> {
  if (!eth()) throw new Error("No wallet found. Open this site in a browser with MetaMask or OKX Wallet.");
  const accounts: string[] = await eth().request({ method: "eth_requestAccounts" });
  await switchToXLayer();
  return accounts[0];
}

async function freshAccount(): Promise<string> {
  const accounts: string[] = await eth().request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) throw new Error("No account is connected to this site.");
  const chainId: string = await eth().request({ method: "eth_chainId" });
  if (String(chainId).toLowerCase() !== "0xc4") await switchToXLayer();
  return accounts[0];
}

export function explainWalletError(e: any): string {
  if (e?.code === 4100) {
    return "The wallet did not authorize this request. In your wallet, select the account that holds OKB, make sure this site is connected to it (disconnect and reconnect if needed), then try again.";
  }
  if (e?.code === 4001) return "You rejected the request in your wallet.";
  return [e?.shortMessage ?? e?.message ?? "Request failed", e?.details ?? e?.cause?.shortMessage ?? ""].filter(Boolean).join(" | ");
}

export async function writeTender(functionName: string, args: any[]): Promise<{ hash: string; receipt: any }> {
  const account = (await freshAccount()) as `0x${string}`;
  const wallet = createWalletClient({ account, chain: xlayer, transport: custom(eth()) });
  const sim: any = await publicClient.simulateContract({
    account,
    address: TENDER_TRUST,
    abi: tenderTrustAbi,
    functionName,
    args,
  } as any);
  let fees: any = {};
  try {
    const f = await publicClient.estimateFeesPerGas();
    if (f.maxFeePerGas && f.maxPriorityFeePerGas) {
      fees = { maxFeePerGas: (f.maxFeePerGas * 13n) / 10n, maxPriorityFeePerGas: f.maxPriorityFeePerGas };
    }
  } catch {
    /* let the wallet choose the fee */
  }
  const hash = await wallet.writeContract({ ...sim.request, ...fees });
  const receipt: any = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction failed: " + hash);
  return { hash, receipt };
}
