export class Match
{
    private static idx: number = 1; // this aligns with the gallery image
    private readonly matchingImagesObj: any;
    private matchList: string[] = [];
    private numCleanedMatches: number = 0;
    public readonly galleryIdx: number;
    public readonly numOriginalMatches: number = 0;

    constructor(matchingImagesObj: any)
    {
        this.galleryIdx = Match.idx++;
        this.matchingImagesObj = matchingImagesObj === undefined ? [] : matchingImagesObj;
        this.setMatchList();
        this.numOriginalMatches = this.matchList.length;
        console.debug(`Creating new instance at index ${this.galleryIdx}`);
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
        // FIXME there is an issue with the in-n-out picture not being id'd
        // correctly, it seems to be using the partial match first. And the
        // chocolate chip bread should be getting a match, but it is not.
        const matchingPages = this.matchingImagesObj;

        for (const page of matchingPages)
        {
            const hasFullMatch: boolean = page.fullMatchingImages &&
                                          page.fullMatchingImages.length > 0;

            const hasPartialMatch: boolean = page.partialMatchingImages &&
                                             page.partialMatchingImages.length > 0;

            // Reddit will create new URLs with the query string "?tls=" to
            // auto-translate a post to a different language. Don't add these.
            const goodRedditUrl: boolean = (page.url.includes("reddit.com") ||
                                           page.url.includes("redd.it") ||
                                           page.url.includes("/comments/")) &&
                                           !page.url.includes("/user/") &&
                                           !page.url.includes("/?tl=");

            const isExternal: boolean = !page.url.includes("reddit.com") &&
                                        !page.url.includes("redd.it");

            if ((hasFullMatch || hasPartialMatch) &&
                (goodRedditUrl || isExternal))
            {
                console.debug(`Adding url: ${page.url}`);
                this.matchList.push(page.url);
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

    public removeMatches(urlsToRemove: string[])
    {
        console.debug(`Removing ${urlsToRemove.length} matches.`);
        this.matchList = this.matchList.filter(
            url => !urlsToRemove.includes(url)
        );
        this.numCleanedMatches = this.matchList.length;
        console.debug(`Remaining matches: ${this.numCleanedMatches}`);
    }

    /**
     * Calculate the odds that OP is using a stolen image. For example, if we found
     * 5 matching images, but OP has previously posted 4 of them, that would be
     * 1 - (4 / 5) * 100, which is a 20% likelihood of stolen images.
     */
    get score()
    {
        const matchDiff = this.numOriginalMatches - this.numCleanedMatches;
        return Math.round(((1 - (matchDiff / this.numOriginalMatches)) * 100));
    }
}
