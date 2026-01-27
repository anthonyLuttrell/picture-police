import {RedditAPIClient} from "@devvit/public-api";
import {Match} from "./Match.js";

export const GVIS_API_REQ_COUNT_KEY = "stats:gvis_api_requests";
export const POTENTIAL_MATCH_KEY = "stats:daily_potential_matches";
export const PROBABLE_MATCH_KEY = "stats:daily_probable_match";
export const SCAN_KEY = "stats:daily_scans";
export const MIN_CONF = 50; // a score BELOW this number is considered NOT confident

const POST_ID_TOKEN = "[POST_ID_TOKEN]";
const SUB_TOKEN = "[SUB_TOKEN]";
const URL_TOKEN = "[URL_TOKEN]";
const COMMENT_FEEDBACK_LINK = `[Click here to submit feedback](https://www.reddit.com/message/compose?to=r/${SUB_TOKEN}&subject=Picture%20Police%20Feedback&message=Regarding%20post:%20/r/${SUB_TOKEN}/comments/${POST_ID_TOKEN})`;
const MOD_MAIL_FEEDBACK_LINK = `[Click here to submit feedback](https://www.reddit.com/message/compose/?to=96dpi&subject=Picture%20Police%20Feedback&message=Regarding%20post:%20${URL_TOKEN})`;
const DISCLAIMER = `**Note:** Click on external links at your own risk. This `+
    `bot does not guarantee the security of any external websites you visit.`;

// TODO context.reddit.user.getSocialLinks() to compare user name to social links or found websites

/**
 * Extracts the original poster's (OP) username from a given Reddit post URL. We
 * compare the found username to the username on the triggering post.
 *
 * @param {string} url - The Reddit URL containing the post-identifier.
 * @param {RedditAPIClient} reddit - An instance of the Reddit API client for
 * fetching post details.
 * @return {Promise<string | undefined>} A promise that resolves to the username
 * of the original poster (OP), or undefined if the URL is invalid or the user
 * cannot be retrieved.
 */
export async function getOpFromUrl(
    url: string,
    reddit: RedditAPIClient): Promise<string | undefined>
{
    // FIXME this should use the URL Object (new URL)
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
 * Calculates the total number of matches from the provided array of Match
 * objects.
 *
 * @param {Match[]|[]} sourceMatches - An array of match objects, each
 * containing a `numMatches` property indicating the number of matches. Can be
 * an empty array.
 * @return {number} The sum of all `numMatches` values from the provided array.
 */
export function getTotalMatchCount(sourceMatches: Match[]|[],): number
{
    let totalMatchCount: number = 0;

    for (const match of sourceMatches)
    {
        totalMatchCount += match.numMatches;
    }

    return totalMatchCount;
}

/**
 * Finds the maximum score from an array of matches.
 *
 * Note: The max score is used to determine the overall match confidence. For
 * example, if a gallery post has multiple images, but only one of them is a
 * stolen image with a 100% confidence score, then we say "we are 100% confident
 * this post contains a stolen image". Or, if a post has multiple images, one is
 * 20% confident, and the other is 80% confident, then we say "we are 80%
 * confident this post contains a stolen image".
 *
 * @param {Match[]|[]} sourceMatches - An array of Match objects or an empty
 * array. Each Match object is expected to have a `score` property.
 * @return {number} The highest score found in the array. Returns 0 if the array
 * is empty.
 */
export function getMaxScore(sourceMatches: Match[] | [],): number
{
    let maxScore: number = 0;

    for (const match of sourceMatches)
    {
        const thisScore = match.score;
        if (thisScore > maxScore)
        {
            maxScore = thisScore;
        }
    }

    return maxScore;
}

/**
 * Submits a Reddit comment based on the analysis of image matches and user
 * settings.
 *
 * This function analyzes the input data to determine whether a Reddit post's
 * images appear to be original or stolen, constructs a comment string
 * accordingly, and posts it as a comment on Reddit. Depending on the
 * configuration, the comment may also be distinguished or stickied.
 *
 * @param {number} numUserImages - The number of images included in the Reddit
 * post.
 * @param {number} totalMatchCount - The total number of matches found for the
 * images across the web.
 * @param {Match[]|[]} sourceMatches - An array of match objects, each
 * containing data about matching URLs for the images.
 * @param {number} maxScore - The confidence level (in percentage) that the
 * images are original or stolen.
 * @param {any} context - The execution context that includes access to settings
 * and Reddit interaction methods.
 * @param {string} postId - The unique identifier of the Reddit post to which
 * the comment should be submitted.
 * @param {string} authorName - The username of the author of this post.
 * @return {Promise<void>}
 */
export async function comment(
    numUserImages: number,
    totalMatchCount: number,
    sourceMatches: Match[]|[],
    maxScore: number,
    context: any,
    postId: string,
    authorName: string): Promise<void>
{
    const settings = await context.settings.getAll();
    const urlStr = getUrlExampleString(1, sourceMatches, numUserImages);

    if ((totalMatchCount <= 0 && settings["LEAVE_COMMENT"]?.[0] === "matches")||
        settings["LEAVE_COMMENT"]?.[0] === "never")
    {
        return;
    }

    const ocCommentStrSingular = `🚨 **Picture Police** 🚨\n\n` +
        `This image appears to be u/${authorName}'s original content. I could `+
        `not find any matching images anywhere on the web.\n\n`+
        `---\n\n${COMMENT_FEEDBACK_LINK}`;

    const ocCommentStrPlural = `🚨 **Picture Police** 🚨\n\n` +
        `These images appear to be u/${authorName}'s original content. I could `+
        `not find any matching images anywhere on the web.\n\n`+
        `---\n\n${COMMENT_FEEDBACK_LINK}`;

    const possibleOcCommentStrSingular = `🚨 **Picture Police** 🚨\n\n` +
        `I am only **${maxScore}%** confident that this is a **stolen** image. `+
        `I found the same image on **${totalMatchCount}** other site(s), `+
        `but I could not verify if the author is the same. I recommend that OP `+
        `provides proof that they are the author.`;

    const possibleOcCommentStrPlural = `🚨 **Picture Police** 🚨\n\n` +
        `I am only **${maxScore}%** confident that this post contains `+
        `**stolen** images. I found duplicate images on **${totalMatchCount}** `+
        `other site(s), but I could not verify if the author is the same. I `+
        `recommend that OP provides proof that they are the author.`;

    const stolenCommentStrSingular = `🚨 **Picture Police** 🚨\n\n` +
        `I am **${maxScore}%** confident that this is a **stolen** image. ` +
        `I found the same image on **${totalMatchCount}** other site(s). ` +
        `Here is an example of what I found:\n\n `+
        `${urlStr}${DISCLAIMER}\n\n---\n\n${COMMENT_FEEDBACK_LINK}`;

    const stolenCommentStrPlural = `🚨 **Picture Police** 🚨\n\n` +
        `I am **${maxScore}%** confident that this post contains **stolen** ` +
        `images. I found duplicate images on **${totalMatchCount}** other ` +
        `sites. Here is an example of each image found on another site:\n\n `+
        `${urlStr}${DISCLAIMER}\n\n---\n\n${COMMENT_FEEDBACK_LINK}`;

    const isOc = maxScore <= 0;
    const possibleOc = !isOc && maxScore < MIN_CONF;
    const probablyStolen = !possibleOc && maxScore <= 100;
    const isSingular = numUserImages === 1;
    const isPlural = numUserImages > 1;
    let commentStr = "";

    if (isOc && isSingular)
    {
        commentStr = ocCommentStrSingular;
    }
    else if (isOc && isPlural)
    {
        commentStr = ocCommentStrPlural;
    }
    else if (possibleOc && isSingular)
    {
        commentStr = possibleOcCommentStrSingular;
    }
    else if (possibleOc && isPlural)
    {
        commentStr = possibleOcCommentStrPlural;
    }
    else if (probablyStolen && isSingular)
    {
        commentStr = stolenCommentStrSingular;
    }
    else if (probablyStolen && isPlural)
    {
        commentStr = stolenCommentStrPlural;
    }

    commentStr = commentStr.replaceAll(SUB_TOKEN, context.subredditName);
    commentStr = commentStr.replace(POST_ID_TOKEN, postId.replace("t3_", ""));

    const comment = await context.reddit.submitComment({
        id: postId,
        text: commentStr
    });

    if (comment)
    {
        log("LOG", "Successful comment on post", postId);
        if (settings["DISTINGUISH"])
        {
            await comment.distinguish(settings["STICKY"]);
        }
    }
    else
    {
        log("ERROR", "Failed to comment on post", postId);
    }
}

function getUrlExampleString(
    numUrlsToPrint: number,
    sourceMatches: Match[]|[],
    numUserImages: number): string
{
    const urlsToPrint = new Map<number, string[]>();

    for (const match of sourceMatches)
    {
        const urls = [];
        for (const url of match.matches)
        {
            if (urls.length >= numUrlsToPrint) break;
            const urlObj = new URL(url);
            const isRedditPermalink = urlObj.hostname.endsWith("reddit.com") &&
                                      urlObj.pathname.includes("comments");

            if (isRedditPermalink)
            {   // prefer Reddit links over external links
                urls.push(url);
            }
        }

        if (urls.length < numUrlsToPrint)
        {   // if there were not enough Reddit URLs, fallback to external URLs
            for (const url of match.matches)
            {
                if (urls.length >= numUrlsToPrint) break;
                const urlObj = new URL(url);
                const isRedditPermalink = urlObj.hostname.endsWith("reddit.com") &&
                                          urlObj.pathname.includes("comments");

                if (!isRedditPermalink)
                {
                    urls.push(url);
                }
            }
        }

        urlsToPrint.set(match.galleryIdx, urls);
    }

    // build a string for pretty-printing the Reddit message
    let urlStr = "";
    urlsToPrint.forEach((urlArr, idx) =>
    {
        if (urlArr.length === 0)
        {
            return;
        }

        if (numUserImages > 1)
        {
            urlStr += `**Image [${idx}/${numUserImages}]**\n\n`;
        }

        for (const url of urlArr)
        {
            urlStr += `* ${url}\n\n`;
        }
    });

    return urlStr;
}

/**
 * Sends a moderator mail notification based on specified parameters and
 * conditions.
 *
 * @param {any} context - The context containing settings and Reddit API
 * resources.
 * @param {string} authorName - The username of the author of the post being
 * flagged.
 * @param {string} title - The title of the post being assessed.
 * @param {string} url - The URL of the post being flagged.
 * @param {number} numMatches - The number of potential matches indicating
 * stolen content.
 * @param sourceMatches
 * @param {number} maxScore - The highest similarity score among the matches.
 * @param {number} numUserImages - The number of images the OP submitted.
 * @return {Promise<void>} A promise that resolves when the moderator mail
 * notification is successfully sent or the function completes its execution.
 */
export async function sendModMail(
    context: any,
    authorName: string,
    title: string,
    url: string,
    numMatches: number,
    sourceMatches: Match[]|[],
    maxScore: number,
    numUserImages: number): Promise<void>
{
    const settings = await context.settings.getAll();
    let urlStr: string = getUrlExampleString(
        settings["NUM_URLS"], sourceMatches, numUserImages
    );

    if (settings["MOD_MAIL"] &&
        numMatches > 0 &&
        maxScore >= settings["CONFIDENCE_THRESHOLD"])
    {
        const matchStr = numMatches > 1 ? "matches" : "match";

        const msg = `######The following post has potential stolen content:\n\n`+
            `**Note:** A score of 50% or lower indicates only partial matches `+
            `were found and should be manually reviewed by a moderator.\n\n`+
            `**Post Link:** ${url}\n\n`+
            `**Author:** u/${authorName}\n\n`+
            `**Title:** ${title}\n\n`+
            `**Matches:** ${numMatches}\n\n`+
            `**Score:** ${maxScore}%\n\n`+
            `**Example ${matchStr}:**\n\n${urlStr}\n\n---\n\n`+
            `${MOD_MAIL_FEEDBACK_LINK.replace(URL_TOKEN, url)}`;

        const modMailId = await context.reddit.modMail.createModNotification({
            subject: "🚨 Picture Police Report 🚨",
            bodyMarkdown: msg,
            subredditId: context.subredditId
        });

        if (modMailId)
        {
            log("LOG", "Sent mod mail notification", url);
        }
        else
        {
            log("ERROR", "Failed to send mod mail", url);
        }
    }
}

/**
 * Reports a post on Reddit if the provided conditions are met.
 *
 * @param {any} context - The context object containing application settings
 *                        and necessary methods for reporting.
 * @param {string} postId - The unique identifier of the post to be reported.
 * @param {number} numMatches - The number of matches found indicating
 *                               potential stolen content.
 * @param {string} maxScore - The maximum confidence score among the matches.
 * @return {Promise<void>} A promise that resolves once the post reporting
 *                         operation is completed.
 */
export async function reportPost(
    context: any,
    postId: string,
    numMatches: number,
    maxScore: number): Promise<void>
{
    const settings = await context.settings.getAll();
    const sendReport: boolean = settings["REPORT"];
    const minConfidence: number = settings["CONFIDENCE_THRESHOLD"];
    const hasMatch: boolean = numMatches > 0;
    const meetsMinConfidence: boolean = maxScore >= minConfidence;

    if (sendReport && hasMatch && meetsMinConfidence)
    {
        const matchStr = numMatches > 1 ? "matches" : "match";
        await context.reddit.report({id: postId}, {
            reason: `Potential Stolen Content, ${numMatches} ${matchStr} found`
        });
        log("LOG", "Reported post", postId);
    }
}

/**
 * Removes a specified post if removal is enabled and there are matches.
 *
 * @param {any} context - The operational context that includes settings and
 *                        methods for interacting with posts.
 * @param {string} postId - The unique identifier of the post to be removed.
 * @param {number} numMatches - The number of matches to determine if the post
 *                               qualifies for removal.
 * @param {number} maxScore - The highest confidence score among the matches.
 * @return {Promise<void>} A promise that resolves when the post removal
 *                         process is completed.
 */
export async function removePost(
    context: any,
    postId: string,
    numMatches: number,
    maxScore: number): Promise<void>
{
    const settings = await context.settings.getAll();
    const removePost: boolean = settings["REMOVE"];
    const minConfidence: number = settings["CONFIDENCE_THRESHOLD"];
    const hasMatch: boolean = numMatches > 0;
    const meetsMinConfidence: boolean = maxScore >= minConfidence;

    if (removePost && hasMatch && meetsMinConfidence)
    {
        await context.reddit.remove(postId, false);
        log("LOG", "Removed post", postId);
    }
}

/**
 * Sends an action summary to the moderators via mod mail based on the given
 * frequency. Calculates metrics for scans, potential matches, probable
 * matches, and the original content (OC) rate. Also resets the stored metrics
 * after sending the summary.
 *
 * @param {object} context - The execution context containing redis and reddit
 *                           API clients, as well as the subreddit ID.
 * @param {string} frequency - The frequency of the report. Supported values
 *                             are "daily", "weekly", and "monthly".
 * @return {Promise<void>} A promise that resolves when the action summary has
 *                         been successfully sent or an error has occurred.
 */
export async function sendActionSummary(
    context: any,
    frequency: string): Promise<void>
{
    const [scanStr, potentialStr, probableStr, apiCountStr] = await Promise.all([
        context.redis.get(SCAN_KEY),
        context.redis.get(POTENTIAL_MATCH_KEY),
        context.redis.get(PROBABLE_MATCH_KEY),
        context.redis.get(GVIS_API_REQ_COUNT_KEY)
    ]);

    const totalScans = parseInt(scanStr || '0', 10);
    const potential = parseInt(potentialStr || '0', 10);
    const probable = parseInt(probableStr || '0', 10);
    const apiCount = parseInt(apiCountStr || '0', 10);

    if (Number.isNaN(totalScans) ||
        Number.isNaN(potential) ||
        Number.isNaN(probable) ||
        Number.isNaN(apiCount))
    {
        log("ERROR", "Invalid Redis value(s)", "N/A");
        await redisDeleteAll(context);
        return;
    }

    const totalOc = totalScans - potential - probable;
    const ocRate = totalScans > 0
        ? ((totalOc / totalScans) * 100).toFixed(1)
        : "0.0";

    const config: Record<string, { label: string; range: string }> = {
        daily:   { label: "Daily",   range: "24 hours" },
        weekly:  { label: "Weekly",  range: "7 days" },
        monthly: { label: "Monthly", range: "month" },
    };

    const { label, range } = config[frequency] || { label: frequency, range: frequency };
    const totalCost = totalScans * 0.0035;

    const summaryMarkdown = `
###### Here is the action summary for the last ${range}.

| Metric | Count |
| :--- | :--- |
| **Total Post Scans** | ${totalScans} |
| **Potential Matches** | ${potential} |
| **Probable Matches** | ${probable} |
| **Total API Requests** | ${apiCount} |
| **Total API Cost** | $${totalCost.toFixed(2)} |

> **OC Rate:** ${ocRate}% of submissions were original content.

---

Manage these notifications in [your app settings](https://developers.reddit.com/r/${context.subredditName}/apps/picture-police).
`;

    try
    {
        await context.reddit.sendPrivateMessage({
            to: "96dpi",
            subject: `Picture Police ${label} Action Summary for r/${context.subredditName}`,
            text: summaryMarkdown.trim()
        });

        await context.reddit.modMail.createModNotification({
            subject: `🛡️ Picture Police ${label} Action Summary 🛡️`,
            bodyMarkdown: summaryMarkdown.trim(),
            subredditId: context.subredditId
        });
        log("INFO", `Sent ${frequency} action summary`, "N/A");
    }
    catch (e)
    {
        log("ERROR", `Failed to send ${frequency} action summary`, "N/A");
    }

    await redisDeleteAll(context);
}

async function redisDeleteAll(context: any)
{
    await Promise.all([
        context.redis.del(SCAN_KEY),
        context.redis.del(POTENTIAL_MATCH_KEY),
        context.redis.del(PROBABLE_MATCH_KEY),
        context.redis.del(GVIS_API_REQ_COUNT_KEY)
    ]);
}

/**
 * Determines if the given URL is a direct link to a Reddit-hosted media file
 * such as an image or a GIF.
 *
 * @param {string} url - The URL to be checked.
 * @return {boolean} Returns true if the URL is a direct link to a Reddit-hosted
 * media file (e.g., jpg, png, gif, jpeg), otherwise false.
 */
export function isDirectRedditImgUrl(url: string): boolean
{
    const urlObj = new URL(url);
    return urlObj.hostname.endsWith("redd.it") &&
           (urlObj.pathname.includes(".jpg") ||
           urlObj.pathname.includes(".png") ||
           urlObj.pathname.includes(".gif") ||
           urlObj.pathname.includes(".jpeg"));
}

export function isRedditPermalink(url: string): boolean
{
    const urlObj = new URL(url);
    return urlObj.hostname.endsWith("reddit.com") &&
           urlObj.pathname.includes("comments");
}

/**
 * Determines whether a given URL is associated with a Reddit asset, which
 * includes resources hosted on domains such as "redditmedia.com" and
 * "redditstatic.com". These are typically thumbnails, but can also be icons,
 * emojis, and subreddit banners.
 *
 * @param {string} url - The URL to evaluate.
 * @return {boolean} True if the URL is a Reddit asset, otherwise false.
 */
export function isRedditAsset(url: string): boolean
{
    const urlObj = new URL(url);
    return urlObj.hostname.endsWith("redditmedia.com") ||
           urlObj.hostname.endsWith("redditstatic.com");
}

export function stripQueryString(urlStr: string): string
{
    try
    {
        const urlObj = new URL(urlStr);
        return `${urlObj.origin}${urlObj.pathname}`;
    }
    catch (error)
    {   // don't change anything on error, malformed URL
        return urlStr;
    }
}

// function getTimeDifference(originalPostDate: string, matchingPostDate: string)
// {
//     const d1 = new Date(originalPostDate);
//     const d2 = new Date(matchingPostDate);
//
//     if (isNaN(d1.getTime()) || isNaN(d2.getTime()))
//     {
//         return null;
//     }
//
//     const diffMs = Math.abs(d1.getTime() - d2.getTime());
//
//     return {
//         totalMilliseconds: diffMs,
//         days: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
//         hours: Math.floor((diffMs / (1000 * 60 * 60)) % 24),
//         minutes: Math.floor((diffMs / (1000 * 60)) % 60),
//         seconds: Math.floor((diffMs / 1000) % 60)
//     };
// }

/**
 * Logs a message with a specified log level, timestamp, and permalink.
 *
 * @param {string} level - The severity level of the log (e.g., error, warn,
 * debug).
 * @param {string} message - The message to log. If the message exceeds the
 * maximum length, it will be truncated with ellipsis.
 * @param {string} permalink - A URL or reference for additional context
 * related to the log.
 * @param {string} backgroundColor - Sets the optional background color.
 * @return {void} This function does not return any value.
 */
export function log(
    level: string,
    message: string,
    permalink: string,
    backgroundColor?: string): void
{
    const timestamp = new Date().toISOString();
    const MAX_LOG_LEN = 30;

    const fgColors: { [key: string]: string } = {
        RESET: "\x1b[0m",
        BLACK: "\x1b[30m",
        RED: "\x1b[31m",
        GREEN: "\x1b[32m",
        YELLOW: "\x1b[33m",
        BLUE: "\x1b[34m",
        MAGENTA: "\x1b[35m",
        CYAN: "\x1b[36m",
        WHITE: "\x1b[37m"
    };

    const bgColors: { [key: string]: string } = {
        BLACK: "\x1b[40m",
        RED: "\x1b[41m",
        GREEN: "\x1b[42m",
        YELLOW: "\x1b[43m",
        BLUE: "\x1b[44m",
        MAGENTA: "\x1b[45m",
        CYAN: "\x1b[46m",
        WHITE: "\x1b[47m"
    };

    let colorCode = fgColors.WHITE;
    const upperLevel = level.toUpperCase();
    const paddedLevel = upperLevel.padEnd(5);

    if (upperLevel === "ERROR") colorCode = fgColors.RED;
    else if (upperLevel === "WARN") colorCode = fgColors.YELLOW;
    else if (upperLevel === "DEBUG") colorCode = fgColors.BLUE;
    else if (upperLevel === "INFO") colorCode = fgColors.CYAN;

    const selectedColor = colorCode; // prevents level text color from changing
    let bgCode = "";

    if (backgroundColor)
    {
        const bgKey = backgroundColor.toUpperCase();
        if (bgKey in bgColors)
        {
            bgCode = bgColors[bgKey];
            if (["YELLOW", "WHITE", "CYAN", "GREEN"].includes(bgKey))
            {
                colorCode = fgColors.BLACK;
            }
        }
    }

    const paddedMsg = message.length > MAX_LOG_LEN
        ? message.substring(0, (MAX_LOG_LEN - 3)) + "..."
        : message.padEnd(MAX_LOG_LEN);

    const coloredLevel = `${selectedColor}${paddedLevel}${fgColors.RESET}`;
    const coloredMsg = `${bgCode}${colorCode}${paddedMsg}${fgColors.RESET}`;

    console.log(`${timestamp} | ${coloredLevel} | ${coloredMsg} | ${permalink}`);
}