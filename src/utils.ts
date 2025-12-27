import {RedditAPIClient} from "@devvit/public-api";
import {Match} from "./Match.js";

const REDDIT_RATE_LIMIT_DELAY_MS = 650; // 100 queries per minute + 50ms buffer

/**
 * Extracts the original poster's username from a Reddit post URL.
 *
 * @param {string} url - The URL of the Reddit post.
 * @param {RedditAPIClient} reddit - An instance of the Reddit API client to
 * fetch post data.
 * @return {Promise<string | undefined>} A promise that resolves to the username
 * of the post's author, or `undefined` if the extraction or retrieval fails.
 */
export async function getOpFromUrl(
    url: string,
    reddit: RedditAPIClient): Promise<string | undefined>
{
    const match = url.match(/\/comments\/([a-z0-9]+)/i);
    if (!match)
    {
        return undefined;
    }

    const postId = `t3_${match[1]}`;
    try
    {
        await delay(REDDIT_RATE_LIMIT_DELAY_MS);
        const post = await reddit.getPostById(postId);
        return post.authorName;
    }
    catch (e)
    {
        return undefined;
    }
}

/**
 * Extracts the image URL from the given post if it matches specific image file
 * extensions.
 *
 * @param {any} post - The object representing the post, expected to have a
 * `url` property.
 * @return {string[]|[]} An array containing the image URL if it has a valid
 * extension (jpeg, jpg, png), or an empty array otherwise.
 */
export function getImgUrl(post: any): string[] | []
{
    return post.url.match(/\.(jpeg|jpg|png)$/i) ? [post.url] : [];
}

/**
 * Extracts and returns an array of valid image URLs from the gallery images
 * of a provided post object. Filters URLs to include only those ending with
 * .jpeg, .jpg, or .png extensions.
 *
 * @param {object} post - The post object containing a `galleryImages` property
 * with an array of image URLs.
 * @return {string[] | []} An array of valid image URLs or an empty array if
 * none are found.
 */
export function getGalleryUrls(post: any): string[] | []
{
    const urlList = post.galleryImages.filter(
        (url: string) => url.match(/\.(jpeg|jpg|png)$/i)
    );

    for (const [idx, url] of urlList.entries())
    {
        console.debug(`posted gallery image [${idx + 1}/${urlList.length}]: ${url}`);
    }

    return urlList.length > 0 ? urlList : [];
}

/**
 * Analyzes the provided post using its score and matches against external
 * sources to detect potential stolen content. If stolen content is detected, a
 * message is submitted as a comment on the post with relevant details.
 *
 * @param numUserImages
 * @param sourceMatches
 * @param context
 * @param {string} postId - The unique identifier of the respective Reddit post.
 *
 * @return {Promise<void>} Returns a promise that resolves once the comment is
 * submitted, or no action is taken if no stolen content is detected.
 */
export async function comment(
    numUserImages: number,
    sourceMatches: Match[]|[],
    context: any,
    postId: string): Promise<void>
{
    let maxScore: number = 0;
    let totalMatchCount: number = 0;
    const ocImageIdx: number[] = [];
    const urlsToPrint = new Map<number, string>();

    for (const match of sourceMatches)
    {
        if (match.score === 0 || match.numMatches === 0)
        {
            ocImageIdx.push(match.galleryIdx);
        }

        if (match.score > maxScore)
        {
            maxScore = match.score;
        }

        totalMatchCount += match.numMatches;
    }

    if (totalMatchCount <= 0)
    {
        console.log("No matches found. Likely original content.");
        return;
    }

    console.log("Potential Stolen Content Detected!");

    for (const match of sourceMatches)
    {
        for (const url of match.matches)
        {
            if (url.includes("reddit.com") || url.includes("redd.it"))
            {   // try to find and use the first reddit URL
                urlsToPrint.set(match.galleryIdx, url);
            }
        }

        if (!urlsToPrint.has(match.galleryIdx))
        {   // if there were no reddit URLs, just use the first match
            urlsToPrint.set(match.galleryIdx, match.matches[0]);
        }
    }

    // Option A: Report to Mods
    // FIXME not working
    // await context.reddit.report(post.id, {
    //     reason: `Potential Stolen Content (${score}% match confidence)`
    // });

    // build a string for pretty-printing the reddit comment
    // TODO if any of the images are OC, then say "Image [n/n]: Likely original content"
    let str = "";
    urlsToPrint.forEach((url, idx) =>
    {
        if (!url)
        {
            return;
        }

        if (numUserImages > 1)
        {
            str += `Image [${idx}/${numUserImages}]: `;
        }

        if (url.includes("redd.it") || url.includes("reddit.com"))
        {
            str += `${url}\n\n`;
        }
        else
        {   // "hide" external links by using the Markdown spoiler tag
            str += `>!${url}!<\n\n`;
        }
    });

    let ocStr = ""

    if (ocImageIdx.length > 0)
    {
        ocStr = `The following images are likely original content: (${ocImageIdx.join(", ")}).`;
    }

    const commentStrSingular = `🚨 **Picture Police** 🚨\n\n` +
        `I am **${maxScore}%** confident that this is a **stolen** image. ` +
        `I found duplicate images on **${totalMatchCount}** other sites. ` +
        `Here is an example of what I found:\n\n `+
        `${str}` +
        `${ocStr}\n\n---\n\n` +
        `Note: Click on links at your own risk. This bot does not guarantee ` +
        `the security of any external websites you visit.\n\n` +
        `[Click here to submit feedback]` +
        `(https://www.reddit.com/message/compose/?to=picture-police&subject=Picture%20Police%20Feedback&message=Please%20describe%20the%20issue%20or%20feedback%20here:)`;

    const commentStrPlural = `🚨 **Picture Police** 🚨\n\n` +
        `I am **${maxScore}%** confident that this post contains **stolen** ` +
        `images. I found duplicate images on **${totalMatchCount}** other ` +
        `sites. Here is an example of each image found on another site:\n\n `+
        `${str}` +
        `${ocStr}\n\n---\n\n` +
        `Note: Click on links at your own risk. This bot does not guarantee ` +
        `the security of any external websites you visit.\n\n` +
        `[Click here to submit feedback]` +
        `(https://www.reddit.com/message/compose/?to=picture-police&subject=Picture%Police%20Feedback&message=Please%20describe%20the%20issue%20or%20feedback%20here:)`;

    const commentStr = numUserImages === 1 ?
        commentStrSingular : commentStrPlural;

    await context.reddit.submitComment({
        id: postId,
        text: commentStr
    });

    // TODO add an option to print a string on 100% confidence of original content (no matches)
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));