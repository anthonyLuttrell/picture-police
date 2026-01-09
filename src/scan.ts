import {checkGoogleVision} from "./gvis.js";
import {getOpFromUrl} from "./utils.js";
import {Match} from "./Match.js";

export async function reverseImageSearch(
    key: string,
    sourceUrls: string[]): Promise<Match[]|[]>
{
    const promises = sourceUrls.map(async (url, index) =>
    {   // FIXME the In-N-Out burger used to return an exact match, but it is
        //  no longer returning any matches for some reason.
        const result = await checkGoogleVision(url, key);
        if (!result) return null;
        return new Match(result.pagesWithMatchingImages, index);
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
 * @return {Promise<number>} - The number of reddit OP matches found.
 */
export async function findMatchingUsernames(
    context: any,
    authorName: string,
    sourceMatches: Match[]|[]): Promise<number>
{
    let totalRemoved = 0;

    for (const match of sourceMatches)
    {
        const urlsToRemove: string[] = [];

        for (const url of match.matches)
        {
            if ((url.includes("reddit.com") || url.includes("redd.it")) &&
                url.includes("/comments/"))
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
            }
        }
        match.removeMatches(urlsToRemove);
    }
    return totalRemoved;
}