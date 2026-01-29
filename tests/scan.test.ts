import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the gvis module using unstable_mockModule for ESM support
jest.unstable_mockModule('../src/gvis', () => ({
  checkGoogleVision: jest.fn(),
}));

// Import modules dynamically after mocking
const { reverseImageSearch } = await import('../src/scan');
const { checkGoogleVision } = await import('../src/gvis');

const fixturesDir = path.join(__dirname, 'fixtures');
const fixtureFiles = fs.readdirSync(fixturesDir).filter(file => file.endsWith('.json'));

describe('Scan Simulation Tests', () => {
  fixtureFiles.forEach(file => {
    const fixturePath = path.join(fixturesDir, file);
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

    test(`${file}: ${fixture.description}`, async () => {
      const mockFn = checkGoogleVision as jest.Mock;
      mockFn.mockReset();

      // Handle mock responses
      if (Array.isArray(fixture.mockVisionResponse)) {
         fixture.mockVisionResponse.forEach((res: any) => mockFn.mockResolvedValueOnce(res));
      } else {
         mockFn.mockResolvedValue(fixture.mockVisionResponse);
      }

      const matches = await reverseImageSearch(
        fixture.input.apiKey,
        fixture.input.sourceUrls,
        fixture.input.authorName
      );

      // Assertions
      if (fixture.expected.matchCount !== undefined) {
         expect(matches.length).toBe(fixture.expected.matchCount);
      }

      matches.forEach((match: any, index: number) => {
         if (fixture.expected.scores && fixture.expected.scores[index] !== undefined) {
             expect(match.score).toBe(fixture.expected.scores[index]);
         }

         if (fixture.expected.matches && fixture.expected.matches[index]) {
             const expectedUrls = fixture.expected.matches[index];
             // We check that actual matches contain all expected URLs
             expect(match.matches).toEqual(expect.arrayContaining(expectedUrls));
             // And that lengths match (no extra URLs)
             expect(match.matches.length).toBe(expectedUrls.length);
         }
      });
    });
  });
});
