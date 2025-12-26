// scan.test.ts
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// ----------------------------------------------------------------------
// 1. Define Mocks FIRST (before importing the modules)
// ----------------------------------------------------------------------
// We use unstable_mockModule because we are in a native ESM environment.
// The path must match exactly what is used in your source files.

jest.unstable_mockModule('../src/gvis.js', () => ({
  checkGoogleVision: jest.fn(),
}));

jest.unstable_mockModule('../src/utils.js', () => ({
  getOpFromUrl: jest.fn(),
  // If you had other exports in utils.js you needed, you'd add them here
  // or use the actual implementation if needed, but for now strict mocking is safer.
}));

// ----------------------------------------------------------------------
// 2. Dynamic Imports (Must happen AFTER mocks are defined)
// ----------------------------------------------------------------------
// We use 'await import' so the loader sees the mocks we just created.

const { checkGoogleVision } = await import('../src/gvis.js');
const { getOpFromUrl } = await import('../src/utils.js');
const { reverseImageSearch, findMatchingUsernames } = await import('../src/scan.js');
const { Match } = await import('../src/Match.js');

// ----------------------------------------------------------------------
// 3. Type Casting
// ----------------------------------------------------------------------
// We cast the imported functions to Jest Mock types so TypeScript
// knows we can use .mockResolvedValue().

const mockedCheckGoogleVision = checkGoogleVision as jest.MockedFunction<typeof checkGoogleVision>;
const mockedGetOpFromUrl = getOpFromUrl as jest.MockedFunction<typeof getOpFromUrl>;

// ----------------------------------------------------------------------
// 4. Test Suite
// ----------------------------------------------------------------------

describe('Scan Logic', () => {
  const mockContext = {
    reddit: {} // We don't need real methods here because we mock utils.getOpFromUrl
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reverseImageSearch creates Matches from Google Vision data', async () => {
    const mockGvisResponse = {
      pagesWithMatchingImages: [
        {
            url: 'http://match.com',
            fullMatchingImages: [{ url: 'img' }]
        }
      ]
    };

    mockedCheckGoogleVision.mockResolvedValue(mockGvisResponse);

    const results = await reverseImageSearch('fake-key', ['http://source.jpg']);

    expect(results).toHaveLength(1);
    expect(results[0]).toBeInstanceOf(Match);
    expect(results[0].matches).toContain('http://match.com');
  });

  test('findMatchingUsernames removes matches that belong to the OP', async () => {
    const mockMatch = new Match([
      {
        url: 'https://reddit.com/r/test/comments/123/old_post/',
        fullMatchingImages: [{ url: '...' }]
      }
    ]);

    mockedGetOpFromUrl.mockResolvedValue('OriginalUser');

    const removedCount = await findMatchingUsernames(
      mockContext,
      'OriginalUser',
      [mockMatch]
    );

    expect(removedCount).toBe(1);
    expect(mockMatch.matches.length).toBe(0);
    expect(mockedGetOpFromUrl).toHaveBeenCalled();
  });

  test('findMatchingUsernames keeps matches that belong to OTHER users', async () => {
    const mockMatch = new Match([
      {
        url: 'https://reddit.com/r/test/comments/123/stolen_post/',
        fullMatchingImages: [{ url: '...' }]
      }
    ]);

    mockedGetOpFromUrl.mockResolvedValue('Stranger');

    const removedCount = await findMatchingUsernames(
      mockContext,
      'Thief',
      [mockMatch]
    );

    expect(removedCount).toBe(0);
    expect(mockMatch.matches.length).toBe(1);
  });
});