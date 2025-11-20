# MemeGrave Backend API Design

This backend listens to on-chain events and provides interfaces for orchestration and receipts.

Auth: JWT for admin endpoints. Webhooks for Chainlink/VRF notifications optional.

Endpoints:

- POST /api/webhooks/deposit
  - Accepts event payload when a Deposit or EntryAdded is observed on-chain
  - Body: { txHash, blockNumber, user, token, amount, usdScaled }
  - Stores deposit, token info, creates an entry record

- GET /api/entries
  - Query: ?limit=&offset=
  - Returns list of entries and metadata

- POST /api/draws/request
  - Admin-only: triggers contract.requestDraw via a server signer OR instructs owner to call
  - Body: optional metadata
  - Returns { requestId }

- POST /api/draws/fulfill
  - Called by server process listening to WinnerPicked event
  - Body: { requestId, winnerWallet, entryIndex, prizeBreakdown }
  - Stores draw record and receipts

- GET /api/draws/:id
  - Returns draw record and receipts

- GET /api/stats
  - Returns aggregated stats (totalEntries, poolSizes per token via on-chain reads or events)

Notes:
- The backend also stores token metadata and price feed mapping to help frontend estimate USD values pre-approval.
- For payouts, if winner receives on-chain tokens automatically by the contract, the backend will still record receipts. If you prefer single-token payouts, the backend must coordinate swaps (DEX) and then call contract to transfer swapped funds to winner or perform off-chain payouts.

Database schema is in schema.sql