```markdown
# MemeGrave — Full Project Package

This repository package contains:
- Smart contract (MemeGrave) with Chainlink VRF integration (contracts/)
- Hardhat tests and mocks (test/, scripts/)
- Backend (backend/) — Express server which listens to on-chain events and exposes REST endpoints
- Frontend (frontend/) — React app that lets users connect wallet, approve token, deposit and view pools
- Deploy script for VestaCP (deploy_vesta_memegrave.sh)
- Systemd / PM2 / Nginx include templates for VPS deployment

Important notes
- This is a full-stack project template and requires careful configuration before production deployment.
- Replace all placeholder secrets in .env files and update MEMEGRAVE_ADDRESS after you deploy the contract.
- Do not store high-value admin private keys on a public VPS. Use secure vaults or multisig.
- Audit the smart contract before mainnet deployment.

Quick start (development)
1. Install dependencies (root):
   npm ci

2. Compile & test contracts:
   npx hardhat compile
   npx hardhat test

3. Frontend:
   cd frontend
   npm ci
   npm start

4. Backend:
   cd backend
   npm ci
   cp .env.example .env
   edit .env, then:
   node index.js

Deployment
- See deploy_vesta_memegrave.sh for a VestaCP automated deploy script. Read it and update variables at the top before running.
- Backend: run as systemd service or PM2 as described in the README and script.

If you want me to produce CI (GitHub Actions), update for Docker deployment, or adapt the systemd service to run as your Vesta user, tell me which and I’ll prepare the files.
```