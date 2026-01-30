import {checkGoogleVision} from "./gvis.js";
import {getOpFromUrl} from "./utils.js";
import {Match} from "./Match.js";

/**
 * Performs a reverse image search using the provided API key and list of image
 * source URLs.
 *
 * @param {string} key - The API key to authenticate with the reverse image
 * search service.
 * @param {string[]} sourceUrls - An array of URLs for the images to perform the
 * reverse image search on.
 * @param {string} authorName - OP's username
 * @return {Promise<(Match[] | [])>} A promise that resolves to an array of
 * Match objects for images with matching results, or an empty array if no
 * matches are found.
 */
export async function reverseImageSearch(
    key: string,
    sourceUrls: string[],
    authorName: string): Promise<Match[]|[]>
{
    const promises = sourceUrls.map(async (url, index) =>
    {
        const result = await checkGoogleVision(url, key);
        if (!result) return null;
        // console.debug(`\n\nresult.pagesWithMatchingImages:\n\n${JSON.stringify(result.pagesWithMatchingImages, null, 2)}`);
        return new Match(result.pagesWithMatchingImages, index, authorName);
    });

    const results = await Promise.all(promises);
    return results.filter((m): m is Match => m !== null);
}

/**
 * Retrieves the number of matches for a given author among a list of Reddit
 * posts.
 *
 * @param context
 * @param {string} authorName - The Reddit username (author) to match against
 * the posts.
 * @param {Match[]|[]} sourceMatches - The list of `Match` objects to search for
 * matches.
 * @return {Promise<void>}
 */
export async function findMatchingUsernames(
    context: any,
    authorName: string,
    sourceMatches: Match[]|[]): Promise<void>
{
    for (const match of sourceMatches)
    {
        const urlsToRemove: string[] = [];

        for (const url of match.matches)
        {
            const urlObj = new URL(url);
            if (urlObj.hostname.endsWith("reddit.com") &&
                urlObj.pathname.includes("comments"))
            {   // find reddit URLs only
                const foundAuthor = await getOpFromUrl(url, context.reddit);

                if (!foundAuthor)
                {
                    continue;
                }

                if (authorName === foundAuthor)
                {
                    urlsToRemove.push(url);
                }
                else if (authorName !== "[deleted]" &&
                         foundAuthor === "[deleted]")
                {
                    match.isDeleted = true;
                }
            }
        }
        match.removeMatches(urlsToRemove);
    }
}