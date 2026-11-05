module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/cloudfunctions/api/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'cloudfunctions/api/**/*.js',
    '!cloudfunctions/api/__tests__/**',
    '!cloudfunctions/api/package.json'
  ],
  coverageDirectory: 'coverage/backend',
  coverageThreshold: {
    global: { branches: 80, functions: 85, lines: 85, statements: 85 }
  },
  moduleNameMapper: {
    '^wx-server-sdk$': '<rootDir>/cloudfunctions/api/__tests__/mocks/wx-server-sdk.js'
  }
};
