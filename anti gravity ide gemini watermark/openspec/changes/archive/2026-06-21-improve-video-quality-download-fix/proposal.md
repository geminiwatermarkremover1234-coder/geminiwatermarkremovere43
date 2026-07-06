## Why

The current client-side video processing engine exhibits minor visual compression artifacts, and the "Download MP4" action fails to download properly or save with the correct `.mp4` file format/extension in some browser environments due to secure sandboxing. Additionally, watermark boundary subtraction can leave slight edge residue that needs improved smoothing.

## What Changes

- Increase the video encoder output bitrate parameters and configure quality-centric latency modes in the WebCodecs encoder to ensure high-fidelity quality preservation.
- Enhance the download link trigger mechanism to append the temporary anchor element to the document body, ensuring proper file extension and format recognition during download.
- Improve watermark boundary edge-smoothing logic by optimizing mask dilation, blending strength, and enabling it for all watermark templates to eliminate leftovers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `video-watermark-remover`: Refine video encoder bitrate calculations, configure encoding options for maximum quality, and enhance edge-smoothing unblending parameters.
- `watermark-remover-ui`: Adjust the download trigger logic to comply with browser DOM standards for secure downloads.

## Impact

- `processor.js`: Update WebCodecs `VideoEncoder` config to use a higher target/minimum bitrate and `latencyMode: "quality"`. Refine `edgeCleanup` parameters and conditions.
- `app.js`: Modify `triggerDownload` function to append/remove the download anchor element to/from the DOM.
