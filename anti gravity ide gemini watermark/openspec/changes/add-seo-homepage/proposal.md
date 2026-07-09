# Proposal: add-seo-homepage

## Why

The homepage has strong UI but thin, unstructured copy — search engines have little text to rank for the queries people actually type ("Gemini watermark remover", "Veo 3 watermark remover", "AI watermark remover free"). Adding 600–1000 words of original, naturally-written homepage content targets that demand without changing app functionality.

## What Changes

- Rewrite/extend homepage copy in `index.html` to 600–1000 words of original SEO content: hero, "what it is", image + video coverage, Veo 3 / Omni sections, how-it-works, privacy/local-processing angle, expanded FAQ.
- Weave in primary keywords (*Gemini watermark remover*, *Gemini AI watermark remover*, *remove Gemini watermark*, *Gemini watermark remover free*) and supporting keywords (*Veo 3 watermark remover*, *Google Veo watermark remover*, *Omni watermark remover*, *AI image watermark remover*, *AI video watermark remover*, *watermark remover online*, *free AI watermark remover*, *remove AI image watermark*, *remove AI video watermark*) naturally — each keyword at most 1–2 uses in body copy, no stuffing.
- Tune `<title>` + meta description around the primary keyword; single H1; keyword-bearing H2/H3 hierarchy.
- Add JSON-LD structured data: `SoftwareApplication` + `FAQPage`.
- No functional/JS changes; content and markup only.

## Capabilities

### New Capabilities
- `seo-homepage`: Homepage SEO content — word count, keyword coverage, heading structure, metadata, structured data, and no-stuffing rules.

### Modified Capabilities
<!-- none -->

## Impact

- **Modified files**: `anti gravity ide gemini watermark/index.html` only (copy, headings, meta, JSON-LD).
- **No new dependencies**, no JS/CSS behavior changes, no backend involvement.
- **Risk**: near-zero — text/markup change; existing anchors/ids must stay intact so nav links keep working.
