const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const { ethers } = require('ethers');
const db = require('./db');
const fs = require('fs');
const path = require('path');

dotenv.config();

const PORT = process.env.PORT || 4000;
const RPC_URL = process.env.RPC_URL;
const MEMEGRAVE_ADDRESS = process.env.MEMEGRAVE_ADDRESS;
const MEMEGRAVE_ABI_PATH = process.env.MEMEGRAVE_ABI_PATH || './contract/abi.json';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

if (!RPC_URL) {
  console.error('RPC_URL not set in env');
  process.exit(1);
}
if (!MEMEGRAVE_ADDRESS) {
  console.error('MEMEGRAVE_ADDRESS not set in env');
  // continue so admin can set later
}

const provider = new ethers.providers.JsonRpcProvider(RPC_URL, { name: 'bsc', chainId: parseInt(process.env.CHAIN_ID || '56') });
let wallet;
if (ADMIN_PRIVATE_KEY) {
  wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
}

let abi = [];
try {
  abi = JSON.parse(fs.readFileSync(path.resolve(__dirname, MEMEGRAVE_ABI_PATH), 'utf8'));
} catch (e) {
  console.warn('ABI not found or invalid at', MEMEGRAVE_ABI_PATH);
}

const contract = MEMEGRAVE_ADDRESS && abi.length ? new ethers.Contract(MEMEGRAVE_ADDRESS, abi, provider) : null;

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*'
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(morgan(process.env.LOG_LEVEL || 'combined'));

app.get('/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'production' }));

app.get('/api/entries', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50'), 1000);
  const offset = parseInt(req.query.offset || '0');
  try {
    const q = 'SELECT * FROM entries ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    const r = await db.query(q, [limit, offset]);
    res.json({ ok: true, rows: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const qEntries = await db.query('SELECT COUNT(*) as total_entries FROM entries');
    const totalEntries = qEntries.rows[0]?.total_entries || 0;
    const pools = {};
    if (contract) {
      const tokens = await contract.getTrackedTokens();
      for (const t of tokens) {
        const prize = await contract.prizePool(t);
        const eco = await contract.ecosystemPool(t);
        const dev = await contract.developerPool(t);
        const rev = await contract.revivalPool(t);
        pools[t] = {
          prize: prize.toString(),
          ecosystem: eco.toString(),
          developer: dev.toString(),
          revival: rev.toString()
        };
      }
    }
    res.json({ ok: true, totalEntries: parseInt(totalEntries), pools });
  } catch (err) {
    console.error('stats error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/draw/request', async (req, res) => {
  try {
    if (!wallet) return res.status(403).json({ ok: false, error: 'No admin key configured' });
    if (!contract) return res.status(500).json({ ok: false, error: 'Contract ABI or address not configured' });
    const contractWithSigner = contract.connect(wallet);
    const tx = await contractWithSigner.requestDraw();
    const rc = await tx.wait();
    res.json({ ok: true, txHash: tx.hash, rc });
  } catch (err) {
    console.error('requestDraw error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/webhooks/deposit', async (req, res) => {
  const { txHash, blockNumber, user, token, amount, usdScaled } = req.body;
  try {
    const depositRes = await db.query('INSERT INTO deposits (user_wallet, token_address, token_amount, usd_scaled, tx_hash, block_number) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [user, token, amount.toString(), usdScaled?.toString() || null, txHash, blockNumber]);
    const depositId = depositRes.rows[0].id;
    const entryRes = await db.query('INSERT INTO entries (deposit_id, user_wallet, token_address, token_amount) VALUES ($1,$2,$3,$4) RETURNING id', [depositId, user, token, amount.toString()]);
    res.json({ ok: true, depositId, entryId: entryRes.rows[0].id });
  } catch (err) {
    console.error('webhook deposit error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

if (contract) {
  contract.on('Deposited', async (user, token, amount, usdScaled, event) => {
    try {
      const txHash = event.transactionHash;
      const blockNumber = event.blockNumber;
      await db.query(
        `INSERT INTO deposits (user_wallet, token_address, token_amount, usd_scaled, tx_hash, block_number)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [user, token, amount.toString(), (usdScaled?.toString() || null), txHash, blockNumber]
      );
      await db.query(
        `INSERT INTO entries (deposit_id, user_wallet, token_address, token_amount)
         VALUES ($1,$2,$3)`,
        [null, user, token, amount.toString()]
      );
    } catch (err) {
      console.error('Error storing deposit event', err);
    }
  });

  contract.on('WinnerPicked', async (winner, entryIndex, ts, event) => {
    try {
      await db.query(
        `INSERT INTO draws (request_id, winner_wallet, winner_entry_index, prize_description)
         VALUES ($1,$2,$3,$4)`,
        [null, winner, entryIndex.toString(), `On-chain at tx ${event.transactionHash}`]
      );
    } catch (err) {
      console.error('Error storing WinnerPicked', err);
    }
  });
}

app.listen(PORT, () => {
  console.log(`MemeGrave backend listening on ${PORT}`);
});