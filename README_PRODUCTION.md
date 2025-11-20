```markdown
MemeGrave Production Deployment Guide
====================================

Overview
--------
This guide walks through deploying the frontend (React static) and backend (Node.js Express) on a Linux VPS (Ubuntu recommended) with Nginx (or Apache) as reverse proxy and PostgreSQL as database.

Prerequisites (on VPS)
----------------------
- Ubuntu 22.04 (or equivalent)
- sudo/root access
- Domain name pointing to VPS (A record)
- Node.js 18+ installed (use NodeSource or nvm)
- PostgreSQL installed and configured
- Nginx or Apache installed
- PM2 (optional) or systemd
- Certbot (Let's Encrypt) for TLS

High level steps
----------------
1. Setup system user and directories:
   - create user: sudo adduser memegrave
   - create directories: /var/www/memegrave (frontend), /opt/memegrave (repo)

2. Clone repo and install dependencies:
   - git clone <repo> /opt/memegrave
   - cd /opt/memegrave
   - npm ci (for contracts/hardhat if needed)
   - cd frontend && npm ci && npm run build
   - move frontend/build -> /var/www/memegrave/frontend/build

3. Configure Postgres:
   - sudo -u postgres psql
     CREATE DATABASE memegrave;
     CREATE USER memegrave_user WITH ENCRYPTED PASSWORD 'supersecurepassword';
     GRANT ALL PRIVILEGES ON DATABASE memegrave TO memegrave_user;
   - Run schema.sql to create tables:
     psql -U memegrave_user -d memegrave -f backend/schema.sql

4. Setup .env:
   - Copy backend/.env.example -> backend/.env and fill values
   - Set ADMIN_PRIVATE_KEY only if you will allow backend to do admin actions.
   - Use environment secrets manager if possible.

5. Install PM2 (optional) and start backend:
   - npm i -g pm2
   - pm2 start pm2/ecosystem.config.js
   - pm2 save
   - PM2 startup

   Or: use systemd service:
   - sudo cp systemd/memegrave.service /etc/systemd/system/
   - sudo systemctl daemon-reload
   - sudo systemctl enable memegrave
   - sudo systemctl start memegrave

6. Configure Nginx:
   - Copy deploy/nginx-memegrave.conf -> /etc/nginx/sites-available/memegrave.conf
   - Update domain and file paths
   - sudo ln -s /etc/nginx/sites-available/memegrave.conf /etc/nginx/sites-enabled/
   - Test nginx: sudo nginx -t
   - Restart nginx: sudo systemctl restart nginx

7. TLS with Let's Encrypt:
   - sudo apt install certbot python3-certbot-nginx
   - sudo certbot --nginx -d app.yourdomain.com

8. Start backend and verify:
   - curl http://127.0.0.1:4000/health
   - Visit https://app.yourdomain.com

9. On-chain deploy:
   - Deploy MemeGrave contract using Hardhat to BSC testnet/mainnet
   - Create and fund Chainlink VRF v2 subscription; add contract as consumer
   - On contract: setPriceFeed(token, feed) for tokens you accept
   - Verify contract and add its ABI to backend/contract/abi.json

10. Configure backend to listen for events and test deposit flow in testnet.

Operational tips
----------------
- Use fail2ban and UFW firewall (allow ports 22, 80, 443).
- Create periodic DB backups (pg_dump).
- Monitor logs (PM2, systemd, Nginx).
- Use a strong password for DB and limit network access.
- Consider using a managed DB service if you expect high availability.

If you want, I can:
- produce the exact systemd/pm2 commands for your VPS distribution,
- produce the Certbot command to generate certificates for your domain,
- create a production Hardhat deployment script (I can produce one ready to run after you set env vars).
```