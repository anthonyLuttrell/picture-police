import {Devvit, SettingScope} from "@devvit/public-api";
import {comment, getGalleryUrls, getImgUrl} from "./utils.js";
import {reverseImageSearch, findMatchingUsernames} from "./scan.js";
import {validateApiKey, validateComment} from "./validation.js";

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
    {
        type: 'string',
        name: 'SUBREDDIT_API_KEY',
        label: 'Subreddit-specific Google Vision API Key',
        helpText: "Leave blank to use the master API key (rate limits will apply).",
        scope: SettingScope.Installation,
        onValidate: async ({value}) => {await validateApiKey(value)}
    },
    {
        type: 'group',
        label: 'Notification Settings',
        helpText: "Set the default behavior for every submission.",
        fields: [
            {
                type: "select",
                name: "LEAVE_COMMENT",
                label: "Leave a comment",
                helpText: "Should the bot leave a comment on every single post, or only when it finds a match?",
                options: [
                    {
                        label: "Always",
                        value: "always"
                    },
                    {
                        label: "Only on matches",
                        value: "matches"
                    }
                ],
                defaultValue: ["matches"],
                onValidate: async ({value}, context) => {await validateComment(value, context)}
            },
            {
                type: "boolean",
                name: "DISTINGUISH",
                label: "Distinguish comment",
                defaultValue: true,
                helpText: "Comments must be enabled first.",
                onValidate: async ({value}, context) => {await validateComment(value, context)}
            },
            {
                type: "boolean",
                name: "STICKY",
                label: "Sticky comment",
                defaultValue: true,
                helpText: "Comments must be enabled first.",
                onValidate: async ({value}, context) => {await validateComment(value, context)}
            },
            {
                type: "select",
                multiSelect: true,
                name: "MOD_NOTICE",
                label: "Method to notify the mods",
                options: [
                    {
                        label: "Modmail",
                        value: "mail"
                    },
                    {
                        label: "Report",
                        value: "report"
                    }
                ]
            },
            {
                type: "select",
                multiSelect: true,
                name: "ACTION",
                label: "Additional Action(s) to take on a positive match",
                options: [
                    {
                        label: "Remove post",
                        value: "remove"
                    },
                    {
                        label: "Ban user",
                        value: "ban"
                    }
                ]
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
