# 🔒 Privacy Policy for Picture Police

**Last Updated:** January 9, 2026

### 1. Overview
The **Picture Police** app is committed to transparency regarding how data is handled. This app is built on the Reddit Devvit platform and utilizes the Google Cloud Vision API.

### 2. Data Collection and Processing
* **Images:** When a user submits an image or gallery to a subreddit where this app is installed, the image URL is sent to the Google Cloud Vision API for visual analysis. 
* **Reddit Data:** The app accesses public Reddit data (usernames, post IDs, and permalinks) to perform cross-referencing and moderation tasks.
* **No Personal Identity Scrapping:** We do not collect or store email addresses, real names, or IP addresses of Reddit users.

### 3. Third-Party Service Providers
This app uses the **Google Cloud Vision API**. By using this app, you acknowledge that content will be processed by Google. You can view [Google’s Privacy Policy here](https://policies.google.com/privacy). 
* *Note:* We only transmit the image URL to Google; we do not share the Reddit author's username or other metadata with their API.

### 4. Data Retention
* **App Logs:** Runtime logs are used for debugging and performance monitoring. These logs contain post permalinks and matching scores but are not shared with third parties or used for advertising.
* **No Image Database:** We do not maintain a permanent external database of the images scanned by the app.

### 5. Security
The app uses Devvit’s secure `isSecret` configuration to handle API credentials. This ensures that the Google Vision API key is encrypted and never exposed in the source code or logs.

### 6. Changes to This Policy
We may update this Privacy Policy from time to time. Changes will be reflected by the "Last Updated" date at the top of this document.

### 7. Contact Us
If you have questions about how your data is handled, please reach out via Reddit to **u/picture-police**.