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
          blockExplorerUrls: ["https://www.okx.com/web3/explorer/xlayer"],
        }],
      });
    } else {
      throw e;
    }
  }
}

export async function connect(): Promise<string> {
  if (!eth()) throw new Error("No wallet found. Open this site inside the OKX Wallet or MetaMask browser.");
  const accounts: string[] = await eth().request({ method: "eth_requestAccounts" });
  await switchToXLayer();
  return accounts[0];
}

export async function writeTender(account: string, functionName: string, args: any[]): Promise<{ hash: string; receipt: any }> {
  const wallet = createWalletClient({ account: account as `0x${string}`, chain: xlayer, transport: custom(eth()) });
  const sim: any = await publicClient.simulateContract({
    account: account as `0x${string}`,
    address: TENDER_TRUST,
    abi: tenderTrustAbi,
    functionName,
    args,
  } as any);
  const hash = await wallet.writeContract(sim.request);
  const receipt: any = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction failed: " + hash);
  return { hash, receipt };
}
