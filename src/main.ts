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
        name: 'GOOGLE_VISION_KEY', // <-- MUST match the CLI key exactly
        label: 'Google Vision API Key',
        isSecret: true,
        scope: SettingScope.App, // <-- Crucial for CLI access
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
    } catch (e)
    {
        console.error("Google API Error:", e);
        return null;
    }
}

Devvit.addTrigger({
    event: 'PostCreate',
    onEvent: async (event, context) =>
    {
        const post = event.post;
        const imgUrls = [];

        if (post === undefined) return console.error("Bad Post!");

        if (post.isGallery)
        {
            for (const url of post.galleryImages)
            {
                if (url.match(/\.(jpeg|jpg|png)$/i))
                {
                    console.debug(`Adding gallery URL: ${url}`);
                    imgUrls.push(url);
                }
            }
        }
        else if (post.url.match(/\.(jpeg|jpg|png)$/i))
        {
            console.debug(`Adding single URL: ${post.url}`);
            imgUrls.push(post.url);
        }
        else
        {
            console.debug("No image found in post.");
            return;
        }

        console.debug("Getting API Key...");
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

        console.debug(`Checking image(s) for post: ${post.title}`);
        let totalScore = 0;
        let totalMatchCount = 0;
        const matchUrls = [];

        for (const url of imgUrls)
        {
            console.debug(`Working image: ${url}`);
            const result = await checkGoogleVision(url, apiKey);

            if (!result || !result.pagesWithMatchingImages)
            {
                console.debug("No matches found. Original content?");
                continue;
            }

            const matchCount = result.fullMatchingImages.length;
            totalMatchCount += matchCount;

            const externalMatches = result.fullMatchingImages.filter((page: any) =>
                !page.url.includes("reddit.com") && !page.url.includes("redd.it")
            );

            const redditMatches = result.fullMatchingImages.filter((page: any) =>
                page.url.includes("reddit.com") || page.url.includes("redd.it")
            );

            console.debug(`redditMatches length: ${redditMatches.length}`);

            for (const match of redditMatches)
            {
                console.debug(`Fetching URL: ${match.url}`);
                const submissionId = getSubmissionId(match.url, context);
            }

            for (const page of result.fullMatchingImages)
            {   // debug only
                console.log(`full match: ${page.url}`);
            }

            for (const page of externalMatches)
            {   // debug only
                console.log(`external match: ${page.url}`);
            }

            let score = 0;

            // Simple Scoring Logic
            if (matchCount > 10) score = 99;      // Viral / Everywhere
            else if (matchCount > 3) score = 75;  // Likely copied
            else if (matchCount > 0) score = 30;  // Low confidence - ask OP to prove this is their OC image

            totalScore += score;
            console.log(`Score: ${score}% | Matches: ${matchCount}`);

            // Action: Report or Comment if score is high
            if (score >= 70)
            {
                console.log("Potential Stolen Content Detected!");
                matchUrls.push(result.fullMatchingImages[0].url);
            } else
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
        const avgScore = totalScore / matchUrls.length;

        await context.reddit.submitComment({
            id: post.id,
            text: `🚨 **Picture Police** 🚨\n\nI am **${Math.round(avgScore)}%** confident that this post contains **stolen** images. I found duplicate images on **${totalMatchCount}** other sites. Here is an example of each image found on another site:\n\n${urlStr}`
        });
        // TODO add an option to print a string on 100% confidence of original content (no matches)
    },
});

async function getSubmissionId(mediaUrl: string, ctx: Devvit.Context): Promise<string | null>
{
    const cleanedUrl = mediaUrl
        .replace("preview.redd.it", "i.redd.it")
        .split('?')[0];

    console.debug(`Cleaned URL: ${cleanedUrl}`);
    const infoUrl = `https://www.reddit.com/api/info.json?url=${encodeURIComponent(cleanedUrl)}`;

    try
    {
        // Use the native Devvit fetch, which is already configured for Reddit
        // TODO need to fetch submission ID

        const response = await ctx.reddit.fetch(infoUrl, {headers: {'User-Agent': 'devvit:picture-police:v1.0 (by /u/96dpi)'}});
        if (!response.ok)
        {
            console.error("Response not OK:", response.status, response.statusText);
            return null;
        }

        const data = await response.json();
        console.debug(`JSON response: ${JSON.stringify(data, null, 2)}`);

        // 3. Extract the Submission ID from the JSON response
        if (data.data && data.data.children && data.data.children.length > 0)
        {
            // The post data will be the first item in the 'children' array
            const postData = data.data.children[0].data;

            // postData.id is the short 6-character submission ID (e.g., "a1b2c3")
            const submissionId = postData.id;

            console.log(`Successfully extracted Submission ID: ${submissionId}`);
            return submissionId;
        }
    }
    catch (error)
    {
        console.error("Error fetching submission info from API:", error);
    }

    return null;
}

export default Devvit;
