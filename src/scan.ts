import {checkGoogleVision} from "./gvis.js";
import {getOpFromUrl} from "./utils.js";
import {Match} from "./Match.js";

/**
 * Performs a reverse image search using the provided Google Vision API key
 * and context, iterating over the given list of image URLs.
 *
 * @param {string} key - The API key to authenticate with the Google Vision API.
 * @param {string[]} sourceUrls - The list of image URLs to process in the reverse
 * search.
 * @return {Promise<Match[]|[]>} - A promise that resolves to an array of `Match`
 */
export async function reverseImageSearch(
    key: string,
    sourceUrls: string[]): Promise<Match[]|[]>
{
    // const sourceMatches: Match[] = [];
    //
    // for (const sourceUrl of sourceUrls)
    // {
    //     console.debug(`Working image: ${sourceUrl}`);
    //     const result = await checkGoogleVision(sourceUrl, key);
    //
    //     if (!result)
    //     {
    //         console.log("Bad result from Google Vision API.");
    //         continue;
    //     }
    //
    //     // create a new Match object for every picture in a post
    //     // `pagesWithMatchingImages` may be undefined here, but that is okay
    //     console.debug(`pagesWithMatchingImages exists: ${result.pagesWithMatchingImages !== undefined}`);
    //     console.debug(`fullMatchingImages exists: ${result.fullMatchingImages !== undefined}`);
    //     console.debug(`partialMatchingImages exists: ${result.partialMatchingImages !== undefined}`);
    //     console.debug(`visuallySimilarImages exists: ${result.visuallySimilarImages !== undefined}`);
    //     sourceMatches.push(
    //         new Match(result.pagesWithMatchingImages, sourceMatches.length)
    //     );
    // }
    // return sourceMatches;

    const promises = sourceUrls.map(async (url, index) =>
    {
        const result = await checkGoogleVision(url, key);
        if (!result) return null;
        return new Match(result.pagesWithMatchingImages, index);
    });

    const results = await Promise.all(promises);
    // Filter out nulls
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
                console.debug(`Checking for reddit OP in url: ${url}`);
                const foundAuthor = await getOpFromUrl(url, context.reddit);

                if (!foundAuthor)
                {
                    console.debug(
                        `Unable to find a username from the provided url:\n  ${url}`
                    );
                    continue;
                }

                if (authorName === foundAuthor)
                {
                    console.log(`Matched OP: u/${foundAuthor}`);
                    console.debug(`Removing url: ${url}`);
                    urlsToRemove.push(url);
                }
            }
        }
        match.removeMatches(urlsToRemove);
    }
    return totalRemoved;
}