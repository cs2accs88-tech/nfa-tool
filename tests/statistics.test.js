const assert = require('node:assert');
const { initDatabase, getDatabase } = require('../src/database/database');
const {
  getTotalAccounts,
  getAccountStatusStats,
  getRankStats,
  getInventoryStats,
  getRecentActivity,
  getCompleteDashboardStats,
  exportStatisticsJson,
  exportStatisticsCsv,
  clearStatisticsCache
} = require('../src/statistics/statisticsService');

function clearTables() {
  const db = getDatabase();
  db.prepare('DELETE FROM accounts').run();
  db.prepare('DELETE FROM activity_logs').run();
  db.prepare('VACUUM').run();
}

function createAccount(db, account) {
  return db.prepare(`
    INSERT INTO accounts (
      steamId64,
      username,
      displayName,
      profileUrl,
      accountCreated,
      country,
      notes,
      competitiveRank,
      premierRating,
      level,
      xp,
      hoursPlayed,
      lastGamePlayed,
      primeStatus,
      vacStatus,
      gameBanStatus,
      tradeRestrictionStatus,
      communityBanStatus,
      cooldownStatus,
      verificationStatus,
      inventoryValue,
      inventoryItems,
      rareItems,
      inventoryPrivacy,
      lastInventoryUpdate,
      serviceMedals,
      medalList,
      achievementCount,
      specialBadges,
      dateAdded,
      lastUpdated,
      lastChecked,
      checkHistory,
      changesLog,
      tags
    ) VALUES (
      @steamId64,
      @username,
      @displayName,
      @profileUrl,
      @accountCreated,
      @country,
      @notes,
      @competitiveRank,
      @premierRating,
      @level,
      @xp,
      @hoursPlayed,
      @lastGamePlayed,
      @primeStatus,
      @vacStatus,
      @gameBanStatus,
      @tradeRestrictionStatus,
      @communityBanStatus,
      @cooldownStatus,
      @verificationStatus,
      @inventoryValue,
      @inventoryItems,
      @rareItems,
      @inventoryPrivacy,
      @lastInventoryUpdate,
      @serviceMedals,
      @medalList,
      @achievementCount,
      @specialBadges,
      @dateAdded,
      @lastUpdated,
      @lastChecked,
      @checkHistory,
      @changesLog,
      @tags
    )
  `).run(account);
}

describe('Statistics Service', () => {
  before(() => {
    initDatabase();
    clearTables();
  });

  it('should return zero statistics for empty database', () => {
    const total = getTotalAccounts();
    assert.strictEqual(total.totalAccounts, 0);
    assert.strictEqual(total.activeAccounts, 0);
    assert.strictEqual(total.recentlyAdded, 0);
    assert.strictEqual(total.recentlyUpdated, 0);
    assert.strictEqual(total.accountsWithMissingInfo, 0);

    const status = getAccountStatusStats();
    assert.strictEqual(status.primeAccounts, 0);
    assert.strictEqual(status.nonPrimeAccounts, 0);
    assert.strictEqual(status.vacCleanAccounts, 0);
    assert.strictEqual(status.vacBannedAccounts, 0);
    assert.strictEqual(status.cooldownAccounts, 0);
  });

  it('should calculate statistics for a populated database', () => {
    const db = getDatabase();
    createAccount(db, {
      steamId64: '76561198000000001',
      username: 'user_one',
      displayName: 'User One',
      profileUrl: 'https://steamcommunity.com/id/user_one',
      accountCreated: '2020-01-01T00:00:00Z',
      country: 'US',
      notes: 'Test account',
      competitiveRank: 10,
      premierRating: 100,
      level: 20,
      xp: 2000,
      hoursPlayed: 50.5,
      lastGamePlayed: '2024-01-01T00:00:00Z',
      primeStatus: 1,
      vacStatus: 0,
      gameBanStatus: 0,
      tradeRestrictionStatus: 0,
      communityBanStatus: 0,
      cooldownStatus: 0,
      verificationStatus: 1,
      inventoryValue: 120.5,
      inventoryItems: 10,
      rareItems: 2,
      inventoryPrivacy: 'public',
      lastInventoryUpdate: '2024-06-01T00:00:00Z',
      serviceMedals: 3,
      medalList: '[]',
      achievementCount: 50,
      specialBadges: '[]',
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      checkHistory: '[]',
      changesLog: '[]',
      tags: 'prime, active'
    });

    createAccount(db, {
      steamId64: '76561198000000002',
      username: 'user_two',
      displayName: 'User Two',
      profileUrl: 'https://steamcommunity.com/id/user_two',
      accountCreated: '2020-03-01T00:00:00Z',
      country: 'CA',
      notes: null,
      competitiveRank: 5,
      premierRating: 80,
      level: 10,
      xp: 1000,
      hoursPlayed: 20.25,
      lastGamePlayed: '2024-02-01T00:00:00Z',
      primeStatus: 0,
      vacStatus: 1,
      gameBanStatus: 0,
      tradeRestrictionStatus: 0,
      communityBanStatus: 0,
      cooldownStatus: 1,
      verificationStatus: 0,
      inventoryValue: 45.0,
      inventoryItems: 4,
      rareItems: 0,
      inventoryPrivacy: 'private',
      lastInventoryUpdate: '2024-06-10T00:00:00Z',
      serviceMedals: 1,
      medalList: '[]',
      achievementCount: 20,
      specialBadges: '[]',
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      checkHistory: '[]',
      changesLog: '[]',
      tags: 'vac,banned'
    });

    const total = getTotalAccounts();
    assert.strictEqual(total.totalAccounts, 2);
    assert.strictEqual(total.accountsWithMissingInfo, 1);

    const status = getAccountStatusStats();
    assert.strictEqual(status.primeAccounts, 1);
    assert.strictEqual(status.nonPrimeAccounts, 1);
    assert.strictEqual(status.vacCleanAccounts, 1);
    assert.strictEqual(status.vacBannedAccounts, 1);
    assert.strictEqual(status.cooldownAccounts, 1);

    const rank = getRankStats();
    assert.strictEqual(rank.averageRank > 0, true);
    assert.strictEqual(rank.highestRank, 10);
    assert.strictEqual(rank.lowestRank, 5);

    const inventory = getInventoryStats();
    assert.strictEqual(inventory.totalInventoryValue, 165.5);
    assert.strictEqual(inventory.accountsWithRareItems, 1);
    assert.strictEqual(inventory.totalRareItems, 2);

    const dashboard = getCompleteDashboardStats();
    assert.strictEqual(dashboard.accountStatistics.totalAccounts, 2);

    const jsonExport = exportStatisticsJson();
    assert.ok(jsonExport.includes('"summary"'));

    const csvExport = exportStatisticsCsv();
    assert.ok(csvExport.includes('Total Accounts'));
  });
});
