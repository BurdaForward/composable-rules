export default {
  preset: "ts-jest",
  testEnvironment: "node",
  coverageProvider: "v8",
  clearMocks: true,
  setupFiles: [],
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!<rootDir>/node_modules/",
    "!<rootDir>/dist/",
    "!src/**/types.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  transform: {},
};
