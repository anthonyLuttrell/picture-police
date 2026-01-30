import { calculateConfidence } from "./usernameUtils.js";

interface Scraper {
    check(url: string, username: string): Promise<number>;
}

abstract class BaseFetchScraper implements Scraper {
    async check(url: string, username: string): Promise<number> {
        // 1. Check URL confidence
        const urlScore = calculateConfidence(username, url);
        if (urlScore >= 100) return 100; // Early exit on perfect URL match

        // 2. Fetch page and check content confidence
        try {
            const content = await this.fetchPageContent(url);
            if (!content) return urlScore;

            const contentScore = calculateConfidence(username, content);
            return Math.max(urlScore, contentScore);
        } catch (e) {
            console.error(`Failed to fetch ${url}:`, e);
            // Fallback to just URL score on error
            return urlScore;
        }
    }

    protected async fetchPageContent(url: string): Promise<string> {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PicturePoliceBot/1.0; +https://www.reddit.com/r/PicturePolice)'
                }
            });
            if (!response.ok) return "";
            const text = await response.text();

            // Extract title and meta description to avoid parsing huge HTML
            const titleMatch = text.match(/<title>(.*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : "";

            const metaMatch = text.match(/<meta\s+name="description"\s+content="(.*?)"/i);
            const description = metaMatch ? metaMatch[1] : "";

            const ogTitleMatch = text.match(/<meta\s+property="og:title"\s+content="(.*?)"/i);
            const ogTitle = ogTitleMatch ? ogTitleMatch[1] : "";

            return `${title} ${description} ${ogTitle}`;
        } catch (e) {
            console.log(`Fetch error for ${url}:`, e);
            return "";
        }
    }
}

class FacebookScraper extends BaseFetchScraper {}

class InstagramScraper extends BaseFetchScraper {}

class PinterestScraper extends BaseFetchScraper {}

class FallbackScraper implements Scraper {
    async check(url: string, username: string): Promise<number> {
        // Only check URL for fallback domains
        return calculateConfidence(username, url);
    }
}

export async function checkUrl(url: string, username: string): Promise<number> {
    let scraper: Scraper;
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (hostname.endsWith("facebook.com")) {
        scraper = new FacebookScraper();
    } else if (hostname.endsWith("instagram.com")) {
        scraper = new InstagramScraper();
    } else if (hostname.endsWith("pinterest.com")) {
        scraper = new PinterestScraper();
    } else {
        scraper = new FallbackScraper();
    }

    return scraper.check(url, username);
}
