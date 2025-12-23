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
        this.matchingImagesObj = matchingImagesObj;
        this.setMatchList();
        this.numOriginalMatches = this.matchList.length;
    }

    setMatchList(): void
    {
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

            if (hasFullMatch && (goodRedditUrl || isExternal))
            {
                console.debug(`Adding url: ${page.url}`);
                this.matchList.push(page.url);
            }
            else if (!hasFullMatch && hasPartialMatch)
            {   // TODO do we want to handle partial matches?
                console.log("Only partial matches found.");
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
