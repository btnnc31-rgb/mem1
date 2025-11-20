-- Basic schema for MemeGrave backend
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  username VARCHAR(255),
  provider VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) UNIQUE NOT NULL,
  symbol VARCHAR(32),
  decimals INTEGER DEFAULT 18,
  price_feed VARCHAR(42),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deposits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  user_wallet VARCHAR(42),
  token_id INTEGER REFERENCES tokens(id),
  token_address VARCHAR(42),
  token_amount NUMERIC(78,0) NOT NULL,
  usd_scaled NUMERIC(78,0),
  tx_hash VARCHAR(66),
  block_number BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entries (
  id SERIAL PRIMARY KEY,
  deposit_id INTEGER REFERENCES deposits(id),
  entry_index BIGINT,
  user_wallet VARCHAR(42),
  token_address VARCHAR(42),
  token_amount NUMERIC(78,0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS draws (
  id SERIAL PRIMARY KEY,
  request_id BIGINT,
  winner_wallet VARCHAR(42),
  winner_entry_index BIGINT,
  prize_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  draw_id INTEGER REFERENCES draws(id),
  recipient VARCHAR(42),
  token_address VARCHAR(42),
  amount NUMERIC(78,0),
  tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);