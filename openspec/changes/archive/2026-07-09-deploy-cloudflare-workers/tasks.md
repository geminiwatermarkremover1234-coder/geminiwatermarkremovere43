## 1. Setup & Configuration

- [x] 1.1 Create `wrangler.toml` file in the root directory configured for static assets `./dist`
- [x] 1.2 Install `wrangler` CLI as a dev dependency in `package.json`
- [x] 1.3 Add build and deploy scripts to `package.json` scripts

## 2. Verification & Deployment

- [x] 2.1 Run local build (`npm run build`) to ensure static files are generated in `./dist`
- [x] 2.2 Trigger deployment using `npx wrangler deploy` to publish the website to Cloudflare Workers

## 3. GitHub Actions CI/CD Integration

- [x] 3.1 Create `.github/workflows/deploy.yml` workflow file to automate builds and deployments
- [x] 3.2 Add instructions for configuring GitHub Repository Secrets (`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`)
