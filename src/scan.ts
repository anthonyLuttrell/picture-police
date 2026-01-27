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

export async function findMatchingSocialLinks(
    context: any,
    authorName: string,
    sourceMatches: Match[]|[]): Promise<void>
{
    const user = await context.reddit.getUserByUsername(authorName);
    const socialLinks = await user.getSocialLinks();
    if (!socialLinks || socialLinks.length === 0) return;
    const socialHandles: string[] = [];

    for (const link of socialLinks)
    {
        if (link.handle !== undefined)
        {   // prefer handle
            socialHandles.push(link.handle);
            console.debug(`Found social handle: ${link.handle}`);
        }
        else if (link.title !== undefined)
        {   // use title if handle is not available
            socialHandles.push(link.title);
            console.debug(`Found social title: ${link.title}`);
        }
        else if (link.outboundUrl !== undefined)
        {   // fallback to pathname and hostname
            const urlObj = new URL(link.outboundUrl);
            if (urlObj.pathname !== "")
            {   // Not supporting multiple paths at this time
                console.debug(`Found social url/path: ${urlObj.hostname.replaceAll("/", "")}`);
                socialHandles.push(urlObj.pathname.replaceAll("/", ""));
            }
            console.debug(`Found social url/host: ${urlObj.hostname}`);
            socialHandles.push(urlObj.hostname);
        }
    }

    for (const match of sourceMatches)
    {
        const urlsToRemove: string[] = [];
        for (const url of match.matches)
        {
            if (socialHandles.some(handle => url.includes(handle)))
            {
                console.debug(`Matching social link found in: ${url}`);
                urlsToRemove.push(url);
            }
            else
            {
                console.debug(`No matching social link found in: ${url}`);
            }
        }
        match.removeMatches(urlsToRemove);
    }
}