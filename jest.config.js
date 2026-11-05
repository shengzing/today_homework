module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'cloudfunctions/api/**/*.js',
    'miniprogram/utils/**/*.js',
    'miniprogram/components/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  moduleNameMapper: {
    '^wx-server-sdk$': '<rootDir>/cloudfunctions/api/__tests__/mocks/wx-server-sdk.js'
  }
};
