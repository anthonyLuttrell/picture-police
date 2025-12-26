/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm', // Use the ESM-specific preset
  testEnvironment: 'node',
  clearMocks: true,
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // This resolves the ".js" imports to your ".ts" source files
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    // Configures ts-jest to handle ESM
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
};