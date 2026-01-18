import {log} from "./utils.js";

/**
 * Each Match object represents each "match" from the Web Detection result.
 */
export class Match
{
    private readonly matchingImagesObj: any;
    private readonly authorName: string;
    private matchList: string[] = [];
    private numCleanedMatches: number = 0;
    private onlyPartialMatch: boolean = false;
    public readonly galleryIdx: number;
    public readonly numOriginalMatches: number = 0;

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
        const fbGroupNames: string[] = [];

        // Reddit only allows underscore and hyphen in usernames
        let cleanedAuthName = this.authorName.replace(/-/g, "").toLowerCase();
        cleanedAuthName = cleanedAuthName.replace(/_/g, "");

        // Underscores are not recommended in URLs, so we will try with a hyphen
        const hyphenAuthName = this.authorName.replace(/_/g, "-").toLowerCase();

        for (const page of matchingPages)
        {
            const url = page.url.toLowerCase();

            if (url.includes(this.authorName) ||
                url.includes(cleanedAuthName) ||
                url.includes(hyphenAuthName))
            {   // This will handle any site that has OP's name in the URL
                continue;
            }

            const hasFullMatch = page.fullMatchingImages !== undefined;
            const hasPartialMatch = page.partialMatchingImages !== undefined;

            try
            {
                let urlToAdd = url;
                const urlObj = new URL(url);
                const path = urlObj.pathname;
                const host = urlObj.hostname;
                const proto = urlObj.protocol;
                const notQuery = urlObj.search === "";

                const isRedditPermalink = host.endsWith("reddit.com") &&
                                          path.includes("comments") &&
                                          notQuery;

                const isSubredditLink = host.endsWith("reddit.com") &&
                                        path.includes("r");

                const isExternal = !host.endsWith("reddit.com") &&
                                   !host.includes("redd.it") &&
                                   proto.includes("https");

                const isFbGroup = host.endsWith("facebook.com") &&
                                  path.includes("groups");

                if (isFbGroup)
                {   // Facebook group posts rarely link to the correct post, so
                    // instead of saving the URL of an incorrect post, we will
                    // just save the URL to the actual group, making sure to add
                    // only one URL match for each unique FB group. This will
                    // also (correctly) lower the confidence score if other
                    // Reddit posts are found with the same OP. We always assume
                    // a FB group post URL will be structured exactly like this:
                    // https://www.facebook.com/groups/<group_name>/posts/<post_id>/
                    const pathSegments = path.split('/');
                    urlObj.pathname = pathSegments.slice(0, 3).join('/');
                    const fbGroupName = pathSegments[2];
                    if (!fbGroupNames.includes(fbGroupName))
                    {   // keep track of the group names to avoid duplicates
                        fbGroupNames.push(fbGroupName);
                        urlToAdd = urlObj.href;
                    }
                    else
                    {
                        continue;
                    }
                }

                // First Priority: A full match to a clean Reddit permalink
                // Second Priority: A full match to an external link.
                // Third Priority: A full match to a direct Reddit image link.
                // Fourth Priority: A partial match to a clean Reddit permalink.
                // Fifth Priority: A partial match to an external link.
                // Last Priority: A partial match to a direct Reddit image link.
                if (hasFullMatch && (isRedditPermalink || isExternal))
                {
                    this.matchList.push(urlToAdd);
                }
                else if (hasFullMatch && isSubredditLink)
                {
                    for (const fullMatch of page.fullMatchingImages)
                    {
                        const urlObj = new URL(fullMatch.url);
                        if (urlObj.hostname.endsWith("redd.it") &&
                            (urlObj.pathname.includes(".jpg") ||
                            urlObj.pathname.includes(".png") ||
                            urlObj.pathname.includes(".gif") ||
                            urlObj.pathname.includes(".jpeg")))
                        {   // we cannot verify the OP username on a direct
                            // image link, so we will consider it a partial
                            // match to ensure the confidence score is low
                            tempPartialMatches.push(fullMatch.url);
                        }
                    }
                }
                else if (hasPartialMatch && (isRedditPermalink || isExternal))
                {
                    tempPartialMatches.push(urlToAdd);
                }
                else if (hasPartialMatch && isSubredditLink)
                {
                    for (const partialMatch of page.partialMatchingImages)
                    {
                        const urlObj = new URL(partialMatch.url);
                        if (urlObj.hostname.endsWith("redd.it") &&
                            (urlObj.pathname.includes(".jpg") ||
                            urlObj.pathname.includes(".png") ||
                            urlObj.pathname.includes(".gif") ||
                            urlObj.pathname.includes(".jpeg")))
                        {
                            tempPartialMatches.push(partialMatch.url);
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
        }

        for (const match of this.matchList)
        {
            console.debug(`Match URL: ${match}`);
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

        if (this.onlyPartialMatch)
        {   // if we only found partial matches, we are less confident, so
            // reduce the score by half
            score /= 2;
        }

        return score;
    }
}
