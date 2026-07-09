# Tasks: add-seo-homepage

## 1. Metadata

- [ ] 1.1 Rewrite `<title>` (≤60 chars, primary keyword first) and meta description (140–160 chars); drop the meta keywords tag (ignored by Google, reveals strategy)
- [ ] 1.2 Add JSON-LD `SoftwareApplication` + `FAQPage` script blocks to `<head>`

## 2. Body copy (follow keyword→section map in design.md)

- [ ] 2.1 Rewrite H1 + hero paragraph and add ~120-word intro block under hero
- [ ] 2.2 Write image-removal section (~100 words) and video-removal section (~100 words)
- [ ] 2.3 Add "Works with Veo 3, Google Veo and Omni" H2 section (~120 words)
- [ ] 2.4 Rewrite how-it-works copy (~120 words, plain-language inverse blending + privacy angle)
- [ ] 2.5 Expand FAQ to 6 Q&As (~250 words) including free/legal/upload/SynthID questions; keep FAQ markup pattern used by existing accordion JS

## 3. Verify

- [ ] 3.1 Word count 600–1000; every primary keyword present; no phrase >2 uses (grep count each phrase)
- [ ] 3.2 Exactly one H1; JSON-LD parses (paste into validator or `JSON.parse` check)
- [ ] 3.3 Full conversion end-to-end in browser — no console errors, nav anchors still scroll, FAQ accordion still opens
