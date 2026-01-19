import {RedditAPIClient} from "@devvit/public-api";
import {Match} from "./Match.js";

const URL_TOKEN = "[URL_TOKEN]";
const MIN_CONF = 50; // a score BELOW this number is considered NOT confident
const MAIL_LINK = `[Click here to submit feedback](https://www.reddit.com/message/compose/?to=96dpi&subject=Picture%20Police%20Feedback&message=Regarding%20post:%20${URL_TOKEN})`;
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
 * @return {Promise<Map<number, string>>} A promise that resolves to the total number of
 * matches found.
 */
export async function comment(
    numUserImages: number,
    totalMatchCount: number,
    sourceMatches: Match[]|[],
    maxScore: number,
    context: any,
    postId: string,
    authorName: string): Promise<Map<number, string>>
{
    const settings = await context.settings.getAll();
    const urlsToPrint = new Map<number, string>();

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

    // build a string for pretty-printing the reddit comment
    let urlStr = "";
    let hasExternalLinks = false;
    urlsToPrint.forEach((url, idx) =>
    {
        if (!url)
        {
            return;
        }

        if (numUserImages > 1)
        {
            urlStr += `Image [${idx}/${numUserImages}]: `;
        }

        if (url.includes("redd.it") || url.includes("reddit.com"))
        {
            urlStr += `${url}\n\n`;
        }
        else
        {   // "hide" external links by using the Markdown spoiler tag
            urlStr += `>!${url}!<\n\n`;
            hasExternalLinks = true;
        }
    });

    if ((totalMatchCount <= 0 && settings["LEAVE_COMMENT"]?.[0] === "matches")||
        settings["LEAVE_COMMENT"]?.[0] === "never")
    {
        return urlsToPrint;
    }

    const ocCommentStrSingular = `🚨 **Picture Police** 🚨\n\n` +
        `This image appears to be u/${authorName}'s original content. I could `+
        `not find any matching images anywhere on the web.\n\n`+
        `---\n\n${MAIL_LINK}`;

    const ocCommentStrPlural = `🚨 **Picture Police** 🚨\n\n` +
        `These images appear to be u/${authorName}'s original content. I could `+
        `not find any matching images anywhere on the web.\n\n`+
        `---\n\n${MAIL_LINK}`;

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
        `${urlStr}${DISCLAIMER}\n\n---\n\n${MAIL_LINK}`;

    const stolenCommentStrPlural = `🚨 **Picture Police** 🚨\n\n` +
        `I am **${maxScore}%** confident that this post contains **stolen** ` +
        `images. I found duplicate images on **${totalMatchCount}** other ` +
        `sites. Here is an example of each image found on another site:\n\n `+
        `${urlStr}${DISCLAIMER}\n\n---\n\n${MAIL_LINK}`;

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

    if (!hasExternalLinks)
    {
        commentStr = commentStr.replace((DISCLAIMER + "\n\n"), "");
    }

    const comment = await context.reddit.submitComment({
        id: postId,
        text: commentStr.replace(URL_TOKEN, postId)
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

    return urlsToPrint;
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
 * @param {number} maxScore - The highest similarity score among the matches.
 * @param {number} numUserImages - The number of images the OP submitted.
 * @param {Map<number, string>} matchingUrls - Key is the 1-based gallery index,
 * and value is the URL to the matching image.
 * @return {Promise<void>} A promise that resolves when the moderator mail
 * notification is successfully sent or the function completes its execution.
 */
export async function sendModMail(
    context: any,
    authorName: string,
    title: string,
    url: string,
    numMatches: number,
    maxScore: number,
    numUserImages: number,
    matchingUrls: Map<number, string>): Promise<void>
{
    let urlStr = "";
    matchingUrls.forEach((matchUrl, idx) =>
    {
        if (!matchUrl) return;

        if (numUserImages > 1)
        {
            urlStr += `Image [${idx}/${numUserImages}]: `;
        }

        urlStr += `${matchUrl}\n\n`;
    });

    const sendModMail: boolean = await context.settings.get("MOD_MAIL");
    if (sendModMail && numMatches > 0)
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
            `${MAIL_LINK.replace(URL_TOKEN, url)}`;

        const modMailId = await context.reddit.modMail.createModNotification({
            subject: "🚨 Picture Police Report 🚨",
            bodyMarkdown: msg,
            subredditId: context.subredditId
        })

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
 * @return {Promise<void>} A promise that resolves once the post reporting
 *                         operation is completed.
 */
export async function reportPost(
    context: any,
    postId: string,
    numMatches: number): Promise<void>
{
    const sendReport: boolean = await context.settings.get("REPORT");
    if (sendReport && numMatches > 0)
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
    const removePost: boolean = await context.settings.get("REMOVE");
    if (removePost && numMatches > 0 && maxScore >= MIN_CONF)
    {
        await context.reddit.remove(postId, false);
        log("LOG", "Removed post", postId);
    }
}

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