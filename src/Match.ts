import { log } from "./utils.js";

export class Match
{
    private readonly matchingImagesObj: any;
    private matchList: string[] = [];
    private numCleanedMatches: number = 0;
    private onlyPartialMatch: boolean = false;
    public readonly galleryIdx: number;
    public readonly numOriginalMatches: number = 0;

    constructor(matchingImagesObj: any, index: number)
    {
        this.galleryIdx = index + 1; // 1-based to align with gallery images
        this.matchingImagesObj = matchingImagesObj === undefined ? [] : matchingImagesObj;
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

        for (const page of matchingPages)
        {
            const hasFullMatch = page.fullMatchingImages !== undefined;
            const hasPartialMatch = page.partialMatchingImages !== undefined;

            try
            {
                const urlObj = new URL(page.url);
                const path = urlObj.pathname;
                const host = urlObj.hostname;
                const proto = urlObj.protocol;
                const notQuery = urlObj.search === "";

                const isRedditPermalink = host.endsWith("reddit.com") &&
                                          path.includes("comments") &&
                                          notQuery;

                const isExternal = !host.endsWith("reddit.com") &&
                                   !host.includes("redd.it") &&
                                   proto.includes("https");

                if (hasFullMatch && (isRedditPermalink || isExternal))
                {
                    this.matchList.push(page.url);
                }
                else if (hasPartialMatch && (isRedditPermalink || isExternal))
                {
                    tempPartialMatches.push(page.url);
                }
            }
            catch (e)
            {
                log("ERROR", "Caught error when creating Match object", "N/A")
                console.error(e);
            }
        }

        if (this.matchList.length === 0 && tempPartialMatches.length > 0)
        {   // There are no full matches, so we will use the partial matches
            this.matchList = tempPartialMatches;
            this.onlyPartialMatch = true;
            log("DEBUG", "Only partial matches found!", "N/A");
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
            // reduce the score
            score /= 2;
        }

        return score;
    }
}
