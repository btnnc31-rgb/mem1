import React, { useState, useEffect } from "react";
import { connectWallet, approveToken, depositToken } from "./eth/memegrave";
import { ethers } from "ethers";

const MEMEGRAVE_ADDRESS = process.env.REACT_APP_MEMEGRAVE_ADDRESS || "";
const MEMEGRAVE_ABI = [
  "function deposit(address token, uint256 amount) external",
  "function getTrackedTokens() external view returns (address[])",
  "function prizePool(address) external view returns (uint256)",
  "function ecosystemPool(address) external view returns (uint256)",
  "function developerPool(address) external view returns (uint256)",
  "function revivalPool(address) external view returns (uint256)"
];

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState("");
  const [tracked, setTracked] = useState([]);
  const [pools, setPools] = useState({});
  const [selectedToken, setSelectedToken] = useState("");
  const [amount, setAmount] = useState("1");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (MEMEGRAVE_ADDRESS) fetchPools();
  }, []);

  async function handleConnect() {
    try {
      const { provider, signer, address } = await connectWallet();
      setProvider(provider);
      setSigner(signer);
      setAddress(address);
      setStatus("Connected: " + address);
      await fetchPools();
    } catch (err) {
      setStatus("Connect failed: " + err.message);
    }
  }

  async function fetchPools() {
    if (!MEMEGRAVE_ADDRESS) {
      setStatus("Set REACT_APP_MEMEGRAVE_ADDRESS in .env");
      return;
    }
    try {
      const _provider = new ethers.providers.Web3Provider(window.ethereum || null);
      const contract = new ethers.Contract(MEMEGRAVE_ADDRESS, MEMEGRAVE_ABI, _provider);
      const tokens = await contract.getTrackedTokens();
      setTracked(tokens);
      const p = {};
      for (const t of tokens) {
        try {
          const prize = await contract.prizePool(t);
          const eco = await contract.ecosystemPool(t);
          const dev = await contract.developerPool(t);
          const rev = await contract.revivalPool(t);
          const erc = new ethers.Contract(t, ERC20_ABI, _provider);
          const decimals = await erc.decimals();
          const symbol = await erc.symbol();
          p[t] = {
            token: t,
            symbol,
            prize: prize.toString(),
            eco: eco.toString(),
            dev: dev.toString(),
            rev: rev.toString(),
            decimals: decimals
          };
        } catch (e) {
          p[t] = { token: t, symbol: "UNK", prize: "0", eco: "0", dev: "0", rev: "0", decimals: 18 };
        }
      }
      setPools(p);
      setStatus("Pools loaded");
    } catch (err) {
      setStatus("Error loading pools: " + err.message);
    }
  }

  async function handleApprove() {
    if (!signer || !selectedToken) return setStatus("Connect and select a token");
    try {
      const amt = ethers.utils.parseUnits(amount || "0", pools[selectedToken]?.decimals || 18);
      await approveToken(selectedToken, MEMEGRAVE_ADDRESS, amt, signer);
      setStatus("Approved");
    } catch (err) {
      setStatus("Approve error: " + err.message);
    }
  }

  async function handleDeposit() {
    if (!signer || !selectedToken) return setStatus("Connect and select a token");
    try {
      const amt = ethers.utils.parseUnits(amount || "0", pools[selectedToken]?.decimals || 18);
      setStatus("Depositing...");
      await depositToken(MEMEGRAVE_ADDRESS, selectedToken, amt, signer);
      setStatus("Deposit sent");
      await fetchPools();
    } catch (err) {
      setStatus("Deposit error: " + err.message);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>MemeGrave UI</h1>
        <div>
          <button onClick={handleConnect}>{address ? address.slice(0, 6) + "..." + address.slice(-4) : "Connect Wallet"}</button>
        </div>
      </header>

      <div className="card">
        <h3>Pools</h3>
        {Object.keys(pools).length === 0 ? <div>No tracked tokens yet</div> :
          Object.values(pools).map((p) => (
            <div key={p.token} className="card">
              <strong>{p.symbol}</strong> ({p.token})
              <div>Prize: {formatUnits(p.prize, p.decimals)}</div>
              <div>Ecosystem: {formatUnits(p.eco, p.decimals)}</div>
              <div>Developer: {formatUnits(p.dev, p.decimals)}</div>
              <div>Revival: {formatUnits(p.rev, p.decimals)}</div>
            </div>
          ))
        }
      </div>

      <div className="card">
        <h3>Deposit</h3>
        <div>
          <label>Token:</label>
          <select onChange={(e) => setSelectedToken(e.target.value)} value={selectedToken}>
            <option value="">-- select --</option>
            {tracked.map((t) => <option key={t} value={t}>{pools[t]?.symbol || t}</option>)}
          </select>
        </div>
        <div>
          <label>Amount:</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={handleApprove}>Approve</button>
          <button onClick={handleDeposit} style={{ marginLeft: 8 }}>Deposit</button>
        </div>
      </div>

      <div className="card">
        <h3>Status</h3>
        <div><small>{status}</small></div>
        <div style={{ marginTop: 8 }}>
          <button onClick={fetchPools}>Refresh Pools</button>
        </div>
      </div>
    </div>
  );
}

function formatUnits(value, decimals) {
  try {
    return ethers.utils.formatUnits(value.toString(), decimals);
  } catch {
    return value;
  }
}

export default App;