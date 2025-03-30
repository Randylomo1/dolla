module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^\\.(css|less)$': '<rootDir>/src/__mocks__/styleMock.js'
  }
}