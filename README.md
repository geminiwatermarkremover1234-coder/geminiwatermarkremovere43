# Lumina AI - Video Watermark Remover

A fully client-side browser application to remove visible watermark logos from Gemini Omni/Veo/Flow videos using WebCodecs and pixel-level unblending.

🔗 **Live Website:** [https://anti-gravity-astro.geminiwatermarkremover1234.workers.dev](https://anti-gravity-astro.geminiwatermarkremover1234.workers.dev)

## 🚀 Key Features

- **100% Local Processing**: All video frame unblending, canvas operations, and re-encoding run fully in your browser (no server uploads).
- **Astro & Tailwind Styling**: Premium, responsive dashboard built with Astro and Tailwind CSS.
- **WebCodecs Support**: Ultra-fast frame rendering and processing inside Chrome and Edge browsers.

## 🧞 Commands

All commands are run from the root of the project:

| Command | Action |
| :--- | :--- |
| `npm install` | Installs dependencies |
| `npm run dev` | Starts local dev server |
| `npm run build` | Builds the static website to `./dist/` |
| `npm run deploy` | Deploys the static website manually to Cloudflare Workers |

## 📦 CI/CD Deployment

This repository is integrated with **GitHub Actions**. Any pushes to the `main` branch will automatically trigger:
1. Build compilation (`npm run build`)
2. Deployment to Cloudflare Workers (`npx wrangler deploy`)
