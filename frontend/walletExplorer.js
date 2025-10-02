/**
 * Wallet Explorer
 * Additional functionality for exploring wallet details
 */

// Wallet detail modal
function showWalletDetails(address) {
    // TODO: Implement wallet detail modal
    console.log('Show details for wallet:', address);
}

// Export wallet data
function exportWalletData() {
    const data = dashboardData;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-tracker-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Data exported successfully', 'success');
}

// Wallet comparison
async function compareWallets(address1, address2) {
    try {
        const response1 = await fetch(`${API_BASE}/wallets/${address1}`);
        const response2 = await fetch(`${API_BASE}/wallets/${address2}`);
        
        const wallet1 = await response1.json();
        const wallet2 = await response2.json();
        
        console.log('Comparison:', wallet1, wallet2);
        showToast('Wallet comparison loaded', 'info');
    } catch (error) {
        console.error('Error comparing wallets:', error);
        showToast('Failed to compare wallets', 'error');
    }
}

// Performance chart (simplified)
function drawPerformanceChart(data) {
    // In a real implementation, you'd use a charting library like Chart.js
    console.log('Drawing chart with data:', data);
}

// Search wallets
function searchWallets(query) {
    const wallets = Array.from(document.querySelectorAll('#wallets-body tr'));
    
    wallets.forEach(row => {
        const text = row.textContent.toLowerCase();
        const matches = text.includes(query.toLowerCase());
        row.style.display = matches ? '' : 'none';
    });
}

// Sort table
function sortTable(tableId, columnIndex, ascending = true) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        const aText = a.cells[columnIndex]?.textContent || '';
        const bText = b.cells[columnIndex]?.textContent || '';
        
        // Try to parse as number
        const aNum = parseFloat(aText.replace(/[^0-9.-]/g, ''));
        const bNum = parseFloat(bText.replace(/[^0-9.-]/g, ''));
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return ascending ? aNum - bNum : bNum - aNum;
        }
        
        return ascending ? aText.localeCompare(bText) : bText.localeCompare(aText);
    });
    
    rows.forEach(row => tbody.appendChild(row));
}

// Copy address to clipboard
function copyAddress(address) {
    navigator.clipboard.writeText(address)
        .then(() => showToast('Address copied!', 'success'))
        .catch(() => showToast('Failed to copy address', 'error'));
}

// View on explorer
function viewOnExplorer(address, chain) {
    const explorers = {
        ethereum: `https://etherscan.io/address/${address}`,
        solana: `https://solscan.io/account/${address}`,
        base: `https://basescan.org/address/${address}`,
        arbitrum: `https://arbiscan.io/address/${address}`
    };
    
    const url = explorers[chain];
    if (url) {
        window.open(url, '_blank');
    }
}

// Wallet health score
function calculateWalletHealth(wallet) {
    let score = 0;
    
    // Win rate (40 points)
    score += wallet.win_rate * 40;
    
    // Profitability (30 points)
    if (wallet.total_pnl > 500) score += 30;
    else if (wallet.total_pnl > 200) score += 20;
    else if (wallet.total_pnl > 0) score += 10;
    
    // Trade count (15 points)
    if (wallet.total_trades > 20) score += 15;
    else if (wallet.total_trades > 10) score += 10;
    else if (wallet.total_trades > 5) score += 5;
    
    // Consistency (15 points)
    if (wallet.successful_trades > 0 && wallet.total_trades > 0) {
        const consistency = wallet.successful_trades / wallet.total_trades;
        score += consistency * 15;
    }
    
    return Math.round(score);
}

// Get health color
function getHealthColor(score) {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#3b82f6'; // blue
    if (score >= 40) return '#f59e0b'; // yellow
    return '#ef4444'; // red
}

// Format large numbers
function formatLargeNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

// Calculate ROI
function calculateROI(trades) {
    if (!trades || trades.length === 0) return 0;
    
    const totalInvested = trades.reduce((sum, t) => sum + t.entry_value_usd, 0);
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    return totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
}

// Get strategy emoji
function getStrategyEmoji(strategy) {
    const emojis = {
        arbitrage: '⚖️',
        memecoin: '🚀',
        earlyGem: '💎',
        discovery: '🔍'
    };
    
    return emojis[strategy] || '📊';
}

// Get chain emoji
function getChainEmoji(chain) {
    const emojis = {
        ethereum: '⟠',
        solana: '◎',
        base: '🔵',
        arbitrum: '🔷'
    };
    
    return emojis[chain] || '🔗';
}

// Filter by date range
function filterByDateRange(startDate, endDate) {
    // TODO: Implement date range filtering
    console.log('Filter by date range:', startDate, endDate);
}

// Export to CSV
function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }
    
    const headers = Object.keys(data[0]);
    const csv = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => 
                JSON.stringify(row[header] || '')
            ).join(',')
        )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('CSV exported successfully', 'success');
}

// Make functions available globally
window.showWalletDetails = showWalletDetails;
window.exportWalletData = exportWalletData;
window.compareWallets = compareWallets;
window.copyAddress = copyAddress;
window.viewOnExplorer = viewOnExplorer;
window.exportToCSV = exportToCSV;


