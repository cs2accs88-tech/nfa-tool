# Testing Guide

## Framework: Vitest

We use [Vitest](https://vitest.dev/) for testing because:

- Fast parallel execution with worker threads
- Built-in code coverage via V8
- Watch mode for rapid development feedback
- Compatible with Node.js CommonJS modules
- Excellent assertion library (expect, toBe, toContain, etc.)
- No configuration headaches

## Test Structure

```
tests/
├── unit/                    # Isolated unit tests
│   ├── database/            # Schema, migrations
│   ├── services/            # Service layer tests
│   ├── controllers/         # Controller input validation
│   ├── steam/               # Steam link modules
│   └── utils/               # Utility functions
├── integration/             # Cross-module interaction tests
│   ├── importToDatabase.test.js
│   └── profileLinkWorkflow.test.js
└── performance/             # Benchmarks
    └── database.perf.test.js
```

## Running Tests

```bash
# All tests
npm run test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Performance benchmarks
npm run test:performance

# With coverage report
npm run test:coverage

# Watch mode (re-runs on file changes)
npm run test:watch
```

## Writing Tests

### Unit Test Example

```javascript
import { describe, it, expect } from 'vitest';
const { generateProfileURL } = require('../../../src/steam/steamLinkGenerator');

describe('generateProfileURL', () => {
  it('should generate URL from valid SteamID64', () => {
    const result = generateProfileURL('76561198012345678');
    expect(result.success).toBe(true);
    expect(result.url).toContain('76561198012345678');
  });
});
```

### Integration Test Example

Integration tests use a temporary database that is created before and cleaned up after each test suite:

```javascript
beforeAll(() => {
  process.env.DATABASE_FILE = 'test-specific.db';
  const { initializeDatabase } = require('../../src/database/database');
  initializeDatabase();
});

afterAll(() => {
  // Cleanup test database
});
```

## Code Coverage

Coverage is configured in `vitest.config.js`:

- **Target**: 80%+ lines, functions, branches, statements
- **Reports**: text (terminal), HTML (browser), LCOV (CI)
- **Output**: `coverage/` directory

View HTML report after running `npm run test:coverage`:
```bash
open coverage/index.html
```

## Test Categories

### Unit Tests
Test individual functions in isolation. No database, no I/O.

### Integration Tests
Test how modules work together. Use temporary test databases.

### Performance Tests
Benchmark critical paths with timing assertions:
- 1,000 inserts < 2 seconds
- Search across 10,000 records < 500ms
- Batch operations < 3 seconds

## CI Integration

Tests run automatically on every push via GitHub Actions.
See `.github/workflows/ci.yml` for the pipeline configuration.
