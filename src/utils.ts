import {RedditAPIClient} from "@devvit/public-api";
import {Match} from "./Match.js";

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
    const urlsToPrint = new Map<number, string>();
    let totalScore: number = 0;
    let totalMatchCount: number = 0;

    for (const match of sourceMatches)
    {
        totalScore += match.score;
        totalMatchCount += match.numMatches;
    }

    console.debug(`Total score in "comment": ${totalScore}`);
    console.debug(`Total matches in "comment": ${totalMatchCount}`);

    if (totalMatchCount <= 0)
    {
        console.log("No matches found. Likely original content.");
        return;
    }

    // FIXME if the post has two images, and only one of them is stolen, then
    // the confidence score should be 100% for just that one image instead of
    // 50% overall.
    console.log("Potential Stolen Content Detected!");
    const avgScore = Math.round(totalScore / numUserImages);
    console.debug(`Average score in "comment": ${avgScore}`);
    const sourceDiff = numUserImages - sourceMatches.length;
    console.debug(`Number of missing sources: ${sourceDiff}`);

    for (const match of sourceMatches)
    {
        // there may be 3 submitted images, but only 1 of them matched a stolen
        // image, so we create an offset to align the URL with the correct
        // gallery image.
        const adjustedGalleryIdx = match.galleryIdx + sourceDiff;
        for (const url of match.matches)
        {
            if (url.includes("reddit.com") || url.includes("redd.it"))
            {   // try to find and use the first reddit URL
                urlsToPrint.set(adjustedGalleryIdx, url);
            }
        }

        if (!urlsToPrint.has(adjustedGalleryIdx))
        {   // if there were no reddit URLs, just use the first match
            urlsToPrint.set(adjustedGalleryIdx, match.matches[0]);
        }
    }

    // Option A: Report to Mods
    // FIXME not working
    // await context.reddit.report(post.id, {
    //     reason: `Potential Stolen Content (${score}% match confidence)`
    // });

    // build a string for pretty-printing the reddit comment
    let str = "";
    urlsToPrint.forEach((url, idx) =>
    {
        if (!url) return;
        str += `Image [${idx}/${numUserImages}]: ${url}\n\n`;
    });
    // str = str.slice(0, -2); // remove the last two newlines

    const commentStrSingular = `🚨 **Picture Police** 🚨\n\n` +
        `I am **${avgScore}%** confident that this is a **stolen** image. ` +
        `I found duplicate images on **${totalMatchCount}** other sites. ` +
        `Here is an example image found on one other site:\n\n `+
        `${str}`;

    const commentStrPlural = `🚨 **Picture Police** 🚨\n\n` +
        `I am **${avgScore}%** confident that this post contains **stolen** ` +
        `images. I found duplicate images on **${totalMatchCount}** other ` +
        `sites. Here is an example of each image found on another site:\n\n `+
        `${str}`;

    const commentStr = numUserImages === 1 ?
        commentStrSingular : commentStrPlural;

    await context.reddit.submitComment({
        id: postId,
        text: commentStr
    });

    // TODO add an option to print a string on 100% confidence of original content (no matches)
}