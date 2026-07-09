# Specification: SynthID Watermark Remover

## Purpose

To design and implement a premium, fully client-side SynthID Watermark Remover web page (`remove-synthid.html`) that allows users to upload AI-generated images, scans them for hidden frequency-domain signals, disrupts the SynthID watermarks, and optionally unblends visible watermarks in the corner using an advanced mathematical unblending algorithm. The page will be styled to match the existing premium design system of Lumina AI and linked in the headers of `index.html` and `veo.html`.

## Requirements

### Requirement: Header Navigation Integration
The existing website navigation headers and mobile menu sidebars inside `index.html` and `veo.html` SHALL be updated to include a link to the new "SynthID Remover" page, without modifying or breaking any of the existing code or functionality.

#### Scenario: User navigates between pages
- **WHEN** the user clicks "SynthID Remover" in the header of `index.html` or `veo.html`
- **THEN** the browser SHALL navigate to `remove-synthid.html`.
- **WHEN** the user is on the SynthID Remover page and clicks "Lumina AI" or "Video Remover" or "Veo Remover"
- **THEN** the browser SHALL navigate back to the appropriate pages.

---

### Requirement: Premium SynthID Remover Page Layout
The page `remove-synthid.html` SHALL be a standalone page styled with the existing Lumina AI dark theme, using glassmorphic panels, animated floating gradient orbs, and Outif/Inter typography. It SHALL feature a drag-and-drop file ingestion zone, a details pane, interactive controls, and detailed explanations of SynthID.

#### Scenario: Page is loaded
- **WHEN** `remove-synthid.html` is loaded in the browser
- **THEN** the system SHALL display the animated hero section, a file drop zone labeled "Drop a Gemini or Veo file to scan", details on supported formats (PNG, JPG, WebP), and an accordion containing SynthID information and limitations.

---

### Requirement: Drag and Drop Image Ingestion
The page SHALL accept images in PNG, JPEG/JPG, and WebP format via drag-and-drop or file browser. It SHALL inspect the image and load it onto a high-fidelity canvas workspace.

#### Scenario: User drops a valid image file
- **WHEN** the user drags and drops a PNG/JPG/WebP file onto the drop zone
- **THEN** the system SHALL load the image, display its metadata (dimensions, filename, file size), render the image inside the workspace, and enable the "Remove SynthID Watermark" button.

---

### Requirement: Pixel-Level Unblending & Frequency Perturbation Engine
The watermark removal engine SHALL implement a dual disruption approach:
1. **Auto SynthID Frequency Disruption**: Applies a high-frequency grid-pattern perturbation (+/- 1 LSB adjustment) and a sub-pixel resampling step (scaling slightly to shift watermark spatial mapping) to scramble the invisible SynthID watermark.
2. **Corner Logo Pixel unblending**: Detects and lifts visible grayscale/white watermark corner logos (e.g. the Gemini star) from the image. When performing unblending, the algorithm MUST adhere to these mathematical and structural invariants:
   - **Perfect Unblending Color**: Always use `255` as the template color in both the scoring and unblending formulas.
   - **Dynamic Smoothing Map**: Apply a dynamic strength map where:
     - Underflow pixels (restored value < 0) get a strength of `1.0` (full neighbor replacement).
     - High-alpha template pixels scale their smoothing strength up proportionally to alpha to suppress amplified compression noise.
     - Outer dilated boundary pixels get a reduced strength (e.g., `70%` of base) for soft blending.
   - **Padded Box Boundary-Safe Gathering**: Ensure neighbor-averaging loops gather neighbors outside the padded bounding box when near the boundaries, provided they are valid non-mask pixels inside the image canvas.

#### Scenario: User clicks "Remove SynthID Watermark"
- **WHEN** the user clicks the "Remove SynthID Watermark" button and the agreement checkbox is checked
- **THEN** the system SHALL show a visual scanning animation (a laser scan line moving down the image) and update progress steps:
  1. "Scanning frequency domain..."
  2. "Analyzing pixel structures..."
  3. "Running pixel-level unblending..."
  4. "Applying frequency-domain perturbation..."
  5. "Controlled resampling & stabilization..."
- **THEN** the system SHALL apply the frequency-domain scrambling and corner logo unblending, update the preview canvas, and display the "Download Cleaned Image" button.

---

### Requirement: Interactive Before/After Comparison Slider
The page SHALL feature an interactive side-by-side or sliding overlay comparison widget once the image is processed, allowing the user to slide a separator handle horizontally to compare the original and processed images pixel-by-pixel.

#### Scenario: Image processing completes
- **WHEN** the image is successfully processed
- **THEN** the workspace SHALL switch to a comparison viewer with a split-screen slider where the user can drag a divider handle left and right to compare the original image on the left and the processed image on the right.
