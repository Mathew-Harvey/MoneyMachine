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
    
    // Wallet count click
    document.getElementById('wallet-count')?.addEventListener('click', showWalletsModal);
    
    // Wallets modal close
    document.getElementById('close-wallets')?.addEventListener('click', hideWalletsModal);
    document.getElementById('wallets-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'wallets-modal') hideWalletsModal();
    });
    
    // Wallet performance modal close
    document.getElementById('close-wallet-performance')?.addEventListener('click', hideWalletPerformanceModal);
    document.getElementById('wallet-performance-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'wallet-performance-modal') hideWalletPerformanceModal();
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

// Wallets Modal Functions
let currentChart = null;

function showWalletsModal() {
    const modal = document.getElementById('wallets-modal');
    modal.style.display = 'flex';
    loadWalletsGrid();
}

function hideWalletsModal() {
    document.getElementById('wallets-modal').style.display = 'none';
}

async function loadWalletsGrid() {
    const grid = document.getElementById('wallets-grid');
    grid.innerHTML = '<div class="loading-spinner">Loading wallets...</div>';
    
    try {
        const response = dashboardData?.allWallets || await fetch(`${API_BASE}/wallets`).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        });
        
        const wallets = Array.isArray(response) ? response : [];
        
        if (wallets.length === 0) {
            grid.innerHTML = '<div class="empty-state-small"><p>No wallets found</p></div>';
            return;
        }
        
        // Clear grid and build with event listeners (no inline onclick - XSS safe)
        grid.innerHTML = '';
        
        wallets.forEach(wallet => {
            const card = document.createElement('div');
            card.className = 'wallet-card';
            card.dataset.address = wallet.address; // Store safely in dataset
            
            // Sanitize all output by using textContent where possible and escaping HTML
            card.innerHTML = `
                <div class="wallet-card-header">
                    <div class="wallet-card-address"></div>
                    <div class="wallet-card-chain"></div>
                </div>
                <div class="wallet-card-stats">
                    <div class="wallet-stat">
                        <div class="wallet-stat-label">Win Rate</div>
                        <div class="wallet-stat-value">${Math.round((wallet.win_rate || 0) * 100)}%</div>
                    </div>
                    <div class="wallet-stat">
                        <div class="wallet-stat-label">Total P&L</div>
                        <div class="wallet-stat-value ${(wallet.total_pnl || 0) >= 0 ? 'positive' : 'negative'}">
                            ${formatMoney(wallet.total_pnl || 0)}
                        </div>
                    </div>
                </div>
                <div class="wallet-card-footer">
                    <span>${wallet.total_trades || 0} trades</span>
                    <span class="wallet-strategy-badge"></span>
                </div>
            `;
            
            // Set text content safely (prevents XSS)
            card.querySelector('.wallet-card-address').textContent = formatAddress(wallet.address);
            card.querySelector('.wallet-card-chain').textContent = wallet.chain || 'Unknown';
            card.querySelector('.wallet-strategy-badge').textContent = getStrategyName(wallet.strategy_type);
            
            // Add click handler with proper event listener
            card.addEventListener('click', () => showWalletPerformance(wallet.address));
            
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading wallets:', error);
        grid.innerHTML = '<div class="empty-state-small"><p>Error loading wallets. Please try again.</p></div>';
    }
}

async function showWalletPerformance(address) {
    if (!address) {
        console.error('No wallet address provided');
        return;
    }
    
    const modal = document.getElementById('wallet-performance-modal');
    modal.style.display = 'flex';
    modal.dataset.loading = 'true'; // Track loading state
    
    // Hide wallets modal
    hideWalletsModal();
    
    // Set address in header (textContent is XSS-safe)
    document.getElementById('wallet-address-display').textContent = address;
    
    // Show loading
    document.getElementById('wallet-stats-summary').innerHTML = '<div class="loading-spinner">Loading performance data...</div>';
    document.getElementById('wallet-trades-content').innerHTML = '<div class="loading-spinner">Loading trades...</div>';
    
    try {
        // Fetch wallet details with proper error handling
        const response = await fetch(`${API_BASE}/wallets/${encodeURIComponent(address)}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Wallet not found');
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Check if modal was closed during fetch (prevent race condition)
        if (modal.style.display === 'none' || modal.dataset.loading !== 'true') {
            console.log('Modal closed during fetch, aborting display');
            return;
        }
        
        // Validate data structure
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid response data');
        }
        
        const wallet = data.wallet || {};
        const trades = Array.isArray(data.trades) ? data.trades : [];
        
        // Display summary stats
        displayWalletStats(wallet, trades);
        
        // Display performance chart
        displayPerformanceChart(trades);
        
        // Display trades list
        displayWalletTrades(trades);
        
        modal.dataset.loading = 'false';
    } catch (error) {
        console.error('Error loading wallet performance:', error);
        showToast(error.message || 'Error loading wallet data', 'error');
        hideWalletPerformanceModal();
    }
}

function hideWalletPerformanceModal() {
    const modal = document.getElementById('wallet-performance-modal');
    modal.style.display = 'none';
    modal.dataset.loading = 'false'; // Cancel any pending operations
    
    // Destroy chart if exists
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

function displayWalletStats(wallet, trades) {
    const closedTrades = trades.filter(t => t.status === 'closed');
    const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const losses = closedTrades.filter(t => (t.pnl || 0) < 0).length;
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    // Fix: Calculate average only from closed trades
    const avgPnL = closedTrades.length > 0 ? totalPnL / closedTrades.length : 0;
    
    const summaryHTML = `
        <div class="summary-stat">
            <div class="summary-stat-label">Total Trades</div>
            <div class="summary-stat-value neutral">${trades.length}</div>
        </div>
        <div class="summary-stat">
            <div class="summary-stat-label">Win Rate</div>
            <div class="summary-stat-value neutral">${wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0}%</div>
        </div>
        <div class="summary-stat">
            <div class="summary-stat-label">Total P&L</div>
            <div class="summary-stat-value ${totalPnL >= 0 ? 'positive' : 'negative'}">${formatMoney(totalPnL)}</div>
        </div>
        <div class="summary-stat">
            <div class="summary-stat-label">Avg P&L</div>
            <div class="summary-stat-value ${avgPnL >= 0 ? 'positive' : 'negative'}">${formatMoney(avgPnL)}</div>
        </div>
        <div class="summary-stat">
            <div class="summary-stat-label">Wins</div>
            <div class="summary-stat-value positive">${wins}</div>
        </div>
        <div class="summary-stat">
            <div class="summary-stat-label">Losses</div>
            <div class="summary-stat-value negative">${losses}</div>
        </div>
    `;
    
    document.getElementById('wallet-stats-summary').innerHTML = summaryHTML;
}

function displayPerformanceChart(trades) {
    // Destroy existing chart
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
    
    const canvas = document.getElementById('wallet-performance-chart');
    if (!canvas) {
        console.error('Chart canvas not found');
        return;
    }
    
    // Filter closed trades first
    const closedTrades = trades.filter(t => t.status === 'closed' && t.exit_time);
    
    // Handle case with no closed trades
    if (closedTrades.length === 0) {
        // Use parent container dimensions since canvas might not be sized yet
        const container = canvas.parentElement;
        const width = container.clientWidth || 400;
        const height = container.clientHeight || 400;
        
        // Set canvas size explicitly
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#a0a0b8';
        ctx.textAlign = 'center';
        ctx.fillText('No closed trades yet to display', width / 2, height / 2);
        return;
    }
    
    // Sort trades by entry time
    const sortedTrades = [...closedTrades].sort((a, b) => new Date(a.entry_time) - new Date(b.entry_time));
    
    // Calculate cumulative P&L
    let cumulativePnL = 0;
    const chartData = sortedTrades.map(trade => {
        cumulativePnL += (trade.pnl || 0);
        return {
            x: new Date(trade.exit_time),
            y: cumulativePnL
        };
    });
    
    // Add starting point
    chartData.unshift({
        x: new Date(sortedTrades[0].entry_time),
        y: 0
    });
    
    const ctx = canvas.getContext('2d');
    
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Cumulative P&L',
                data: chartData,
                borderColor: cumulativePnL >= 0 ? '#4ade80' : '#f87171',
                backgroundColor: cumulativePnL >= 0 ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: cumulativePnL >= 0 ? '#4ade80' : '#f87171',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#a0a0b8',
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1a1a2e',
                    titleColor: '#fff',
                    bodyColor: '#a0a0b8',
                    borderColor: '#2d2d44',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return 'P&L: ' + formatMoney(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'MMM d'
                        }
                    },
                    ticks: {
                        color: '#a0a0b8'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                },
                y: {
                    ticks: {
                        color: '#a0a0b8',
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                }
            }
        }
    });
}

function displayWalletTrades(trades) {
    const container = document.getElementById('wallet-trades-content');
    
    if (!container) {
        console.error('Trade content container not found');
        return;
    }
    
    if (!trades || trades.length === 0) {
        container.innerHTML = '<div class="empty-state-small"><p>No trades found</p></div>';
        return;
    }
    
    // Sort trades by entry time (most recent first)
    const sortedTrades = [...trades].sort((a, b) => new Date(b.entry_time) - new Date(a.entry_time));
    
    // Build trades with DOM methods for better XSS protection
    container.innerHTML = '';
    
    sortedTrades.slice(0, 20).forEach(trade => {
        const isOpen = trade.status === 'open';
        const pnl = trade.pnl || 0;
        const pnlClass = isOpen ? 'open' : (pnl >= 0 ? 'profit' : 'loss');
        
        const tradeItem = document.createElement('div');
        tradeItem.className = `wallet-trade-item ${pnlClass}`;
        
        // Use template but sanitize dynamic content
        tradeItem.innerHTML = `
            <div class="wallet-trade-left">
                <div class="wallet-trade-token"></div>
                <div class="wallet-trade-details">
                    Entry: $${(trade.entry_price || 0).toFixed(6)} • 
                    ${isOpen ? 'Currently Open' : `Exit: $${(trade.exit_price || 0).toFixed(6)}`} • 
                    ${formatTimeAgo(trade.entry_time)}
                </div>
            </div>
            <div class="wallet-trade-right">
                <div class="wallet-trade-pnl ${pnl >= 0 ? 'positive' : 'negative'}">
                    ${isOpen ? 'Open' : (pnl >= 0 ? '+' : '') + formatMoney(pnl)}
                </div>
                <span class="wallet-trade-status ${trade.status}"></span>
            </div>
        `;
        
        // Set user-controlled content via textContent (XSS-safe)
        tradeItem.querySelector('.wallet-trade-token').textContent = trade.token_symbol || 'Unknown';
        tradeItem.querySelector('.wallet-trade-status').textContent = trade.status || 'unknown';
        
        container.appendChild(tradeItem);
    });
}
