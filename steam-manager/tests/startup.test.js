const assert = require('node:assert');
const { execSync } = require('child_process');

describe('Startup Test', () => {
  it('should start Steam Manager successfully', () => {
    const output = execSync('node src/main/index.js', { encoding: 'utf8' });
    assert.ok(output.includes('Steam Manager started successfully'));
  });
});
