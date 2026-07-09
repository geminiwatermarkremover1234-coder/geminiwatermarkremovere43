# Spec: seo-homepage

## ADDED Requirements

### Requirement: Original SEO content volume
The homepage SHALL contain 600–1000 words of original, human-readable body copy (excluding nav, buttons, and footer boilerplate).

#### Scenario: Word count check
- **WHEN** visible homepage body text is extracted and counted
- **THEN** the total is between 600 and 1000 words and reads naturally aloud

### Requirement: Keyword coverage without stuffing
The copy SHALL include every primary keyword (*Gemini watermark remover*; *Gemini AI watermark remover*; *remove Gemini watermark*; *Gemini watermark remover free*) at least once, and each supporting keyword (*Veo 3 watermark remover*, *Google Veo watermark remover*, *Omni watermark remover*, *AI image watermark remover*, *AI video watermark remover*, *watermark remover online*, *free AI watermark remover*, *remove AI image watermark*, *remove AI video watermark*, etc.) at most twice. No keyword SHALL exceed ~1.5% density and no sentence SHALL chain keywords list-style.

#### Scenario: Primary keywords present
- **WHEN** the rendered text is searched case-insensitively
- **THEN** all four primary keyword phrases appear in grammatical sentences

#### Scenario: No stuffing
- **WHEN** any single keyword phrase is counted
- **THEN** it appears no more than twice in body copy and never twice in one paragraph

### Requirement: Heading hierarchy
The page SHALL have exactly one H1 containing the primary keyword, with H2/H3 subsections that carry supporting keywords naturally (image removal, video removal, Veo 3, how-to, privacy, FAQ).

#### Scenario: Single H1
- **WHEN** the DOM is queried for `h1`
- **THEN** exactly one exists and it contains "Gemini watermark remover" (any casing/inflection)

### Requirement: Metadata and structured data
The page SHALL have a `<title>` ≤ 60 chars and meta description 140–160 chars, each containing the primary keyword, plus valid JSON-LD for `SoftwareApplication` and `FAQPage` matching the visible FAQ.

#### Scenario: Structured data validates
- **WHEN** the JSON-LD blocks are parsed
- **THEN** both parse as valid JSON with required schema.org fields (`name`, `applicationCategory`, `offers` for the app; `mainEntity` Q/A pairs matching on-page FAQ)

### Requirement: No functional regression
Content changes SHALL NOT alter application behavior — all element ids used by `app.js` and nav anchors remain unchanged.

#### Scenario: App still works
- **WHEN** a video is converted after the content change
- **THEN** upload, processing, preview, and download work as before with no console errors
