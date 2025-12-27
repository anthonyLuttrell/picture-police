import {Devvit, SettingScope} from "@devvit/public-api";
import {comment, getGalleryUrls, getImgUrl} from "./utils.js";
import {reverseImageSearch, findMatchingUsernames} from "./scan.js";

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
