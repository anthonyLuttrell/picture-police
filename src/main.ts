import {Devvit, SettingScope} from "@devvit/public-api";
import {comment, getGalleryUrls, getImgUrl} from "./utils.js";
import {reverseImageSearch, findMatchingUsernames} from "./scan.js";
import {validateApiKey} from "./validation.js";

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
                defaultValue: false,
                helpText: "Should the bot send a mod mail when a positive match is found?",
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

        let userImgUrls: string[] | [] = [];
        const authorName: string = author.name;
        console.log(`Processing new post "${post.title}" by u/${authorName}`);

        if (post.isImage)
        {
            userImgUrls = getImgUrl(post);
        }
        else if (post.isGallery)
        {
            userImgUrls = getGalleryUrls(post);
        }
        else
        {   // TODO check for www.imgur.com links in post body?
            console.debug("Unhandled post type.");
        }

        if (userImgUrls.length <= 0)
        {
            console.error("Unable to find any images in this post!");
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

        const opMatches = await reverseImageSearch(apiKey, userImgUrls);
        await findMatchingUsernames(context, authorName, opMatches);
        await comment(userImgUrls.length, opMatches, context, post.id);
    },
});

export default Devvit;
