import {Devvit, SettingScope} from "@devvit/public-api";
import {comment, getGalleryUrls, getImgUrl, getTotalMatchCount, getMaxScore, sendModMail, reportPost, removePost, log} from "./utils.js";
import {reverseImageSearch, findMatchingUsernames} from "./scan.js";
// import {validateApiKey} from "./validation.js";

Devvit.addSettings([
    {
        type: 'string',
        name: 'GOOGLE_VISION_KEY',
        label: 'Google Vision API Key',
        isSecret: true,
        scope: SettingScope.App,
    },
    // TODO allow subreddit-specific API keys
    // {
    //     type: 'string',
    //     name: 'SUBREDDIT_API_KEY',
    //     label: 'Subreddit-specific Google Vision API Key',
    //     helpText: "Leave blank to use the master API key (rate limits will apply).",
    //     scope: SettingScope.Installation,
    //     onValidate: async ({value}) => {await validateApiKey(value)}
    // },
    {
        type: 'group',
        label: 'Notification Settings',
        helpText: "Set the default behavior for every submission.",
        fields: [
            {
                type: "select",
                name: "LEAVE_COMMENT",
                label: "Leave a comment",
                helpText: "When should the bot leave a comment on the submission?",
                defaultValue: ["never"],
                options: [
                    {
                        label: "Never",
                        value: "never"
                    },
                    {
                        label: "Always",
                        value: "always"
                    },
                    {
                        label: "Only on matches",
                        value: "matches"
                    }
                ]
            },
            {
                type: "boolean",
                name: "DISTINGUISH",
                label: "Distinguish comment",
                defaultValue: true,
                helpText: "If comments are enabled, should the bot add the mod label to its comment?",
            },
            {
                type: "boolean",
                name: "STICKY",
                label: "Sticky comment",
                defaultValue: true,
                helpText: "If comments are enabled, should the bot sticky its comment to the top of the thread?",
            },
            {
                type: "boolean",
                name: "MOD_MAIL",
                label: "Send mod mail",
                defaultValue: true,
                helpText: "Should the bot send a mod mail notification when a positive match is found?",
            },
            {
                type: "boolean",
                name: "REPORT",
                label: "Report submission",
                defaultValue: false,
                helpText: "Should the bot add an entry to the mod queue when a positive match is found?",
            },
            {
                type: "boolean",
                name: "REMOVE",
                label: "Remove submission",
                defaultValue: false,
                helpText: "Should the bot remove the submission when a positive match is found? Note: enable both Report and Remove to mimic the automod's \"filter\" action.",
            }
        ]
    }
])

Devvit.addTrigger({
    event: "PostCreate",
    onEvent: async (event, context) =>
    {
        const post = event.post;
        const author = event.author;

        if (post === undefined)
        {
            log("ERROR", "Unable to get post data", "N/A");
            return;
        }

        if (author === undefined)
        {
            log("ERROR", "Unable to get author data", post.permalink);
            return;
        }

        let userImgUrls: string[] | [] = [];
        const authorName: string = author.name;
        log("LOG", "Processing new post", post.permalink);

        if (post.isImage)
        {
            userImgUrls = getImgUrl(post);
        }
        else if (post.isGallery)
        {
            userImgUrls = getGalleryUrls(post);
        }
        else
        {
            log("LOG", "Text post, exiting", post.permalink);
            return;
        }

        if (userImgUrls.length <= 0)
        {
            log("ERROR", "Image post has no images", post.permalink);
            return;
        }

        const apiKey = await context.settings.get('GOOGLE_VISION_KEY');
        if (!apiKey)
        {
            log("ERROR", "API Key not set", post.permalink);
            return;
        }

        if (typeof apiKey !== 'string')
        {
            log("ERROR", "Invalid API Key", post.permalink);
            return;
        }

        const opMatches = await reverseImageSearch(apiKey, userImgUrls);
        await findMatchingUsernames(context, authorName, opMatches);
        const totalMatchCount = getTotalMatchCount(opMatches);
        const maxScore = getMaxScore(opMatches);

        await comment(
            userImgUrls.length,
            totalMatchCount,
            opMatches,
            maxScore,
            context,
            post.id
        );

        await sendModMail(
            context,
            authorName,
            post.title,
            post.permalink,
            totalMatchCount,
            maxScore
        );

        await reportPost(context, post.id, totalMatchCount);
        await removePost(context, post.id, totalMatchCount);

        log("LOG", `Confidence Score: ${maxScore}`, post.permalink);
        log("LOG", `Total Matches: ${totalMatchCount}`, post.permalink);

        if (maxScore <= 0)
        {
            log("LOG", "Post appears to be OC", post.permalink);
        }
        else
        {
            log("LOG", "Potential stolen content", post.permalink);
        }
    }
});

export default Devvit;
