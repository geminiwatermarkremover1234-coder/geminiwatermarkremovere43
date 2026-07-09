# How to Connect GitHub to Cloudflare Workers via GitHub Actions

This guide explains how to set up automatic deployment for the watermark remover site when pushing code to the `main` branch.

## Prerequisites
1. You must have a Cloudflare account.
2. The project must be hosted on a GitHub repository.

## Step 1: Create a Cloudflare API Token
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Click on **My Profile** (top-right user icon) -> **API Tokens**.
3. Click **Create Token**.
4. Find the **Edit Cloudflare Workers** template and click **Use template**.
5. Select your account from **Account Resources** (e.g., your email/ID).
6. Under **Zone Resources**, select **All zones** (or a specific domain zone).
7. Click **Continue to summary** and then **Create Token**.
8. Copy the generated API Token (keep this safe!).

## Step 2: Get your Cloudflare Account ID
1. Go to your Cloudflare Dashboard homepage.
2. Navigate to **Workers & Pages**.
3. Look at the right-side sidebar and copy your **Account ID**.

## Step 3: Configure GitHub Repository Secrets
1. Go to your repository page on GitHub.
2. Click on **Settings** -> **Secrets and variables** -> **Actions**.
3. Click **New repository secret**.
4. Name: `CLOUDFLARE_API_TOKEN`
   Value: *(cfut_r4C39lT0bJLXVenxvQe18cGm6YSsPHeV57A1DtcYb1dbfb)*
5. Click **Add secret**.
6. Click **New repository secret** again.
7. Name: `CLOUDFLARE_ACCOUNT_ID`
   Value: *(8e7e71e2e1e143bfce0eded38e3ffe70)*
8. Click **Add secret**.

Once these secrets are set up on GitHub, any push to the `main` branch will trigger the deployment workflow automatically!
