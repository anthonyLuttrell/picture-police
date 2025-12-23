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
    const sourceMatches: Match[] = [];

    for (const sourceUrl of sourceUrls)
    {
        console.debug(`Working image: ${sourceUrl}`);
        const result = await checkGoogleVision(sourceUrl, key);

        if (!result)
        {
            console.log("Bad result from Google Vision API.");
            continue;
        }

        // `pagesWithMatchingImages`, if not undefined, will contain an array of
        // objects, each with the properties `url`, `pageTitle`, and either
        // `fullMatchingImages` or `partialMatchingImages`. `url` is a string to
        // the webpage containing the matching image(s). This is the string we
        // want to capture, but only if the array `fullMatchingImages` contains
        // at least one entry.
        const matchingPages = result.pagesWithMatchingImages;

        if (matchingPages && matchingPages.length > 0)
        {
            console.debug(`Creating new Match instance with ${matchingPages.length} matching pages.`);
            sourceMatches.push(new Match(matchingPages));
        }
        else
        {
            console.log("No pages with matching images found.");
        }
    }
    return sourceMatches;
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
    const urlsToRemove: string[] = [];
    console.debug(`sourceMatches contains [${sourceMatches.length}] matches in "findMatchingUsernames".`);

    for (const match of sourceMatches)
    {
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
                    return Promise.reject(
                        `Unable to find a username from the provided url:\n  ${url}`
                    );
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
        // do we need to clear urlsToRemove here?
    }
    return urlsToRemove.length;
}