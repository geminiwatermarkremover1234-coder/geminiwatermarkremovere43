# Adsterra Ads Configuration Guide

This guide explains how to configure your Adsterra ad keys on the Lumina AI watermark remover.

## Why do I need to do this?
The Adsterra API allows fetching domain details and numerical placement IDs (e.g. `30196361`). However, to render the actual ad script, Adsterra requires a **32-character hexadecimal hash** (e.g. `030513107fcec21d9592501debed4142`). 

The API does not expose these hashes for security reasons. Therefore, we have integrated the ad units with placeholder hash keys. You need to copy the hashes from your Adsterra dashboard and replace them in the codebase.

---

## Step 1: Copy hashes from Adsterra Publisher Dashboard
1. Log in to your [Adsterra Publisher Dashboard](https://publishers.adsterra.com/).
2. Click on the **Websites** tab on the left sidebar.
3. Find your approved website: `geminiomniwatermarkremover.com`.
4. Click on **All codes** or the down arrow to expand your placements.
5. Click **Get Code** next to each placement type, and copy the 32-character hexadecimal key (hash) from the script code.

Here is the mapping of your placements to their types:
- **NativeBanner_1** (ID `30196357`): Native banner code.
- **728x90_1** (ID `30196363`): Leaderboard Banner.
- **300x250_1** (ID `30196361`): Rectangle Banner.
- **160x600_1** (ID `30196362`): Sidebar Banner.
- **320x50_1** (ID `30196360`): Sticky Mobile Banner.
- **SocialBar_1** (ID `30196365`): Social Bar.
- **Smartlink_1** (ID `30196364`): *(Already configured with key: `030513107fcec21d9592501debed4142`)*.

---

## Step 2: Update configuration in JavaScript files
Open the following files in the project:
1. [public/app.js](file:///e:/anti%20gravit%202.0%20gemini%20remoev%20backup/public/app.js)
2. [public/veo-app.js](file:///e:/anti%20gravit%202.0%20gemini%20remoev%20backup/public/veo-app.js)

Locate the `ADSTERRA_CONFIG` object at the top of the file:

```javascript
const ADSTERRA_CONFIG = {
    enabled: true,
    domain: 'www.highperformanceformat.com', 
    smartlink: 'https://www.effectivecpmnetwork.com/s6dtym12bw?key=030513107fcec21d9592501debed4142',
    placements: {
        topBanner: 'YOUR_728x90_HASH',      // Replace with 728x90_1 hash
        belowUpload: 'YOUR_300x250_HASH',    // Replace with 300x250_1 hash
        belowResult: 'YOUR_300x250_HASH',    // Replace with 300x250_1 hash
        leftSidebar: 'YOUR_160x600_HASH',    // Replace with 160x600_1 hash
        rightSidebar: 'YOUR_160x600_HASH',   // Replace with 160x600_1 hash
        stickyMobile: 'YOUR_320x50_HASH',    // Replace with 320x50_1 hash
        socialBar: 'YOUR_SOCIAL_BAR_HASH'    // Replace with SocialBar_1 hash
    }
};
```

Replace the placeholder values (e.g. `'YOUR_728x90_HASH'`) with the 32-character hexadecimal hashes you copied.

---

## Step 3: Push changes to GitHub
Once updated, commit the changes and push them to GitHub. The GitHub Action will automatically build and deploy the updated site to Cloudflare Workers!
