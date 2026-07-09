# Design: add-seo-homepage

## Context

`index.html` (1176 lines, "Lumina AI") already has the right skeleton: hero H1 (line ~428), best-practices H2 (~765), features (~908), toolkit (~935), 3-steps (~955), how-to (~984), FAQ (~1006). Copy is thin and keyword placement accidental. This change is copywriting + markup only — the sections stay, the words get rewritten and extended.

## Goals / Non-Goals

**Goals:** 600–1000 words of natural copy covering all target keywords; better title/meta; JSON-LD; keep every id/anchor and all JS behavior untouched.

**Non-Goals:** New pages (blog, tutorials), link building, sitemap/robots infra, image alt-text overhaul beyond the homepage, redesign of any section, performance work.

## Decisions

1. **Extend existing sections instead of adding a wall-of-text SEO block.** Google devalues detached "SEO paragraphs"; copy woven into real sections (hero, features, how-to, FAQ) reads naturally and converts. Alternative rejected: single 800-word `<article>` above the footer.

2. **Keyword → section map** (each phrase used once, twice max):
   - **H1 (hero)**: "Free Gemini Watermark Remover for Video & Images" + hero paragraph: *Gemini AI watermark remover*, *watermark remover online*, local/private angle.
   - **Title tag**: "Gemini Watermark Remover — Free, Private, In-Browser" (≤60 chars). Meta description: primary keyword + "free" + "no upload" (140–160 chars).
   - **Intro under hero (~120 words)**: *remove Gemini watermark*, *Gemini watermark remover free*, what the tool does in plain words.
   - **Image section (~100 words)**: *Gemini image watermark remover*, *remove Gemini AI image watermark*, *AI image watermark remover*, *remove AI image watermark*.
   - **Video section (~100 words)**: *Gemini video watermark remover*, *AI video watermark remover*, *remove AI video watermark*.
   - **Veo/Omni section (~120 words)**: *Veo 3 watermark remover*, *Google Veo watermark remover*, *Veo watermark remover free*, *remove Veo watermark*, *Omni watermark remover*, *remove Omni watermark* — one H2 "Works with Veo 3, Google Veo and Omni videos", each phrase in its own sentence.
   - **How-it-works (~120 words)**: *free AI watermark remover*, *AI watermark remover*, inverse alpha blending explained simply, privacy/local processing.
   - **FAQ (5–7 Q&As, ~250 words)**: long-tail questions ("Is there a free Gemini watermark remover?", "How do I remove the Veo 3 watermark?", "Is it legal…", "Does it upload my video?") — natural home for remaining phrases.

3. **JSON-LD**: one `<script type="application/ld+json">` with `SoftwareApplication` (name, applicationCategory: MultimediaApplication, offers price 0, operatingSystem: "Web browser") and one `FAQPage` mirroring visible FAQ. Static JSON, no build step.

4. **Ethics/positioning note in copy**: frame as removing the *visible corner logo* from *your own* generated videos; FAQ answer states SynthID/invisible watermarks are out of scope. Keeps claims accurate and reduces policy risk.

5. **Voice rules**: write for a creator, second person, short sentences; every keyword must survive the read-aloud test; never two keyword phrases in one sentence.

## Risks / Trade-offs

- [Keyword cannibalization — one page targeting image+video+Veo+Omni] → acceptable now; if rankings split later, spin Veo/image pages as separate landing pages.
- [Copy edits accidentally break app.js selectors] → touch only text nodes and add new static markup; run one conversion end-to-end after editing (spec: no functional regression).
- ["free" claims vs upcoming paid credit packs (add-security-payments)] → phrase as "free daily conversions"; pricing section already exists, keep claims consistent.

## Open Questions

- Brand name in H1: keep "Lumina AI" prefix or lead with keyword? Default: keyword-first, brand in title tag suffix.
- FAQ count: default 6 questions unless owner wants more.
