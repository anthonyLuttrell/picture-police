// utils.test.ts
import { getOpFromUrl, getImgUrl, getGalleryUrls } from '../src/utils.js';
import { RedditAPIClient } from '@devvit/public-api';
import { mock } from 'jest-mock-extended';

describe('Utils', () => {
  describe('getOpFromUrl', () => {
    test('extracts author from valid reddit url', async () => {
      // Create a fake Reddit client
      const mockReddit = mock<RedditAPIClient>();

      // Tell the fake client what to return when getPostById is called
      mockReddit.getPostById.mockResolvedValue({
        authorName: 'test_user',
        id: 't3_12345'
      } as any);

      const url = 'https://www.reddit.com/r/funny/comments/12345/title/';
      const author = await getOpFromUrl(url, mockReddit);

      expect(author).toBe('test_user');
      // Verify we requested the correct ID (t3_ + match)
      expect(mockReddit.getPostById).toHaveBeenCalledWith('t3_12345');
    });

    test('returns undefined for invalid urls', async () => {
      const mockReddit = mock<RedditAPIClient>();
      const url = 'https://google.com/some/random/page';

      const author = await getOpFromUrl(url, mockReddit);
      expect(author).toBeUndefined();
    });
  });

  describe('getImgUrl', () => {
    test('returns array for valid image extensions', () => {
      const post = { url: 'http://test.com/image.png' };
      expect(getImgUrl(post)).toEqual(['http://test.com/image.png']);
    });

    test('returns empty array for non-image links', () => {
      const post = { url: 'http://test.com/article.html' };
      expect(getImgUrl(post)).toEqual([]);
    });
  });
});