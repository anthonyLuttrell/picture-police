// Match.test.ts
import { Match } from '../src/Match.js';

describe('Match Class', () => {
  // Mock data representing a raw Google Vision API response
  const mockVisionData = [
    {
      url: 'https://external-site.com/image.jpg',
      fullMatchingImages: [{ url: '...' }]
    },
    {
      url: 'https://www.reddit.com/r/pics/comments/123/test/',
      fullMatchingImages: [{ url: '...' }]
    },
    {
      url: 'https://www.reddit.com/user/someuser/', // Should be ignored
      partialMatchingImages: [{ url: '...' }]
    },
    {
      url: 'https://www.reddit.com/r/pics/comments/123/test/?tl=fr', // Should be ignored (translation)
      fullMatchingImages: [{ url: '...' }]
    }
  ];

  test('filters out Reddit user profiles and translation links', () => {
    const match = new Match(mockVisionData);

    // Expecting: external-site and the clean reddit comment link
    expect(match.matches).toHaveLength(2);
    expect(match.matches).toContain('https://external-site.com/image.jpg');
    expect(match.matches).toContain('https://www.reddit.com/r/pics/comments/123/test/');
    expect(match.matches).not.toContain('https://www.reddit.com/user/someuser/');
  });

  test('calculates score correctly', () => {
    const match = new Match(mockVisionData);

    // Initial state: 2 valid matches found
    expect(match.score).toBe(100);

    // Simulate removing 1 match (e.g., it was the OP's own post)
    match.removeMatches(['https://www.reddit.com/r/pics/comments/123/test/']);

    // 1 removed out of 2 original = 50% remaining -> 50% likelihood of theft
    expect(match.score).toBe(50);
  });
});