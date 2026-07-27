const fs = require('fs/promises');
const path = require('path');
const assert = require('node:assert');
const { initDatabase, getDatabase } = require('../src/database/database');
const { importFile } = require('../src/imports/importer');

const fixtureDir = path.join(__dirname, 'fixtures');

async function createFixture(fileName, contents) {
  await fs.mkdir(fixtureDir, { recursive: true });
  await fs.writeFile(path.join(fixtureDir, fileName), contents, 'utf8');
}

function clearAccounts() {
  const db = getDatabase();
  db.prepare('DELETE FROM accounts').run();
  db.prepare('VACUUM').run();
}

async function removeFixture(fileName) {
  await fs.unlink(path.join(fixtureDir, fileName)).catch(() => {});
}

describe('Importer', () => {
  before(async () => {
    initDatabase();
    clearAccounts();
  });

  after(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  });

  it('should import valid JSON data', async () => {
    const fileName = 'valid-accounts.json';
    const contents = JSON.stringify([
      {
        steamId64: '76561198000000001',
        username: 'json_user',
        primeStatus: 'yes',
        vacStatus: 'clean',
        serviceMedals: 3,
        inventoryValue: 140.5,
        rareItems: 5,
        cooldownStatus: 'false',
        lastChecked: '2025-01-01T00:00:00Z',
        notes: 'JSON import entry'
      }
    ], null, 2);

    await createFixture(fileName, contents);
    const report = await importFile(path.join(fixtureDir, fileName), { duplicateStrategy: 'add' });

    assert.strictEqual(report.imported, 1);
    assert.strictEqual(report.failed, 0);
    assert.strictEqual(report.duplicates, 0);
    await removeFixture(fileName);
  });

  it('should fail invalid JSON import', async () => {
    const fileName = 'invalid-accounts.json';
    const contents = '{ invalid json }';

    await createFixture(fileName, contents);
    const report = await importFile(path.join(fixtureDir, fileName));

    assert.strictEqual(report.imported, 0);
    assert.strictEqual(report.failed, 1);
    assert.strictEqual(report.details[0].status, 'failed');
    await removeFixture(fileName);
  });

  it('should import CSV data', async () => {
    const fileName = 'valid-accounts.csv';
    const contents = 'steamId64,username,primeStatus,vacStatus,serviceMedals,inventoryValue,rareItems,cooldownStatus,lastChecked,notes\n76561198000000002,csv_user,Yes,Clean,2,220.75,4,No,2025-02-01T10:00:00Z,CSV import entry';

    await createFixture(fileName, contents);
    const report = await importFile(path.join(fixtureDir, fileName), { duplicateStrategy: 'add' });

    assert.strictEqual(report.imported, 1);
    assert.strictEqual(report.failed, 0);
    await removeFixture(fileName);
  });

  it('should import TXT table-style data', async () => {
    const fileName = 'valid-accounts.txt';
    const contents = 'steamId64|username|primeStatus|vacStatus|serviceMedals|inventoryValue|rareItems|cooldownStatus|lastChecked|notes\n76561198000000003|txt_user|True|Clean|1|60.0|2|False|2025-03-01T12:00:00Z|TXT import entry';

    await createFixture(fileName, contents);
    const report = await importFile(path.join(fixtureDir, fileName), { duplicateStrategy: 'add' });

    assert.strictEqual(report.imported, 1);
    assert.strictEqual(report.failed, 0);
    await removeFixture(fileName);
  });

  it('should detect duplicates and skip when requested', async () => {
    const fileName = 'duplicate-accounts.json';
    const contents = JSON.stringify([
      {
        steamId64: '76561198000000001',
        username: 'json_user_duplicate',
        primeStatus: 'yes',
        vacStatus: 'clean',
        serviceMedals: 3,
        inventoryValue: 140.5,
        rareItems: 5,
        cooldownStatus: 'false',
        lastChecked: '2025-01-01T00:00:00Z',
        notes: 'Duplicate import entry'
      }
    ], null, 2);

    await createFixture(fileName, contents);
    const report = await importFile(path.join(fixtureDir, fileName), { duplicateStrategy: 'skip' });

    assert.strictEqual(report.imported, 0);
    assert.strictEqual(report.duplicates, 1);
    await removeFixture(fileName);
  });

  it('should reject invalid SteamID format', async () => {
    const fileName = 'invalid-steamid.csv';
    const contents = 'steamId64,username,primeStatus,vacStatus,serviceMedals,inventoryValue,rareItems,cooldownStatus,lastChecked,notes\n12345,invalid_user,Yes,Clean,0,0,0,No,2025-04-01T00:00:00Z,Invalid SteamID';

    await createFixture(fileName, contents);
    const report = await importFile(path.join(fixtureDir, fileName));

    assert.strictEqual(report.imported, 0);
    assert.strictEqual(report.failed, 1);
    assert.match(report.errors[0].message, /SteamID64/);
    await removeFixture(fileName);
  });
});
