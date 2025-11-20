import { ethers } from "ethers";

export async function connectWallet() {
  if (!window.ethereum) throw new Error("No wallet found");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

export async function approveToken(tokenAddress, spender, amount, signer) {
  const erc20 = new ethers.Contract(tokenAddress, [
    "function approve(address spender, uint256 amount) public returns (bool)"
  ], signer);
  const tx = await erc20.approve(spender, amount);
  await tx.wait();
  return tx;
}

export async function depositToken(memegraveAddress, tokenAddress, amount, signer) {
  const abi = [
    "function deposit(address token, uint256 amount) external"
  ];
  const mg = new ethers.Contract(memegraveAddress, abi, signer);
  const tx = await mg.deposit(tokenAddress, amount);
  await tx.wait();
  return tx;
}