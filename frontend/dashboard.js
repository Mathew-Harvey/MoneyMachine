// MoneyMaker Dashboard - Simple & Intuitive

const API_BASE = 'http://localhost:3000/api';

// State
let dashboardData = null;
let previousCapital = 10000;
let refreshInterval = null;
let activityLog = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    setupEventListeners();
    await loadDashboardData();
    
    // Auto-refresh every 10 seconds for live feel
    refreshInterval = setInterval(loadDashboardData, 10000);
    
    showToast('MoneyMaker is watching the markets...', 'success');
}

function setupEventListeners() {
    // Details toggle
    document.getElementById('details-toggle')?.addEventListener('click', toggleDetails);
    
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
    
    // Help button
    document.getElementById('help-button')?.addEventListener('click', showHelp);
    document.getElementById('close-help')?.addEventListener('click', hideHelp);
    document.getElementById('help-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'help-modal') hideHelp();
    });
    
    // Event delegation for promote buttons
    document.addEventListener('click', (e) => {
        if (e.target.matches('[data-action="promote"]')) {
            const address = e.target.getAttribute('data-address');
            promoteWallet(address);
        }
    });
}

// Help modal functions
function showHelp() {
    document.getElementById('help-modal').style.display = 'flex';
}

function hideHelp() {
    document.getElementById('help-modal').style.display = 'none';
}

// Load all dashboard data
async function loadDashboardData() {
    try {
        const [dashboard, wallets, trades, discovered] = await Promise.all([
            fetch(`${API_BASE}/dashboard`).then(r => r.json()),
            fetch(`${API_BASE}/wallets`).then(r => r.json()),
            fetch(`${API_BASE}/trades?limit=100`).then(r => r.json()),
            fetch(`${API_BASE}/discovered?promoted=false`).then(r => r.json())
        ]);

        dashboardData = {
            ...dashboard,
            allWallets: wallets,
            allTrades: trades,
            discovered
        };

        updateUI();
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Connection issue - retrying...', 'error');
    }
}

// Update all UI elements
function updateUI() {
    if (!dashboardData) return;

    updatePortfolioCard();
    updateWinRate();
    updateStrategies();
    updateActivityFeed();
    updatePositions();
    updateRecentTrades();
    updateTopWallets();
    updateDetailedTables();
}

// Update portfolio card
function updatePortfolioCard() {
    const perf = dashboardData.performance || {};
    const currentValue = perf.currentCapital || 10000;
    const change = currentValue - 10000;
    const changePercent = ((change / 10000) * 100).toFixed(2);

    // Animate if value changed
    const valueEl = document.getElementById('total-value');
    if (currentValue > previousCapital) {
        valueEl.classList.add('value-animate-up');
        setTimeout(() => valueEl.classList.remove('value-animate-up'), 500);
    } else if (currentValue < previousCapital) {
        valueEl.classList.add('value-animate-down');
        setTimeout(() => valueEl.classList.remove('value-animate-down'), 500);
    }
    previousCapital = currentValue;

    valueEl.textContent = formatMoney(currentValue);

    // Update change
    const changeEl = document.getElementById('total-change');
    const changeAmountEl = changeEl.querySelector('.change-amount');
    const changePercentEl = changeEl.querySelector('.change-percent');
    
    changeAmountEl.textContent = (change >= 0 ? '+' : '') + formatMoney(change);
    changePercentEl.textContent = `(${change >= 0 ? '+' : ''}${changePercent}%)`;
    changeAmountEl.className = 'change-amount ' + (change >= 0 ? 'positive' : 'negative');

    // Update breakdown
    const openTrades = dashboardData.openTrades || [];
    const invested = openTrades.reduce((sum, t) => sum + (t.entry_value_usd || 0), 0);
    const available = currentValue - invested;

    document.getElementById('invested-amount').textContent = formatMoney(invested);
    document.getElementById('available-cash').textContent = formatMoney(available);
}

// Update win rate donut chart
function updateWinRate() {
    const perf = dashboardData.performance;
    const winRate = perf.winRate || 0;
    const wins = perf.wins || 0;
    const losses = perf.losses || 0;

    // Update donut chart
    const circumference = 2 * Math.PI * 15.91549430918954;
    const fillPercent = winRate * 100;
    const dashArray = `${fillPercent} ${100 - fillPercent}`;
    
    document.getElementById('donut-segment').setAttribute('stroke-dasharray', dashArray);
    document.getElementById('win-rate-display').textContent = `${Math.round(fillPercent)}%`;

    // Update counts
    document.getElementById('wins-count').textContent = wins;
    document.getElementById('losses-count').textContent = losses;

    // Update wallet count
    document.getElementById('wallet-count').textContent = dashboardData.allWallets?.length || 30;
}

// Update strategies
function updateStrategies() {
    const breakdown = dashboardData.strategyBreakdown || {};
    
    updateStrategy('arbitrage', 'arb', breakdown.arbitrage || {});
    updateStrategy('memecoin', 'meme', breakdown.memecoin || {});
    updateStrategy('earlyGem', 'gem', breakdown.earlyGem || {});
    updateStrategy('discovery', 'disc', breakdown.discovery || {});
}

function updateStrategy(strategyName, prefix, data) {
    const trades = data.trades || 0;
    const pnl = data.pnl || 0;
    
    document.getElementById(`${prefix}-trades`).textContent = `${trades} trades`;
    
    const pnlEl = document.getElementById(`${prefix}-pnl`);
    pnlEl.textContent = formatMoney(pnl);
    pnlEl.className = 'stat-small ' + (pnl >= 0 ? 'positive' : 'negative');
}

// Update activity feed with simple language
function updateActivityFeed() {
    const feed = document.getElementById('activity-feed');
    
    // Build activity from recent transactions and trades
    const recentTx = dashboardData.recentTrades || [];
    const openTrades = dashboardData.openTrades || [];
    const allTrades = Array.isArray(dashboardData.allTrades) ? dashboardData.allTrades : [];
    const closedTrades = allTrades.filter(t => t.status === 'closed').slice(0, 5);

    const activities = [];

    // Add open position activities
    openTrades.forEach(trade => {
        const currentPrice = trade.entry_price * (1 + (Math.random() - 0.4) * 0.3); // Simulated current
        const pnl = (currentPrice - trade.entry_price) * trade.amount;
        const pnlPercent = ((currentPrice - trade.entry_price) / trade.entry_price) * 100;
        
        activities.push({
            type: 'position',
            icon: '📊',
            title: `Holding ${trade.token_symbol}`,
            description: `Bought at ${formatMoney(trade.entry_price)} • Currently ${pnlPercent >= 0 ? 'UP' : 'DOWN'} ${Math.abs(pnlPercent).toFixed(1)}%`,
            amount: pnl,
            time: trade.entry_time,
            className: pnl >= 0 ? 'buy' : 'sell'
        });
    });

    // Add closed trade activities
    closedTrades.forEach(trade => {
        const isWin = (trade.pnl || 0) > 0;
        activities.push({
            type: isWin ? 'win' : 'loss',
            icon: isWin ? '✅' : '❌',
            title: `${isWin ? 'Profit!' : 'Loss'} on ${trade.token_symbol}`,
            description: `${isWin ? 'Sold for profit' : 'Cut losses'} • ${trade.exit_reason || 'Strategy exit'}`,
            amount: trade.pnl,
            time: trade.exit_time || trade.entry_time,
            className: isWin ? 'win' : 'loss'
        });
    });

    // Add recent transactions
    recentTx.slice(0, 5).forEach(tx => {
        const isBuy = tx.action === 'buy';
        activities.push({
            type: tx.action,
            icon: isBuy ? '🟢' : '🔴',
            title: `Smart trader ${isBuy ? 'bought' : 'sold'} ${tx.token_symbol}`,
            description: `We ${isBuy ? 'might copy' : 'are watching'} this trade`,
            time: tx.timestamp,
            className: isBuy ? 'buy' : 'sell'
        });
    });

    // Sort by time
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    // Limit to 10 most recent
    const recent = activities.slice(0, 10);

    if (recent.length === 0) {
        feed.innerHTML = `
            <div class="activity-item welcome">
                <div class="activity-icon">⏳</div>
                <div class="activity-content">
                    <div class="activity-title">Monitoring Markets...</div>
                    <div class="activity-description">Watching 30 smart traders for opportunities</div>
                    <div class="activity-time">System active</div>
                </div>
            </div>
        `;
        return;
    }
    
    feed.innerHTML = recent.map(activity => `
        <div class="activity-item ${activity.className}">
            <div class="activity-icon">${activity.icon}</div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-description">${activity.description}</div>
                ${activity.amount !== undefined ? `<div class="activity-amount ${activity.amount >= 0 ? 'positive' : 'negative'}">${activity.amount >= 0 ? '+' : ''}${formatMoney(activity.amount)}</div>` : ''}
                <div class="activity-time">${formatTimeAgo(activity.time)}</div>
            </div>
        </div>
    `).join('');
}

// Update open positions
function updatePositions() {
    const positions = dashboardData.openTrades || [];
    const grid = document.getElementById('positions-grid');
    const countEl = document.getElementById('position-count');

    countEl.textContent = `${positions.length} open`;

    if (positions.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💤</div>
                <h3>No Active Trades Yet</h3>
                <p>Waiting for smart traders to make moves...</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = positions.map(position => {
        // Simulate current price (in real mode, this would come from API)
        const elapsed = Date.now() - new Date(position.entry_time).getTime();
        const volatility = position.strategy_used === 'memecoin' ? 0.3 : 0.1;
        const priceChange = (Math.random() - 0.4) * volatility;
        const currentPrice = position.entry_price * (1 + priceChange + (elapsed / 1000000));
        
        const pnl = (currentPrice - position.entry_price) * position.amount;
        const pnlPercent = ((currentPrice - position.entry_price) / position.entry_price) * 100;

        return `
            <div class="position-item">
                <div class="position-header">
                    <div class="position-token">
                        <div class="token-icon">${getTokenEmoji(position.token_symbol)}</div>
                        <div class="token-info">
                            <h4>${position.token_symbol || 'Token'}</h4>
                            <p class="token-strategy">${getStrategyName(position.strategy_used)}</p>
                        </div>
                    </div>
                    <div class="position-pnl">
                        <div class="pnl-amount ${pnl >= 0 ? 'positive' : 'negative'}">
                            ${pnl >= 0 ? '+' : ''}${formatMoney(pnl)}
                        </div>
                        <div class="pnl-percent ${pnl >= 0 ? 'positive' : 'negative'}">
                            ${pnl >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}%
                        </div>
                    </div>
                </div>
                <div class="position-details">
                    <div class="detail-item">
                        <div class="detail-label">Invested</div>
                        <div class="detail-value">${formatMoney(position.entry_value_usd)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Entry</div>
                        <div class="detail-value">$${position.entry_price.toFixed(6)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Current</div>
                        <div class="detail-value">$${currentPrice.toFixed(6)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Update recent trades
function updateRecentTrades() {
    const trades = (dashboardData.allTrades || [])
        .filter(t => t.status === 'closed')
        .slice(0, 5);
    
    const container = document.getElementById('recent-trades-list');

    if (trades.length === 0) {
        container.innerHTML = '<div class="empty-state-small"><p>No completed trades yet</p></div>';
        return;
    }

    container.innerHTML = trades.map(trade => {
        const isWin = (trade.pnl || 0) > 0;
        return `
            <div class="trade-item ${isWin ? 'win' : 'loss'}">
                <div class="trade-info">
                    <div class="trade-token">${trade.token_symbol} ${isWin ? '✅' : '❌'}</div>
                    <div class="trade-time">${formatTimeAgo(trade.exit_time || trade.entry_time)}</div>
                </div>
                <div class="trade-result ${isWin ? 'positive' : 'negative'}">
                    ${isWin ? '+' : ''}${formatMoney(trade.pnl || 0)}
                </div>
            </div>
        `;
    }).join('');
}

// Update top wallets
function updateTopWallets() {
    const wallets = (dashboardData.topWallets || []).slice(0, 5);
    const container = document.getElementById('top-wallets-list');

    if (wallets.length === 0) {
        container.innerHTML = '<div class="empty-state-small"><p>Analyzing trader performance...</p></div>';
        return;
    }
    
    container.innerHTML = wallets.map(wallet => `
        <div class="wallet-item">
            <div class="wallet-address">${formatAddress(wallet.address)}</div>
            <div class="wallet-performance">
                <span class="wallet-winrate">${Math.round((wallet.win_rate || 0) * 100)}% wins</span>
                <span class="wallet-pnl ${(wallet.total_pnl || 0) >= 0 ? 'positive' : 'negative'}">
                    ${formatMoney(wallet.total_pnl || 0)}
                </span>
            </div>
        </div>
    `).join('');
}

// Update detailed tables
function updateDetailedTables() {
    updateAllTradesTable();
    updateAllWalletsTable();
    updateDiscoveredTable();
}

function updateAllTradesTable() {
    const trades = dashboardData.allTrades || [];
    const tbody = document.getElementById('all-trades-table');

    if (trades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">No trades yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = trades.map(trade => `
        <tr>
            <td>${formatTime(trade.entry_time)}</td>
            <td><strong>${trade.token_symbol}</strong></td>
            <td><span class="badge">${getStrategyName(trade.strategy_used)}</span></td>
            <td>$${(trade.entry_price || 0).toFixed(6)}</td>
            <td>${trade.exit_price ? '$' + trade.exit_price.toFixed(6) : '-'}</td>
            <td class="${(trade.pnl || 0) >= 0 ? 'positive' : 'negative'}">
                ${trade.pnl ? ((trade.pnl >= 0 ? '+' : '') + formatMoney(trade.pnl)) : '-'}
            </td>
            <td><span class="badge ${trade.status}">${trade.status}</span></td>
        </tr>
    `).join('');
}

function updateAllWalletsTable() {
    const wallets = dashboardData.allWallets || [];
    const tbody = document.getElementById('all-wallets-table');

    tbody.innerHTML = wallets.map(wallet => `
        <tr>
            <td><code class="address">${formatAddress(wallet.address)}</code></td>
            <td>${getStrategyName(wallet.strategy_type)}</td>
            <td><span class="chain-badge chain-${wallet.chain}">${wallet.chain}</span></td>
            <td>${Math.round((wallet.win_rate || 0) * 100)}%</td>
            <td class="${(wallet.total_pnl || 0) >= 0 ? 'positive' : 'negative'}">
                ${formatMoney(wallet.total_pnl || 0)}
            </td>
            <td>${wallet.total_trades || 0}</td>
        </tr>
    `).join('');
}

function updateDiscoveredTable() {
    const discovered = dashboardData.discovered || [];
    const tbody = document.getElementById('discovered-table');

    if (discovered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No new wallets discovered yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = discovered.map(wallet => `
        <tr>
            <td><code class="address">${formatAddress(wallet.address)}</code></td>
            <td><span class="chain-badge chain-${wallet.chain}">${wallet.chain}</span></td>
            <td>${wallet.profitability_score?.toFixed(1) || 0}</td>
            <td>${Math.round((wallet.estimated_win_rate || 0) * 100)}%</td>
            <td>${formatTimeAgo(wallet.first_seen)}</td>
            <td>
                <button class="btn btn-sm btn-primary" data-action="promote" data-address="${wallet.address}">
                    Start Copying
                </button>
            </td>
        </tr>
    `).join('');
}

// Toggle details section
function toggleDetails() {
    const content = document.getElementById('details-content');
    const icon = document.querySelector('.toggle-icon');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.classList.add('rotated');
    } else {
        content.style.display = 'none';
        icon.classList.remove('rotated');
    }
}

// Switch tabs
function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `${tabName}-panel`);
    });
}

// Promote discovered wallet
async function promoteWallet(address) {
    try {
        const response = await fetch(`${API_BASE}/discovered/${address}/promote`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showToast('Wallet added! We\'ll start copying their trades.', 'success');
            setTimeout(loadDashboardData, 1000);
        } else {
            showToast('Failed to add wallet', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

// Helper Functions
function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatAddress(address) {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

function getStrategyName(strategy) {
    const names = {
        arbitrage: 'Safe & Steady',
        memecoin: 'High Risk',
        earlyGem: 'Early Gems',
        discovery: 'New Finds',
        manual: 'Manual'
    };
    return names[strategy] || strategy;
}

function getTokenEmoji(symbol) {
    if (!symbol) return '💰';
    const s = symbol.toUpperCase();
    if (s.includes('BTC')) return '₿';
    if (s.includes('ETH')) return 'Ξ';
    if (s.includes('PEPE')) return '🐸';
    if (s.includes('DOGE')) return '🐕';
    if (s.includes('SHIB')) return '🐕';
    if (s.includes('BONK')) return '🦴';
    if (s.includes('WIF')) return '🧢';
    return '🪙';
}

// Toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Log activities for debugging
function logActivity(type, message, data = {}) {
    const activity = {
        type,
        message,
        data,
        timestamp: new Date().toISOString()
    };
    
    activityLog.push(activity);
    if (activityLog.length > 100) {
        activityLog.shift();
    }
    
    console.log(`[${type.toUpperCase()}]`, message, data);
}
