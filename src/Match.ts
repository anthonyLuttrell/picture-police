import {
    log,
    isDirectRedditImgUrl,
    isRedditAsset,
    isRedditPermalink
} from "./utils.js";

/**
 * Each Match object represents each "match" from the Web Detection result.
 */
export class Match
{
    private readonly matchingImagesObj: any;
    private readonly authorName: string;
    private fbLinks = new Set<string>();
    private matchList: string[] = [];
    private numCleanedMatches: number = 0;
    private onlyPartialMatch: boolean = false;
    private onlyDirectImgUrl: boolean = false;
    public readonly galleryIdx: number;
    public readonly numOriginalMatches: number = 0;
    public isDeleted: boolean = false;

    constructor(matchingImagesObj: any, index: number, authorName: string)
    {
        this.galleryIdx = index + 1; // 1-based to align with gallery images
        this.matchingImagesObj = matchingImagesObj === undefined ? [] : matchingImagesObj;
        this.authorName = authorName;
        this.setMatchList();
        this.numOriginalMatches = this.matchList.length;
    }

    /**
     * WEB DETECTION MATCH TYPES:
     *
     * 1. `fullMatchingImages`
     *    - Type: Array of strings (URLs) or undefined.
     *    - Definition: Visually identical to the query image.
     *    - Examples: Resized, compressed, or file format changes (PNG/JPG).
     *
     * 2. `partialMatchingImages`
     *    - Type: Array of strings (URLs) or undefined.
     *    - Definition: Shares key-point features but is not identical. The
     *                  pixels of the image have changed, but the image itself
     *                  is likely the same.
     *    - Examples: Cropped versions, color changes, or the image used as a
     *                component in a larger graphic.
     *
     * `pagesWithMatchingImages`, if not undefined, will contain an array of
     * objects, each with the properties `url`, `pageTitle`, and either
     * `fullMatchingImages` or `partialMatchingImages`. `url` is a string to the
     * webpage containing the matching image(s). This is the string we want to
     * capture, but only if the array `fullMatchingImages` contains at least one
     * entry.
     */
    setMatchList(): void
    {
        // Some partial matches can be totally different images, so we want to
        // ignore partial matches when full matches exist. We will keep a list
        // of partial matches to add later if we don't find any full matches.
        const tempPartialMatches: string[] = [];
        const matchingPages = this.matchingImagesObj;

        for (const match of matchingPages)
        {
            if (this.isAuthorInUrl(match.url)) continue;
            const processedUrl = this.getNormalizedUrl(match);
            if (!processedUrl) continue;
            if (this.isScraperSite(match)) continue;
            this.categorizeMatch(match, processedUrl, tempPartialMatches);
        }

        this.finalizeMatches(tempPartialMatches);
    }

    /**
     * Checks if the author's name is present in the URL. Try to remove hyphens
     * and underscores when checking as well.
     */
    private isAuthorInUrl(url: string): boolean
    {
        const lowerUrl = url.toLowerCase();

        // Reddit only allows underscore and hyphen in usernames
        const cleanedAuthName = this.authorName.replace(
            /[-_]/g, ""
        ).toLowerCase();

        const hyphenAuthName = this.authorName.replace(/_/g, "-").toLowerCase();

        return lowerUrl.includes(this.authorName) ||
               lowerUrl.includes(cleanedAuthName) ||
               lowerUrl.includes(hyphenAuthName);
    }

    /**
     * If the fullMatchingImages contains a "lookaside" Facebook link, we will
     * use that first. However, these are temporary image caches used for
     * serving images through a CDN, but we can build a permanent link from the
     * media ID if we find one.
     *
     * Facebook group posts rarely link to the correct post, so instead of
     * saving the URL of an incorrect post, we will just save the URL to the
     * actual group. This will also (correctly) lower the confidence score if
     * other Reddit posts are found with the same OP. We always assume a FB
     * group post URL will be structured exactly like this:
     * https://www.facebook.com/groups/<group_name>/posts/<post_id>/
     */
    private getNormalizedUrl(page: any): string | null
    {
        const urlObj = new URL(page.url);
        const isFbGroup = urlObj.hostname.endsWith("facebook.com") &&
                          urlObj.pathname.includes("groups");

        if (!isFbGroup) return page.url

        const mediaId = this.findFacebookMediaId(page.fullMatchingImages);

        if (mediaId)
        {
            const fbPermalink = `https://www.facebook.com/photo.php?fbid=${mediaId}`;
            if (this.fbLinks.has(fbPermalink)) return null;
            this.fbLinks.add(fbPermalink);
            return fbPermalink;
        }

        const pathSegments = urlObj.pathname.split('/');
        const groupName = pathSegments[2];
        if (this.fbLinks.has(groupName)) return null;
        this.fbLinks.add(groupName);
        urlObj.pathname = pathSegments.slice(0, 3).join('/');
        return urlObj.href;
    }

    private findFacebookMediaId(fullMatchingImages: any[]): string | null
    {
        if (!fullMatchingImages) return null;

        for (const match of fullMatchingImages)
        {
            try
            {
                const tempUrl = new URL(match.url);
                if (tempUrl.hostname.includes("lookaside.fbsbx.com") &&
                    tempUrl.searchParams.has("media_id"))
                {
                    return tempUrl.searchParams.get("media_id");
                }
            }
            catch (e) {}
        }
        return null;
    }

    /**
     * There are some "AI" web-scraping websites that steal Reddit images to use
     * on their site. We want to skip these to avoid false positives. Here is
     * one example site I came across during testing: https://ge.life/mmm-yum
     *
     * @param {any} page - The page object to evaluate. It must contain a URL
     *                     and may include a `fullMatchingImages` property with
     *                     image data.
     * @return {boolean} Returns true if the page is identified as a scraper
     *                   site; otherwise, returns false.
     */
    private isScraperSite(page: any): boolean
    {
        const hasFullMatch = page.fullMatchingImages !== undefined;
        if (!hasFullMatch) return false;

        const urlObj = new URL(page.url);
        const isReddit = urlObj.hostname.endsWith("reddit.com") ||
                         urlObj.hostname.endsWith("redd.it");

        if (isReddit) return false;

        return page.fullMatchingImages.some((match: { url: string }) =>
            isDirectRedditImgUrl(match.url)
        );
    }

    // First Priority: A full match to a clean Reddit permalink
    // Second Priority: A full match to an external link.
    // Third Priority: A full match to a direct Reddit image link.
    // Fourth Priority: A partial match to a clean Reddit permalink.
    // Fifth Priority: A partial match to an external link.
    // Final Priority: A partial match to a direct Reddit image link.
    private categorizeMatch(
        page: any,
        urlToAdd: string,
        tempPartialMatches: string[]): void
    {
        const hasFullMatch = page.fullMatchingImages !== undefined;
        const hasPartialMatch = page.partialMatchingImages !== undefined;

        const urlObj = new URL(urlToAdd);
        const isReddit = urlObj.hostname.endsWith("reddit.com");
        const isComments = urlObj.pathname.includes("comments");
        const isSubreddit = urlObj.pathname.includes("r/") && !isComments;

        const isRedditThread = isReddit && isComments && urlObj.search === "";
        const isExternal = !isReddit &&
                           !urlObj.hostname.includes("redd.it") &&
                           urlObj.protocol === "https:";

        // Priority 1 & 2: Full Match -> Reddit Thread OR External Link
        if (hasFullMatch && (isRedditThread || isExternal))
        {
            this.matchList.push(urlToAdd);
            return;
        }

        // Priority 3: Full Match -> Subreddit Link (Check direct images)
        if (hasFullMatch && isSubreddit)
        {   // we cannot verify the OP username on a direct
                            // image link, so we will consider it a partial
                            // match to ensure the confidence score is low
             this.collectDirectLinks(
                 page.fullMatchingImages, tempPartialMatches
             );
             return;
        }

        // Priority 4 & 5: Partial Match -> Reddit Thread OR External Link
        if (hasPartialMatch && (isRedditThread || isExternal)) {
            if (this.isValidPartialMatch(page.partialMatchingImages))
            {
                tempPartialMatches.push(urlToAdd);
            }
            return;
        }

        // Priority 6: Partial Match -> Subreddit Link
        if (hasPartialMatch && isSubreddit)
        {
            this.collectDirectLinks(
                page.partialMatchingImages, tempPartialMatches
            );
        }
    }

    /**
     * Helper to collect direct reddit image links from a match array
     */
    private collectDirectLinks(matches: any[], targetArray: string[]): void
    {
        if (!matches) return;
        for (const match of matches)
        {
            if (isDirectRedditImgUrl(match.url))
            {
                targetArray.push(match.url);
            }
        }
    }

    /**
     * Ignore thumbnail-only matches and direct-link-only matches to avoid
     * "sidebar noise." Google Vision occasionally attributes sidebar/widget
     * thumbnails to the page URL, causing false positives.
     */
    private isValidPartialMatch(partialImages: any[]): boolean
    {
        if (!partialImages) return false;

        const onlyThumbnails = partialImages.every(
            (m: { url: string }) => isRedditAsset(m.url)
        );

        const onlyDirectLinks = partialImages.every(
            (m: { url: string }) => isDirectRedditImgUrl(m.url)
        );

        return !onlyThumbnails && !onlyDirectLinks;
    }

    /**
     * If no full matches were found, promote valid partial matches.
     */
    private finalizeMatches(tempPartialMatches: string[]): void
    {
        if (this.matchList.length === 0 && tempPartialMatches.length > 0)
        {
            this.matchList = tempPartialMatches;
            this.onlyPartialMatch = true;
            log("WARN", "Only partial matches found", "N/A");

            const hasDirectImg = this.matchList.some(
                url => isDirectRedditImgUrl(url)
            );

            const hasPermalink = this.matchList.some(
                url => isRedditPermalink(url)
            );

            if (hasDirectImg && !hasPermalink)
            {
                this.onlyDirectImgUrl = true;
            }
        }
    }

    get numMatches()
    {
        return this.numCleanedMatches;
    }

    get matches()
    {
        return this.matchList;
    }

    /**
     * We remove matches if the author of this post is the same author of
     * a matched Reddit post, meaning they are the same OP on two different
     * posts. Currently, we do not attempt to find the author of any non-Reddit
     * websites.
     */
    public removeMatches(urlsToRemove: string[])
    {
        this.matchList = this.matchList.filter(
            url => !urlsToRemove.includes(url)
        );
        this.numCleanedMatches = this.matchList.length;
    }

    get score()
    {
        const matchDiff = this.numOriginalMatches - this.numCleanedMatches;

        let score = Math.round(
            ((1 - (matchDiff / this.numOriginalMatches)) * 100)
        );

        // these are intentionally compounding
        if (this.onlyPartialMatch)
        {   // if we only found partial matches, we are less confident, so
            // reduce the score by half
            score /= 2;
        }

        if (this.onlyDirectImgUrl)
        {   // if we only found direct image links, we are less confident, so
            // reduce the score by slightly more than half
            score /= 2.1;
        }

        if (this.isDeleted)
        {   // we found a reddit post with a matching image, but the original
            // poster deleted their post so we can't verify the username
            score /= 2;
        }

        return Math.round(score);
    }
}
