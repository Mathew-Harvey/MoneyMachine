/**
 * Reset Discovery Limits
 * Quick script to reset daily discovery counter
 */

const db = require('../database');

async function resetDiscoveryLimit() {
  try {
    await db.init();
    
    console.log('🔄 Resetting discovery limits...');
    
    // Reset discovery count
    await db.setSystemState('discovery_count_today', '0');
    await db.setSystemState('last_discovery_run', '');
    
    console.log('✅ Discovery limits reset!');
    console.log('   You can now discover new wallets again today.');
    
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetDiscoveryLimit();

