import {Devvit, SettingScope} from "@devvit/public-api";

Devvit.configure(
    {
        redditAPI: true,
        http: {
            enabled: true,
            domains: ["reddit.com", "redd.it"]
        },
    });

Devvit.addSettings([
    {
        type: 'string',
        name: 'GOOGLE_VISION_KEY',
        label: 'Google Vision API Key',
        isSecret: true,
        scope: SettingScope.App,
    },
]);

async function checkGoogleVision(imgUrl: string, apiKey: string)
{
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    const body =
        {
            requests: [
                {
                    image: {source: {imageUri: imgUrl}},
                    features: [{type: 'WEB_DETECTION', maxResults: 20}]
                }
            ]
        };

    try
    {
        const response = await fetch(apiUrl,
            {
                method: 'POST',
                body: JSON.stringify(body),
                headers: {'Content-Type': 'application/json'}
            });

        const data = await response.json();
        return data.responses[0].webDetection;
    }
    catch (e)
    {
        console.error("Google API Error:", e);
        return null;
    }
}

async function getOpFromUrl(url: string, reddit: RedditAPIClient): Promise<string | undefined>
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

Devvit.addTrigger({
    event: 'PostCreate',
    onEvent: async (event, context) =>
    {
        const post = event.post;
        const author = event.author;

        if (post === undefined)
        {
            return console.error("Unable to get post data.");
        }

        if (author === undefined)
        {
            return console.error("Unable to get author data.");
        }

        const userImgUrls = [];
        const authorName = author.name;
        console.log(`Processing new post "${post.title}" by u/${authorName}`);

        if (post.isGallery)
        {
            console.debug("Detected gallery post, checking for gallery image URLs.")
            for (const url of post.galleryImages)
            {
                if (url.match(/\.(jpeg|jpg|png)$/i))
                {
                    userImgUrls.push(url);
                }
            }
            console.debug(`Added ${userImgUrls.length} gallery image URLs.`);
        }
        else if (post.url.match(/\.(jpeg|jpg|png)$/i))
        {
            console.debug(`Adding single URL: ${post.url}`);
            userImgUrls.push(post.url);
        }
        else
        {   // TODO check for www.imgur.com links in post body?
            console.debug("No image found in post.");
            return;
        }

        const apiKey = await context.settings.get('GOOGLE_VISION_KEY');
        if (!apiKey)
        {
            console.error("API Key not set!");
            return;
        }

        if (typeof apiKey !== 'string')
        {
            console.error("API Key must be a string");
            return;
        }

        let totalScore = 0;
        let totalMatchCount = 0;
        let numOpMatches = 0;
        const matchUrls = [];

        for (const url of userImgUrls)
        {
            console.debug(`Working image: ${url}`);
            const result = await checkGoogleVision(url, apiKey);

            if (!result)
            {
                console.log("Bad result from Google Vision API.");
                continue;
            }

            if (!result.pagesWithMatchingImages)
            {
                console.log("No matches found in pagesWithMatchingImages");
                if (result.partialMatchingImages && result.partialMatchingImages.length > 0)
                {
                    console.debug(`There are ${result.partialMatchingImages.length} partial matching images`);
                }
                continue;
            }

            const fullMatches: string[] = [];
            for (const match of result.pagesWithMatchingImages)
            {   // pagesWithMatchingImages can have more than 1 URL per image,
                // so we must find unique URLs
                console.debug(`pagesWithMatchingImages length: ${result.pagesWithMatchingImages.length}`);
                if (match.fullMatchingImages &&
                    match.fullMatchingImages.length > 0)
                {
                    fullMatches.push(match.url);
                }
            }

            console.debug(fullMatches);

            const {redditMatches, externalMatches} = fullMatches.reduce(
                (acc, url) =>
                {
                    const isReddit = url.includes("reddit.com") || url.includes("redd.it");
                    if (isReddit)
                    {
                        if (url.includes("/comments/") && !url.includes("/?tl="))
                        {
                            acc.redditMatches.push(url);
                        }
                    }
                    else
                    {
                        acc.externalMatches.push(url);
                    }
                    return acc;
                },
                {redditMatches: [] as string[], externalMatches: [] as string[]}
            );

            console.debug(`redditMatches length: ${redditMatches.length}`);
            console.debug(`externalMatches length: ${externalMatches.length}`);
            totalMatchCount = redditMatches.length + externalMatches.length;

            for (const url of redditMatches)
            {
                const foundAuthor = await getOpFromUrl(url, context.reddit);

                if (!foundAuthor)
                {
                    console.error("Unable to find username from matching post.");
                }

                if (authorName === foundAuthor)
                {
                    console.log(`Matched OP: u/${foundAuthor}`);
                    totalMatchCount--;
                    numOpMatches++;
                }
            }

            for (const url of externalMatches)
            {   // debug only
                console.log(`external match: ${url}`);
            }

            let score = 0;

            if (totalMatchCount > 10 ||
                (numOpMatches == 0 && redditMatches.length > 0))
            {
                score = 100;
            }
            else if (totalMatchCount > 3)
            {
                score = 90;
            }
            else if (totalMatchCount > 1)
            {
                score = 75;
            }
            else if (totalMatchCount > 0)
            {
                score = 50;
            }// Low confidence - ask OP to prove this is their OC image

            totalScore += score;
            console.log(`Score: ${score}% | Matches: ${totalMatchCount}`);

            // Action: Report or Comment if score is high
            if (score > 0)
            {
                console.log("Potential Stolen Content Detected!");
                // FIXME this needs to pull from the correct array
                if (redditMatches.length > 0)
                {   // Prefer Reddit examples, and just show the first one
                    matchUrls.push(redditMatches[0]);
                }
                else if (externalMatches.length > 0)
                {
                    matchUrls.push(externalMatches[0]);
                }
                else
                {
                    console.warn("Coding error: Missing a condition!");
                }
            }
            else
            {
                console.log("No stolen content detected.");
            }
        }

        if (matchUrls.length <= 0)
        {
            return;
        }

        // Option A: Report to Mods
        // FIXME not working
        // await context.reddit.report(post.id, {
        //     reason: `Potential Stolen Content (${score}% match confidence)`
        // });

        let urlStr = "";
        for (let i = 1; i <= matchUrls.length; i++)
        {
            urlStr += `Image ${i}: ${matchUrls[i - 1]}\n\n`;
        }

        // remove the last two newlines
        urlStr = urlStr.slice(0, -2);
        const avgScore = Math.round(totalScore / matchUrls.length);

        await context.reddit.submitComment({
            id: post.id,
            text: `🚨 **Picture Police** 🚨\n\nI am **${Math.round(avgScore)}%** confident that this post contains **stolen** images. I found duplicate images on **${totalMatchCount}** other sites. Here is an example of each image found on another site:\n\n${urlStr}`
        });
        // TODO add an option to print a string on 100% confidence of original content (no matches)
    },
});

export default Devvit;
