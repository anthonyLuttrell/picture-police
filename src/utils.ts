import {RedditAPIClient} from "@devvit/public-api";
import {Match} from "./Match.js";

const REDDIT_RATE_LIMIT_DELAY_MS = 650; // 100 queries per minute + 50ms buffer
const MAIL_LINK = "[Click here to submit feedback](https://www.reddit.com/message/compose/?to=picture-police&subject=Picture%20Police%20Feedback&message=Please%20describe%20the%20issue%20or%20feedback%20here:)";
const DISCLAIMER = `**Note:** Click on external links at your own risk. This `+
    `bot does not guarantee the security of any external websites you visit.`;

// TODO context.reddit.user.getSocialLinks() to compare user name to social links or found websites

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

export function getImgUrl(post: any): string[] | []
{
    return post.url.match(/\.(jpeg|jpg|png)$/i) ? [post.url] : [];
}

export function getGalleryUrls(post: any): string[] | []
{
    const urlList = post.galleryImages.filter(
        (url: string) => url.match(/\.(jpeg|jpg|png)$/i)
    );

    // for (const [idx, url] of urlList.entries())
    // {
    //     console.debug(`posted gallery image [${idx + 1}/${urlList.length}]: ${url}`);
    // }

    return urlList.length > 0 ? urlList : [];
}

export function getTotalMatchCount(sourceMatches: Match[]|[],)
{
    let totalMatchCount: number = 0;

    for (const match of sourceMatches)
    {
        totalMatchCount += match.numMatches;
    }

    return totalMatchCount;
}

export function getMaxScore(sourceMatches: Match[] | [],)
{
    let maxScore: number = 0;

    for (const match of sourceMatches)
    {
        if (match.score > maxScore)
        {
            maxScore = match.score;
        }
    }

    return maxScore;
}

export async function comment(
    numUserImages: number,
    totalMatchCount: number,
    sourceMatches: Match[]|[],
    maxScore: number,
    context: any,
    postId: string): Promise<number>
{
    const settings = await context.settings.getAll();
    const urlsToPrint = new Map<number, string>();

    if ((totalMatchCount <= 0 && settings["LEAVE_COMMENT"]?.[0] === "matches")||
        settings["LEAVE_COMMENT"]?.[0] === "never")
    {
        return totalMatchCount;
    }

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

    const ocCommentStrSingular = `🚨 **Picture Police** 🚨\n\n` +
        `This image appears to be original content. I could not find any `+
        `matching images anywhere on the web.\n\n---\n\n${MAIL_LINK}`;

    const ocCommentStrPlural = `🚨 **Picture Police** 🚨\n\n` +
        `These images appear to be original content. I could not find any `+
        `matching images anywhere on the web.\n\n---\n\n${MAIL_LINK}`;

    const stolenCommentStrSingular = `🚨 **Picture Police** 🚨\n\n` +
        `I am **${maxScore}%** confident that this is a **stolen** image. ` +
        `I found duplicate images on **${totalMatchCount}** other sites. ` +
        `Here is an example of what I found:\n\n `+
        `${urlStr}${DISCLAIMER}\n\n---\n\n${MAIL_LINK}`;

    const stolenCommentStrPlural = `🚨 **Picture Police** 🚨\n\n` +
        `I am **${maxScore}%** confident that this post contains **stolen** ` +
        `images. I found duplicate images on **${totalMatchCount}** other ` +
        `sites. Here is an example of each image found on another site:\n\n `+
        `${urlStr}${DISCLAIMER}\n\n---\n\n${MAIL_LINK}`;

    const isOc = maxScore <= 0;
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
    else if (!isOc && isSingular)
    {
        commentStr = stolenCommentStrSingular;
    }
    else if (!isOc && isPlural)
    {
        commentStr = stolenCommentStrPlural;
    }

    if (!hasExternalLinks)
    {   // FIXME this isn't working
        commentStr.replace((DISCLAIMER + "\n\n"), "");
    }

    const comment = await context.reddit.submitComment({
        id: postId,
        text: commentStr
    });

    if (settings["DISTINGUISH"])
    {
        await comment.distinguish(settings["STICKY"]);
    }

    return totalMatchCount;
}

export async function sendModMail(
    context: any,
    authorName: string,
    title: string,
    url: string,
    numMatches: number)
{
    const sendModMail: boolean = await context.settings.get("MOD_MAIL");
    if (sendModMail && numMatches > 0)
    {
        const msg = `######The following post has been removed due to potential stolen content:\n\n`+
            `**Post Link:** ${url}\n\n`+
            `**Author:** u/${authorName}\n\n`+
            `**Title:** ${title}\n\n`+
            `**Matches:** ${numMatches}`;

        await context.reddit.modMail.createModNotification({
            subject: "🚨 Picture Police Report 🚨",
            bodyMarkdown: msg,
            subredditId: context.subredditId
        })
    }
}

export async function reportPost(context: any, postId: string, numMatches: number)
{
    const sendReport: boolean = await context.settings.get("REPORT");
    if (sendReport && numMatches > 0)
    {
        let matchStr = "match";
        matchStr += numMatches > 1 ? "es" : "";
        await context.reddit.report({id: postId}, {
            reason: `Potential Stolen Content, ${numMatches} ${matchStr} found`
        });
        log("DEBUG", "Reported post", postId);
    }
}

export async function removePost(context: any, postId: string, numMatches: number)
{
    const removePost: boolean = await context.settings.get("REMOVE");
    if (removePost && numMatches > 0)
    {
        await context.reddit.remove(postId, false);
        log("LOG", "Removed post", postId);
    }
}

export function log(level: string, message: string, permalink: string)
{
    const timestamp = new Date().toISOString();
    const MAX_LOG_LEN = 30;

    const colors = {
        RESET: "\x1b[0m",
        RED: "\x1b[31m",
        YELLOW: "\x1b[33m",
        BLUE: "\x1b[34m",
        WHITE: "\x1b[37m"
    };

    let colorCode = colors.WHITE;
    const upperLevel = level.toUpperCase();
    const paddedLevel = upperLevel.padEnd(5);

    if (upperLevel === "ERROR") colorCode = colors.RED;
    else if (upperLevel === "WARN") colorCode = colors.YELLOW;
    else if (upperLevel === "DEBUG") colorCode = colors.BLUE;

    const paddedMsg = message.length > MAX_LOG_LEN
        ? message.substring(0, (MAX_LOG_LEN - 3)) + "..."
        : message.padEnd(MAX_LOG_LEN);

    const coloredLevel = `${colorCode}${paddedLevel}${colors.RESET}`;

    console.log(`${timestamp} | ${coloredLevel} | ${paddedMsg} | ${permalink}`);
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));