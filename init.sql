-- MoneyMaker Database Schema

-- Wallets being tracked
CREATE TABLE IF NOT EXISTS wallets (
    address TEXT PRIMARY KEY,
    chain TEXT NOT NULL,
    strategy_type TEXT NOT NULL,
    win_rate REAL DEFAULT 0.0,
    total_pnl REAL DEFAULT 0.0,
    total_trades INTEGER DEFAULT 0,
    successful_trades INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
    avg_trade_size REAL DEFAULT 0.0,
    biggest_win REAL DEFAULT 0.0,
    biggest_loss REAL DEFAULT 0.0,
    notes TEXT
);

-- Transaction history from tracked wallets
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    chain TEXT NOT NULL,
    tx_hash TEXT,
    token_address TEXT NOT NULL,
    token_symbol TEXT,
    action TEXT NOT NULL,
    amount REAL NOT NULL,
    price_usd REAL,
    total_value_usd REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    block_number INTEGER,
    FOREIGN KEY (wallet_address) REFERENCES wallets(address),
    UNIQUE(wallet_address, tx_hash, chain)  -- Prevent duplicate transactions
);

-- Paper trading positions
CREATE TABLE IF NOT EXISTS paper_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_address TEXT NOT NULL,
    token_symbol TEXT,
    chain TEXT NOT NULL,
    strategy_used TEXT NOT NULL,
    source_wallet TEXT,
    entry_price REAL NOT NULL,
    exit_price REAL,
    amount REAL NOT NULL,
    entry_value_usd REAL NOT NULL,
    exit_value_usd REAL,
    pnl REAL DEFAULT 0.0,
    pnl_percentage REAL DEFAULT 0.0,
    status TEXT DEFAULT 'open',
    entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    exit_time DATETIME,
    exit_reason TEXT,
    notes TEXT
);

-- Discovered wallets pending promotion
CREATE TABLE IF NOT EXISTS discovered_wallets (
    address TEXT PRIMARY KEY,
    chain TEXT NOT NULL,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    profitability_score REAL DEFAULT 0.0,
    estimated_win_rate REAL DEFAULT 0.0,
    tracked_trades INTEGER DEFAULT 0,
    successful_tracked_trades INTEGER DEFAULT 0,
    promoted BOOLEAN DEFAULT 0,
    promoted_date DATETIME,
    rejection_reason TEXT,
    discovery_method TEXT,
    notes TEXT
);

-- Token metadata cache
CREATE TABLE IF NOT EXISTS tokens (
    address TEXT PRIMARY KEY,
    chain TEXT NOT NULL,
    symbol TEXT,
    name TEXT,
    decimals INTEGER DEFAULT 18,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    creation_time DATETIME,
    initial_liquidity_usd REAL,
    current_price_usd REAL,
    max_price_usd REAL,
    market_cap_usd REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics by strategy
CREATE TABLE IF NOT EXISTS strategy_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_type TEXT NOT NULL,
    date DATE NOT NULL,
    trades_count INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_pnl REAL DEFAULT 0.0,
    allocated_capital REAL,
    current_capital REAL,
    roi_percentage REAL DEFAULT 0.0,
    sharpe_ratio REAL,
    max_drawdown REAL,
    UNIQUE(strategy_type, date)
);

-- System state and configuration
CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Wallet clusters (groups of similar wallets)
CREATE TABLE IF NOT EXISTS wallet_clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cluster_name TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mapping of wallets to clusters
CREATE TABLE IF NOT EXISTS wallet_cluster_members (
    wallet_address TEXT NOT NULL,
    cluster_id INTEGER NOT NULL,
    confidence_score REAL DEFAULT 1.0,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_address) REFERENCES wallets(address),
    FOREIGN KEY (cluster_id) REFERENCES wallet_clusters(id),
    PRIMARY KEY (wallet_address, cluster_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_token ON transactions(token_address);
CREATE INDEX IF NOT EXISTS idx_paper_trades_status ON paper_trades(status);
CREATE INDEX IF NOT EXISTS idx_paper_trades_strategy ON paper_trades(strategy_used);
CREATE INDEX IF NOT EXISTS idx_discovered_promoted ON discovered_wallets(promoted);
CREATE INDEX IF NOT EXISTS idx_wallets_strategy ON wallets(strategy_type);
CREATE INDEX IF NOT EXISTS idx_wallets_status ON wallets(status);

-- Insert initial system state
INSERT OR IGNORE INTO system_state (key, value) VALUES ('total_capital', '10000');
INSERT OR IGNORE INTO system_state (key, value) VALUES ('available_capital', '10000');
INSERT OR IGNORE INTO system_state (key, value) VALUES ('last_discovery_run', '');
INSERT OR IGNORE INTO system_state (key, value) VALUES ('discovery_count_today', '0');
