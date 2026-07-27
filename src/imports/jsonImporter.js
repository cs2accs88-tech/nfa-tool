const fs = require('fs/promises');

/**
 * Parse JSON files into a raw account array.
 */
async function parseJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  let payload;

  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON parse error: ${error.message}`);
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.accounts)) {
    return payload.accounts;
  }

  throw new Error('JSON import must contain an array of account objects or { accounts: [] }.');
}

module.exports = {
  parseJsonFile
};
