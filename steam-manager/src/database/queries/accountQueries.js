function buildInsertAccountParams(account) {
  return {
    steamId64: account.steamId64,
    username: account.username,
    displayName: account.displayName || null,
    profileUrl: account.profileUrl || null,
    notes: account.notes || null,
    tags: account.tags || null,
    primeStatus: account.primeStatus ? 1 : 0,
    vacStatus: account.vacStatus ? 1 : 0,
    gameBanStatus: account.gameBanStatus ? 1 : 0,
    cooldownStatus: account.cooldownStatus ? 1 : 0,
    accountStatus: account.accountStatus || null,
    rank: account.rank === null || account.rank === undefined ? null : account.rank,
    level: account.level === null || account.level === undefined ? null : account.level,
    hoursPlayed: account.hoursPlayed === null || account.hoursPlayed === undefined ? null : account.hoursPlayed,
    rating: account.rating === null || account.rating === undefined ? null : account.rating,
    inventoryValue: account.inventoryValue || 0,
    itemCount: account.itemCount || 0,
    rareItemCount: account.rareItemCount || 0,
    medalCount: account.medalCount || 0,
    medalsList: account.medalsList || null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    lastCheckedAt: account.lastCheckedAt || null
  };
}

module.exports = {
  buildInsertAccountParams
};
