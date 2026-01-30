import {
    isDirectRedditImgUrl,
    isRedditAsset,
    isRedditPermalink,
    log,
    stripQueryString
} from "./utils.js";
import {calculateConfidence} from "./usernameUtils.js";

interface UrlObj { url: string; }
interface Page
{
    url: string;
    pageTitle: string;
    fullMatchingImages?: UrlObj[];
    partialMatchingImages?: UrlObj[];
}

type PageArr = Array<Page>;
type MatchArr = Array<UrlObj>;

/**
 * Each Match object represents each "match" from the Web Detection result.
 */
export class Match
{
    private readonly matchingImagesObj: PageArr;
    private readonly authorName: string;
    private matchList: string[] = [];
    private numCleanedMatches: number = 0;
    private onlyPartialMatch: boolean = false;
    private onlyDirectImgUrl: boolean = false;
    public readonly galleryIdx: number;
    public readonly numOriginalMatches: number = 0;
    public isDeleted: boolean = false;

    constructor(matchingImagesObj: PageArr, index: number, authorName: string)
    {
        this.galleryIdx = index + 1; // 1-based to align with gallery images
        this.matchingImagesObj = matchingImagesObj ?? [] as PageArr;
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
        const fbLinks: string[] = [];

        for (const page of matchingPages)
        {
            const url = page.url.toLowerCase();
            const fullMatchUrl = page.fullMatchingImages?.[0]?.url ?? "";
            const partMatchUrl = page.partialMatchingImages?.[0]?.url ?? "";

            if (calculateConfidence(this.authorName, url) >= 90 ||
                calculateConfidence(this.authorName, fullMatchUrl) >= 90 ||
                calculateConfidence(this.authorName, partMatchUrl) >= 90)
            {   // Must check fullMatch and partialMatch because they are
                // optional members of the page object, and they can be totally
                // different links than page.url.
                continue;
            }

            const hasFullMatch: boolean = page.fullMatchingImages !== undefined;
            const hasPartialMatch: boolean = page.partialMatchingImages !== undefined;
            let urlToAdd = url;

            try
            {
                const urlObj = new URL(url);
                const path = urlObj.pathname;
                const host = urlObj.hostname;
                const proto = urlObj.protocol;
                const notQuery = urlObj.search === "";

                const isRedditPermalink = host.endsWith("reddit.com") &&
                                          path.includes("comments") &&
                                          notQuery;

                const isSubredditLink = host.endsWith("reddit.com") &&
                                        path.includes("r") &&
                                        !path.includes("comments");

                const isRedditGallery = host.endsWith("redditery.com") &&
                                        path.includes("user");

                const isExternal = !host.endsWith("reddit.com") &&
                                   !host.includes("redd.it") &&
                                   !host.includes("redditery.com") &&
                                   proto.includes("https");

                const isFacebook = host.endsWith("facebook.com");

                if (isFacebook)
                {   // Facebook uses temporary image caches for serving images
                    // through a CDN. The hostname is "lookaside.fbsbx.com".
                    // Supposedly (per Gemini), these are temporary links that
                    // may fail to resolve to the actual post at some point.
                    // However, I don't see that being a problem, as long as
                    // Google Vision is correctly identifying a match on the
                    // same link. So we will try to use the "lookaside" links
                    // as-is for now, and if they fail to resolve to the actual
                    // FB post in the future, then we will need to convert them
                    // to FB permalinks.

                    const fullMatch = this.getLookasideLink(
                        page?.fullMatchingImages ?? []
                    );

                    const partMatch = this.getLookasideLink(
                        page?.partialMatchingImages ?? []
                    )

                    if (fullMatch && !fbLinks.includes(fullMatch))
                    {
                        this.matchList.push(fullMatch);
                        fbLinks.push(fullMatch);
                    }
                    else if (partMatch && !fbLinks.includes(partMatch))
                    {
                        tempPartialMatches.push(partMatch);
                        fbLinks.push(partMatch);
                    }

                    continue; // skip the rest of the loop
                }

                const hasDirectRedditImgUrl = page.fullMatchingImages?.some(
                        match => isDirectRedditImgUrl(match.url)
                    ) ?? false;

                // When a match is found on an external website, we want to use
                // the direct-image URL instead of the URL to the actual site.
                // This is because some sites frequently "steal" images that are
                // hosted outside their domain. For example, aparel.net (SIC) is
                // using images hosted on nyt.com (nytimes.com) servers. In
                // these cases, we do not want to provide a link to a "sketchy"
                // website, and the stolen image in question is not always
                // easily found on the sketchy website anyway.

                let directImgLinkFullMatch: string | undefined;
                let directImgLinkPartMatch: string | undefined;

                if (hasFullMatch && isExternal)
                {
                    directImgLinkFullMatch = stripQueryString(
                        page.fullMatchingImages?.[0].url
                    );
                }

                if (hasPartialMatch && isExternal)
                {
                    directImgLinkPartMatch = stripQueryString(
                        page.partialMatchingImages?.[0].url
                    );
                }

                if (hasFullMatch && isExternal && hasDirectRedditImgUrl)
                {   // There are some "AI" websites that steal Reddit images to
                    // use on their site. We want to skip these to avoid false
                    // positives. Here is one example site I came across during
                    // testing: https://ge.life/mmm-yum
                    continue;
                }

                // First Priority: A full match to a clean Reddit permalink
                // Second Priority: A full match to an external link.
                // Third Priority: A full match to a direct Reddit image link.
                // Fourth Priority: A partial match to a clean Reddit permalink.
                // Fifth Priority: A partial match to an external link.
                // Final Priority: A partial match to a direct Reddit image link.
                if (hasFullMatch && isRedditPermalink)
                {   // 1st priority
                    this.matchList.push(urlToAdd);
                }
                else if (hasFullMatch && isExternal)
                {   // 2nd priority
                    if (directImgLinkFullMatch &&
                        !this.matchList.includes(directImgLinkFullMatch))
                    {
                        this.matchList.push(directImgLinkFullMatch);
                    }
                }
                else if (hasFullMatch && (isSubredditLink || isRedditGallery))
                {   // 3rd priority
                    for (const fullMatch of page?.fullMatchingImages ?? [])
                    {
                        if (isDirectRedditImgUrl(fullMatch.url))
                        {   // we cannot verify the OP username on a direct
                            // image link, so we will consider it a partial
                            // match to ensure the confidence score is low
                            tempPartialMatches.push(fullMatch.url);
                        }
                    }
                }
                else if (hasPartialMatch && isRedditPermalink)
                {   // 4th priority
                    const onlyThumbnails = page.partialMatchingImages?.every(
                        match => isRedditAsset(match.url)
                    ) ?? false;

                    const onlyDirectLinks = page.partialMatchingImages?.every(
                        match => isDirectRedditImgUrl(match.url)
                    ) ?? false;

                    if (!onlyThumbnails && !onlyDirectLinks)
                    {   // Ignore thumbnail-only matches and direct-link-only
                        // matches to avoid "sidebar noise." Google Vision
                        // occasionally attributes sidebar/widget thumbnails to
                        // the page URL, causing false positives.
                        tempPartialMatches.push(urlToAdd);
                    }
                }
                else if (hasPartialMatch && isExternal)
                {   // 5th priority
                    if (directImgLinkPartMatch &&
                        !tempPartialMatches.includes(directImgLinkPartMatch))
                    {
                        tempPartialMatches.push(directImgLinkPartMatch);
                    }
                }
                else if (hasPartialMatch && isSubredditLink)
                {   // final priority
                    for (const partMatch of page?.partialMatchingImages ?? [])
                    {
                        if (isDirectRedditImgUrl(partMatch.url))
                        {
                            tempPartialMatches.push(partMatch.url);
                        }
                    }
                }
            }
            catch (e)
            {
                log("ERROR", "Error when creating new Match", url)
                console.error(e);
            }
        }

        if (this.matchList.length === 0 && tempPartialMatches.length > 0)
        {   // There are no full matches, so we will use the partial matches
            this.matchList = tempPartialMatches;
            this.onlyPartialMatch = true;
            log("WARN", "Only partial matches found", "N/A");

            const hasDirectImg: boolean = this.matchList.some(
                url => isDirectRedditImgUrl(url)
            );

            const hasPermalink: boolean = this.matchList.some(
                url => isRedditPermalink(url)
            )

            if (hasDirectImg && !hasPermalink)
            {   // we want to be less confident when there are only direct image
                // links and no permalinks
                this.onlyDirectImgUrl = true;
            }
        }
    }

    private getLookasideLink(matches: MatchArr): string | null
    {
        for (const match of matches)
        {
            const fbUrlObj = new URL(match.url);
            if (fbUrlObj.hostname.includes("lookaside.fbsbx.com"))
            {
                return match.url;
            }
        }

        return null;
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
     * a matched Reddit post, or if their username appears in the URL of an
     * external website.
     */
    public removeMatches(urlsToRemove: string[])
    {
        this.matchList = this.matchList.filter(
            url => !urlsToRemove.includes(url)
        );
        this.numCleanedMatches = this.matchList.length;
    }

    /**
     * This only represents a confidence score for each image that OP submitted.
     * If OP submits only 1 image, then this score will be used. If OP submits
     * more than 1 image, then the maximum score of all images will be used, as
     * that will indicate the overall confidence that at least one image is
     * stolen.
     */
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
