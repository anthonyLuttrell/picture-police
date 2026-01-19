# 🚨 Picture Police 🚨

**Picture Police** is a powerful Reddit automation tool built on the Devvit platform. It uses the **Google Cloud Vision API** to perform reverse image searches on new submissions, helping moderators automatically detect stolen content and verify "Original Content" (OC) claims.

---

> [!IMPORTANT]
> 
> This tool will always be **free** for you to use. However, it currently uses 
> my personal Google Cloud Vision API key for all requests. The first 1,000 
> requests per month are free. Every block of 1,000 requests thereafter costs 
> \$3.50 USD. For example, 5,000 requests in one month will cost \$14.00. 
> Because of this, rate limits may apply in the future, if the monthly cost 
> becomes unreasonable.
> 
> Please consider [donating](https://www.paypal.com/donate/?hosted_button_id=ML5CBAPTWNR5A) to cover API costs. Any rate limits applied 
> will be adjusted upon donation. Be sure to mention your subreddit's name if
> you choose to donate.
> 
> As of v1.1.8, there are no active rate limits for any installations.

---

## Key Features

* **Automatic Actions:** Unlike other similar tools, no mod interaction is required. Automatically scans every single post, only acts on images, and will take automatic actions based on your settings.
* **Google Cloud Vision integration:** Uses Google's Cloud Vision "Web Detection" API to perform thorough reverse image searches.
* **Intelligent Username Verification:** Cross-references found matches with the current author. If the same user posted the image elsewhere on Reddit, it is recognized as a cross-post rather than a theft.
* **Confidence Scoring:** Provides a percentage-based confidence score for every match to help moderators make informed decisions.
* **Configurable Actions:** Configurable to comment, report, remove, or modmail when stolen content is detected.
* **Public/Private Feedback:** Can leave a stickied comment on posts to inform the community of the image's status.

---

## Who is this for?

* **Moderators** who want automatic detection and handling of stolen content. 
* **Subreddits** where users are expected to submit original content only.
* **Anyone** who wants to help protect their community from the spread of stolen content.

---

## Installation & Setup

Once the app is installed on your subreddit, navigate to your **Mod Tools > Apps > Picture Police** and configure the following:

| Setting                | Description                                                    | Default | Recommended       |
|:-----------------------|:---------------------------------------------------------------|:--------|-------------------|
| **Enable Logs**        | Enable "Read logs and install history" to allow log access.    | Off     | On                |
| **Leave a Comment**    | Choose to comment: `Never`, `Always`, or `Only on matches`.    | `Never` | `Only on matches` |
| **Distinguish/Sticky** | Automatically labels and pins the bot's comment.               | On      | On                |
| **Send Mod Mail**      | Notifies the mod team when a positive match is found.          | On      | On                |
| **Report Submission**  | Flags the post for manual review in the mod queue.             | Off     | Off               |
| **Remove Submission**  | Automatically removes posts found to be stolen content.        | Off     | Off               |

---

## How it Works

1.  **Trigger:** The bot activates the moment a user submits an image or gallery post.
2.  **Web Detection:** It sends the image URLs to Google Cloud Vision to find visually identical or "partially matching" (cropped/edited) images on the web.
3.  **Filtering:** The bot filters out matches from the same author to prevent punishing legitimate cross-posting.
4.  **Confidence Calculation:**
    * **Full Match:** Identical image found.
    * **Partial Match:** Significant features match, but pixels differ (lower confidence).
5.  **Execution:** Based on your settings, the bot performs the designated moderation actions and logs the result.

---

## Technical Details

* **Language:** TypeScript
* **Platform:** Devvit (Reddit Developer Platform)
* **Open Source:** The project is [open-source](https://github.com/anthonyLuttrell/picture-police.git), licensed under the Apache 2.0 License. Contributions are welcome!

## Coming Soon

* **Custom Google Cloud Vision API Key:** Allow moderators to provide their own API key.
* **Keyword Hooks:** Allow moderators to specify keywords ("OC", "I Ate", "I Made", etc.) that must appear in the title or body to activate the bot.
* **Social Link Comparison:** Compare the author's social links on their profile to those found on any external matches to better eliminate false-positives.



---

## Changelog

### Version 1.1.8
* Add example URLs to mod mail notifications
* Include direct Reddit image links when finding a matching image
* Lower confidence score if a matching post has "[deleted]" for the author name
* Add the post ID or permalink to the feedback URL

### Version 1.1.7
* Fix an issue where no image URLs were detected in an image/gallery post
* Add optional background color to log function
* Remove hyphens and underscores from Reddit usernames when checking a URL for a username
* Update Devvit version to 0.12.8
* Add a percentage symbol to the mod mail confidence score
* Remove the "u/" from the feedback hyperlink

### Version 1.1.6
* Skip matches where OP's username appears in the URL
* Improve comment clarity when less than 50% confident of a match
* Better handle Facebook group URLs
* OC comment strings now include the author's name
* Prevent a post from being removed if the max confidence score is not above 50%
* Change log message for non-image posts

### Version 1.1.5
* Correct the "to" field in the feedback hyperlink
* Add the feedback hyperlink to mod mail notifications
* Update README to include details about enabling logs
* Update README to add a column for "Recommended" settings

### Version 1.1.3
* Sync changelog with uploaded version

### Version 1.1.1
* Fix an issue where text posts are not detected correctly
* Update README

### Version 1.1.0
* Update README with more accurate descriptions
* Update log message and function documentation
* Remove the external link disclaimer if not an external match
* Remove the delay function
* Remove console.error output for the error object to avoid leaking API… 
* Comment out unused Interface
* Migrate from .yaml to .json config

### Version 1.0.0
* Initial release.
