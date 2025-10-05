# 🔧 Quick Server Patch Commands

## Option 1: Automated Patch Script

**Copy this to your server and run it:**

```bash
cd ~/projects/MoneyMachine

# Download the patch script (if you have the file)
# bash server_patch.sh

# OR run these commands directly:

# 1. Backup files
cp backend/database.js backend/database.js.backup
cp frontend/dashboard.js frontend/dashboard.js.backup

# 2. Fix database.js (comment out the problematic line)
sed -i '115s/await this\.run/\/\/ await this.run/' backend/database.js
sed -i '116s/console\.log/\/\/ console.log/' backend/database.js

# 3. Restart
pm2 restart MoneyMaker
pm2 logs MoneyMaker --lines 50
```

---

## Option 2: Manual One-Liner Fix

**Simplest solution - Just comment out the migration:**

```bash
cd ~/projects/MoneyMachine
sed -i 's/await this\.run(`ALTER TABLE paper_trades ADD COLUMN peak_price REAL`);/\/\/ Column already exists - migration skipped/' backend/database.js
pm2 restart MoneyMaker
```

---

## Option 3: Quick File Edit

```bash
cd ~/projects/MoneyMachine
nano backend/database.js
```

**Find lines 111-123, replace entire `runMigrations()` function with:**

```javascript
  async runMigrations() {
    try {
      const tableInfo = await this.query(`PRAGMA table_info(paper_trades)`);
      const hasPeakPrice = tableInfo.some(col => col.name === 'peak_price');
      
      if (!hasPeakPrice) {
        await this.run(`ALTER TABLE paper_trades ADD COLUMN peak_price REAL`);
        console.log('✓ Migration: Added peak_price column');
      } else {
        console.log('✓ Database schema up to date');
      }
    } catch (error) {
      console.warn('Migration warning:', error.message);
    }
  }
```

**Save (Ctrl+X, Y, Enter) then:**

```bash
pm2 restart MoneyMaker
```

---

## Recommended: Option 2 (Fastest)

Run this single command on your server:

```bash
cd ~/projects/MoneyMachine && sed -i '115c\      // Column already exists - migration skipped' backend/database.js && pm2 restart MoneyMaker && pm2 logs MoneyMaker
```

This will:
1. Comment out the problematic migration
2. Restart the server
3. Show you the logs

**Should start successfully and begin trading!** 🚀

