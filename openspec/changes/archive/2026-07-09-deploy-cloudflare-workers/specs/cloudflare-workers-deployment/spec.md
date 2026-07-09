## ADDED Requirements

### Requirement: Cloudflare Workers Static Assets Configuration
The system SHALL have a `wrangler.toml` file in the root directory that defines the worker deployment, pointing to `./dist` for serving static assets.

#### Scenario: Wrangler reads wrangler.toml
- **WHEN** the wrangler CLI reads `wrangler.toml` during a build or deploy action
- **THEN** it SHALL resolve the static assets directory to `./dist` and the worker name to `anti-gravity-astro`.

### Requirement: Automated Build and Deploy Commands
The `package.json` scripts SHALL support building and deploying the website.

#### Scenario: Running deployment script
- **WHEN** the user executes `npm run deploy`
- **THEN** the system SHALL build the static site into `./dist` and invoke Wrangler to upload the built files to Cloudflare Workers.
