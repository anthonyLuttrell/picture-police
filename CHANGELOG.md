## Changelog

### Version 1.2.1
* Fix an issue where the wrong Reddit URLs were being added to the match list.
* Add a new installation setting to set a minimum confidence score at which mod actions will be completed.
* Lower the confidence score by slightly more than half when only direct Reddit image links (previews) are found.
* Prevent thumbnails from being considered a match. These are often unreliable.

### Version 1.2.0
* Add a new mod option to add and remove a user from a whitelist. All submissions from a whitelisted user will be ignored.
* Add a new installation setting to allow mods to set the maximum number of source URLs to include in mod mail notifications. There is a hard cap of 20 matches per user-submitted image.
* Add a new installation setting to allow daily, weekly, or monthly action summaries, which includes the number of all image posts that were scanned, and the total number of potential stolen images found. 

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