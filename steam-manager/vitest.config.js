/**
 * @module vitest.config
 * @description Test framework configuration.
 * Uses Vitest for its speed, ESM support, and built-in coverage.
 *
 * Why Vitest:
 * - Fast parallel test execution
 * - Built-in code coverage via v8
 * - Compatible with Node.js test patterns
 * - Watch mode for development
 * - Excellent assertion library
 * - No extra babel/transform config needed
 */

const { defineConfig } = require('vitest/config');
const path = require('path');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.js',
      'tests/integration/**/*.test.js',
      'tests/performance/**/*.test.js'
    ],
    exclude: [
      'node_modules',
      'release',
      'dist'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: [
        'src/renderer/**',
        'src/main/index.js'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
