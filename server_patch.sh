#!/bin/bash
# Quick patch for server deployment
# Run this on your server: bash server_patch.sh

cd ~/projects/MoneyMachine

echo "🔧 Patching database.js migration..."

# Backup original
cp backend/database.js backend/database.js.backup

# Create the fixed migration function
cat > /tmp/migration_fix.js << 'ENDFIX'
  // Run database migrations for schema updates
  async runMigrations() {
    try {
      // Check if peak_price column exists
      const tableInfo = await this.query(\`PRAGMA table_info(paper_trades)\`);
      const hasPeakPrice = tableInfo.some(col => col.name === 'peak_price');
      
      if (!hasPeakPrice) {
        await this.run(\`ALTER TABLE paper_trades ADD COLUMN peak_price REAL\`);
        console.log('✓ Migration: Added peak_price column');
      } else {
        console.log('✓ Database schema up to date');
      }
    } catch (error) {
      console.warn('Migration warning:', error.message);
      // Don't fail startup on migration errors
    }
  }
ENDFIX

# Use sed to replace the runMigrations function (lines 111-123)
sed -i '111,123d' backend/database.js
sed -i '110r /tmp/migration_fix.js' backend/database.js

echo "✅ Patched database.js"
echo ""
echo "🔧 Patching frontend/dashboard.js..."

# Fix frontend updateStrategy function
sed -i '204,211d' frontend/dashboard.js
cat > /tmp/strategy_fix.js << 'ENDFIX2'
function updateStrategy(strategyName, prefix, data) {
    const trades = data.trades || 0;
    const pnl = data.pnl || 0;
    
    // Check if elements exist (may not exist for all strategies in UI)
    const tradesEl = document.getElementById(\`\${prefix}-trades\`);
    const pnlEl = document.getElementById(\`\${prefix}-pnl\`);
    
    if (tradesEl) {
        tradesEl.textContent = \`\${trades} trades\`;
    }
    
    if (pnlEl) {
        pnlEl.textContent = formatMoney(pnl);
        pnlEl.className = 'stat-small ' + (pnl >= 0 ? 'positive' : 'negative');
    }
}
ENDFIX2

sed -i '203r /tmp/strategy_fix.js' frontend/dashboard.js

echo "✅ Patched dashboard.js"
echo ""
echo "📦 Files patched successfully!"
echo "🚀 Now run: pm2 restart MoneyMaker && pm2 logs MoneyMaker"

