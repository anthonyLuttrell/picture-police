# 🚨 Picture Police 🚨

**Picture Police** is a powerful Reddit automation tool built on the Devvit platform. It uses the **Google Cloud Vision API** to perform reverse image searches on new submissions, helping moderators automatically detect stolen content and verify "Original Content" (OC) claims.

---

## Key Features

* **Multi-Format Support:** Automatically scans both single-image posts and Reddit Galleries.
* **Intelligent Username Verification:** Cross-references found matches with the current author. If the same user posted the image elsewhere on Reddit, it is recognized as a cross-post rather than a theft.
* **Confidence Scoring:** Provides a percentage-based confidence score for every match to help moderators make informed decisions.
* **Automated Actions:** Configurable to report, remove, or modmail when stolen content is detected.
* **Public/Private Feedback:** Can leave a stickied, distinguished comment on posts to inform the community of the image's status.

---

##  Installation & Setup

Once the app is installed on your subreddit, navigate to your **Mod Tools > Apps > Picture Police** and configure the following:

| Setting | Description |
| :--- | :--- |
| **Leave a Comment** | Choose to comment: `Never`, `Always`, or `Only on matches`. |
| **Distinguish/Sticky** | Automatically labels and pins the bot's comment. |
| **Send Mod Mail** | Notifies the mod team when a positive match is found. |
| **Report Submission** | Flags the post for manual review in the mod queue. |
| **Remove Submission** | Automatically removes posts found to be stolen content. |

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
* **Rate Limiting:** Includes a built-in 650ms delay between Reddit API calls to ensure stability.
* **Open Source:** The project is open-source, licensed under the MIT License. Contributions are welcome!

> [!IMPORTANT]
> This bot requires the `http` permission to communicate with `vision.googleapis.com` and the `redditAPI` permission to manage posts.

---

## 📜 Changelog

### Version 1.0.0
* Initial release.
