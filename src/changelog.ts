export const APP_CHANGELOG: Record<string, string[]> =
{
    "1.3.0": [
        "Add a setting to send mod mail notifications when a new version of Picture Police is published",
        "Add a setting to exclude mods from all Picture Police scans",
        "Reduce false positives on partial matches when only direct Reddit image links are found",
        "Change all external (non-Reddit) website links to direct-image links",
        "Fix bug preventing action summaries from being sent",
        "Change OP whitelist mod menu item to a toggle and add app name to label"
    ],
    "1.3.1": [
        "Change confidence threshold default setting to 51",
        "Remove query strings from direct image URLs",
        "Support Reddit Gallery (\"redditery.com\") URLs for matching images",
        "Change destination on comment feedback links to send to mod mail",
        "Compare external URLs to author's social links on their Reddit profile",
        "Add API usage stats to action summaries",
    ],
};