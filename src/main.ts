import {Devvit, SettingScope} from "@devvit/public-api";
import {reverseImageSearch, findMatchingUsernames} from "./scan.js";
import {
    SCAN_KEY,
    POTENTIAL_MATCH_KEY,
    PROBABLE_MATCH_KEY,
    MIN_CONF,
    comment,
    getTotalMatchCount,
    getMaxScore,
    sendModMail,
    reportPost,
    removePost,
    sendActionSummary,
    log
} from "./utils.js";

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
                type: "number",
                name: "CONFIDENCE_THRESHOLD",
                label: "Confidence threshold",
                helpText: "A confidence score BELOW this number will not trigger any mod notifications or mod actions. Comments (if enabled) will still be made.",
                defaultValue: 50
            },
            {
                type: "boolean",
                name: "MOD_MAIL",
                label: "Send mod mail",
                defaultValue: true,
                helpText: "Should the bot send a mod mail notification when a positive match is found?",
            },
            {
                type: "number",
                name: "NUM_URLS",
                label: "Max matches",
                defaultValue: 1,
                helpText: "The maximum number of URLs of matching images to list in mod mail notifications (max of 20).",
                onValidate: async ({value}) =>
                {
                    if (!value || (value < 1 || value > 20))
                    {
                        return "Value must be between 1 and 20 (inclusive).";
                    }
                }
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
    },
    {
        type: 'group',
        label: 'Action Summary Settings',
        helpText: "Enable daily, weekly, or monthly action summaries.",
        fields: [
            {
                type: "boolean",
                name: "ACTION_SUMMARY_ENABLE",
                label: "Enable action summaries",
                defaultValue: false,
                helpText: "Receive a mod mail notification with the number of posts containing stolen images.",
            },
            {
                type: "select",
                name: "ACTION_SUMMARY_FREQUENCY",
                label: "Frequency of action summary notifications",
                helpText: "Choose how frequent you want to receive these notifications.",
                defaultValue: ["daily"],
                options: [
                    {
                        label: "Daily",
                        value: "daily"
                    },
                    {
                        label: "Weekly",
                        value: "weekly"
                    },
                    {
                        label: "Monthly",
                        value: "monthly"
                    }
                ],
                onValidate: async ({value}) =>
                {
                    if (!value || value.length === 0)
                    {
                        return "You must select either \"daily\", \"weekly\", or \"monthly\".";
                    }
                }
            }
        ]
    }
]);

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

        log("LOG", "Processing new post", post.permalink);

        if (author === undefined)
        {
            log("ERROR", "Unable to get author data", post.permalink);
            return;
        }

        let userImgUrls: string[] | [] = [];
        const authorName: string = author.name;
        const userIsWhitelisted = await context.redis.get(authorName);

        if (userIsWhitelisted === "true")
        {
            log("INFO", "User is whitelisted, exiting", post.permalink);
            return;
        }

        if (post.isImage)
        {
            userImgUrls = [post.url];
        }
        else if (post.isGallery)
        {
            userImgUrls = post.galleryImages;
        }
        else if (post.isMultiMedia)
        {
            log("INFO", "Multi-media post detected, exiting", post.permalink);
            return;
        }
        else if (post.isVideo)
        {
            log("INFO", "Video post detected, exiting", post.permalink);
            return;
        }
        else if (post.isSelf)
        {
            log("INFO", "Self post detected, exiting", post.permalink);
            return;
        }
        else
        {
            log("INFO", "Non-image post, exiting", post.permalink);
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

        const opMatches = await reverseImageSearch(
            apiKey,
            userImgUrls,
            authorName
        );

        await findMatchingUsernames(context, authorName, opMatches);
        const totalMatchCount = getTotalMatchCount(opMatches);
        const maxScore = getMaxScore(opMatches);

        await comment(
            userImgUrls.length,
            totalMatchCount,
            opMatches,
            maxScore,
            context,
            post.id,
            authorName
        );

        await sendModMail(
            context,
            authorName,
            post.title,
            post.permalink,
            totalMatchCount,
            opMatches,
            maxScore,
            userImgUrls.length
        );

        await reportPost(context, post.id, totalMatchCount, maxScore);
        await removePost(context, post.id, totalMatchCount, maxScore);

        log("LOG", `Confidence Score: ${maxScore}`, post.permalink);
        log("LOG", `Total Matches: ${totalMatchCount}`, post.permalink);

        if (maxScore <= 0)
        {
            log("LOG", "Post appears to be OC", post.permalink, "GREEN");
        }
        else
        {
            log("LOG", "Potential stolen content", post.permalink, "YELLOW");
            if (maxScore < MIN_CONF)
            {   // 1%–49% confidence score
                await context.redis.incrBy(POTENTIAL_MATCH_KEY, 1);
            }
            else
            {   // 50%–100% confidence score
                await context.redis.incrBy(PROBABLE_MATCH_KEY, 1);
            }
        }

        await context.redis.incrBy(SCAN_KEY, 1);
    }
});

Devvit.addMenuItem({
    location: "post",
    label: "Add OP to Whitelist",
    description: "Picture Police",
    forUserType: "moderator",
    onPress: async (event, context) =>
    {
        const post = await context.reddit.getPostById(event.targetId);
        const author = await post.getAuthor();
        if (!author) return;

        const key = author.username;
        const isWhitelisted = await context.redis.get(key);

        if (isWhitelisted === "true")
        {
            context.ui.showToast(`u/${key} is already whitelisted.`);
            return;
        }

        await context.redis.set(key, "true");
        const value = await context.redis.get(key);
        if (!value)
        {
            context.ui.showToast(`u/${key} failed to whitelist.`);
            log("ERROR", `Failed to whitelist u/${key}`, post.permalink);
            return;
        }

        context.ui.showToast(`u/${key} added to whitelist.`);
    }
});

Devvit.addMenuItem({
    location: "post",
    label: "Remove OP from Whitelist",
    description: "Picture Police",
    forUserType: "moderator",
    onPress: async (event, context) =>
    {
        const post = await context.reddit.getPostById(event.targetId);
        const author = await post.getAuthor();
        if (!author) return;
        const key = author.username;
        await context.redis.del(key);
        context.ui.showToast(`u/${key} removed from whitelist.`);
    }
});

Devvit.addTrigger({
    events: ['AppInstall', 'AppUpgrade'],
    onEvent: async (_, context) =>
    {
        // clear out all the jobs first to ensure there is only ever this one
        const jobs = await context.scheduler.listJobs();
        await Promise.all(jobs.map(job => context.scheduler.cancelJob(job.id)));

        await context.scheduler.runJob({
            name: 'daily_action_summary',
            cron: '0 0 * * *',
        });
    },
});

Devvit.addSchedulerJob({
    name: 'daily_action_summary',
    onRun: async (_, context) =>
    {
        const settings = await context.settings.getAll();
        const enable = settings["ACTION_SUMMARY_ENABLE"];
        const freq = settings["ACTION_SUMMARY_FREQUENCY"];

        if (!enable) return;

        const now = new Date();
        const dayOfWeek = now.getUTCDay();
        const dayOfMonth = now.getUTCDate();

        let runNow = false;

        if (freq === 'daily')
        {
            runNow = true;
        }
        else if (freq === 'weekly' && dayOfWeek === 1)
        {
            runNow = true;
        }
        else if (freq === 'monthly' && dayOfMonth === 1)
        {
            runNow = true;
        }

        if (runNow && typeof freq === "string")
        {
            await sendActionSummary(context, freq);
        }
    },
});

export default Devvit;