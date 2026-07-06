"""
Find the EXACT watermark position using correlation, then compare algorithms.
"""
import sys, os
import numpy as np

try:
    import cv2
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "opencv-python-headless", "-q"])
    import cv2

from PIL import Image
from scipy.ndimage import correlate

test_dir = os.path.dirname(os.path.abspath(__file__))

orig_video = os.path.join(test_dir, "test.mp4")
ref_video = os.path.join(test_dir, "clean from reference website.mp4")

def extract_frame(video_path, frame_idx=30):
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) if ret else None

# Load watermark template
wm_path = os.path.join(test_dir, "..", "watermarks", "bg_48.png")
wm_img = np.array(Image.open(wm_path).convert('L')).astype(np.float64) / 255.0
print(f"Template shape: {wm_img.shape}, max alpha: {wm_img.max():.3f}")
print(f"Pixels > 0.08: {(wm_img > 0.08).sum()}")

orig_f = extract_frame(orig_video, 30)
ref_f = extract_frame(ref_video, 30)
h, w = orig_f.shape[:2]

# Use Pearson correlation to find exact position
# The watermark makes pixels brighter (adds white overlay)
# So look for correlation between template alpha and pixel brightness
orig_gray = orig_f.mean(axis=2).astype(np.float64)
ref_gray = ref_f.mean(axis=2).astype(np.float64)

# The DIFFERENCE between orig and ref shows where the watermark was removed
diff = orig_gray - ref_gray  # positive where watermark was
print(f"\nDiff (orig-ref) stats: mean={diff.mean():.2f}, max={diff.max():.1f}, min={diff.min():.1f}")

# Find watermark by template matching on the diff image
th, tw = wm_img.shape

# Search bottom-right quadrant
search_region = diff[h//2:, w//2:]
best_val = -1
best_loc = (0, 0)

for y in range(search_region.shape[0] - th):
    for x in range(search_region.shape[1] - tw):
        patch = search_region[y:y+th, x:x+tw]
        # Correlation with template
        if wm_img.std() > 0 and patch.std() > 0:
            corr = np.corrcoef(patch.flatten(), wm_img.flatten())[0, 1]
            if corr > best_val:
                best_val = corr
                best_loc = (x + w//2, y + h//2)

print(f"\nBest correlation: {best_val:.4f} at ({best_loc[0]}, {best_loc[1]})")

# Also try template matching via cv2
result = cv2.matchTemplate(
    diff[h//2:, w//2:].astype(np.float32),
    wm_img.astype(np.float32),
    cv2.TM_CCOEFF_NORMED
)
min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
best_x = max_loc[0] + w//2
best_y = max_loc[1] + h//2
print(f"CV2 template match: corr={max_val:.4f} at ({best_x}, {best_y})")

# Use CV2 result as it's more reliable
wx, wy = best_x, best_y
print(f"\nExact watermark position: ({wx}, {wy})")

# Extract regions
orig_region = orig_f[wy:wy+th, wx:wx+tw].astype(np.float64)
ref_region = ref_f[wy:wy+th, wx:wx+tw].astype(np.float64)

# Now do the unblending
opacity = 1.0
overlay_value = 255.0
ceiling = 0.99

unblended = np.zeros_like(orig_region)
underflow_map = np.zeros((th, tw), dtype=bool)

for y in range(th):
    for x in range(tw):
        alpha = wm_img[y, x]
        p = min(alpha * 1.0 * opacity, ceiling)
        if p < 0.002:
            unblended[y, x] = orig_region[y, x]
            continue
        inv_p = 1 - p
        if inv_p <= 0.0001:
            unblended[y, x] = orig_region[y, x]
            continue
        
        has_uf = False
        for c in range(3):
            restored = (orig_region[y, x, c] - p * overlay_value) / inv_p
            if restored < 0:
                has_uf = True
            unblended[y, x, c] = np.clip(restored, 0, 255)
        
        if has_uf:
            underflow_map[y, x] = True

print(f"\n=== AT CORRECT POSITION ===")
print(f"Unblended mean: {unblended.mean():.2f}")
print(f"Ref mean: {ref_region.mean():.2f}")
print(f"Orig mean: {orig_region.mean():.2f}")
print(f"Diff unblended vs ref: {np.abs(unblended - ref_region).mean():.3f}")
print(f"Underflow pixels: {underflow_map.sum()} / {tw*th}")

# Show per-pixel comparison at high-alpha positions
print(f"\n=== HIGH-ALPHA PIXEL COMPARISON (alpha > 0.5) ===")
high_alpha = wm_img > 0.5
if high_alpha.sum() > 0:
    print(f"Count: {high_alpha.sum()}")
    print(f"Orig brightness (high-a): {orig_region[high_alpha].mean():.2f}")
    print(f"Unblended brightness:     {unblended[high_alpha].mean():.2f}")
    print(f"Ref brightness:           {ref_region[high_alpha].mean():.2f}")
    print(f"Diff (unblended-ref):     {(unblended[high_alpha] - ref_region[high_alpha]).mean():.2f}")

print(f"\n=== MEDIUM-ALPHA PIXELS (0.1 < alpha < 0.5) ===")
med_alpha = (wm_img > 0.1) & (wm_img <= 0.5)
if med_alpha.sum() > 0:
    print(f"Count: {med_alpha.sum()}")
    print(f"Orig brightness (med-a): {orig_region[med_alpha].mean():.2f}")
    print(f"Unblended brightness:    {unblended[med_alpha].mean():.2f}")
    print(f"Ref brightness:          {ref_region[med_alpha].mean():.2f}")
    print(f"Diff (unblended-ref):    {(unblended[med_alpha] - ref_region[med_alpha]).mean():.2f}")

# Laplacian comparison
wm_mask = wm_img > 0.08
gray_unblended = unblended.mean(axis=2)
gray_ref = ref_region.mean(axis=2)
gray_orig = orig_region.mean(axis=2)

lap_unblended = np.abs(cv2.Laplacian(gray_unblended, cv2.CV_64F))
lap_ref = np.abs(cv2.Laplacian(gray_ref, cv2.CV_64F))
lap_orig = np.abs(cv2.Laplacian(gray_orig, cv2.CV_64F))

print(f"\n=== TEXTURE QUALITY (Laplacian in WM zone) ===")
print(f"  Unblended (new): {lap_unblended[wm_mask].mean():.3f}")
print(f"  Ref:             {lap_ref[wm_mask].mean():.3f}")
print(f"  Original:        {lap_orig[wm_mask].mean():.3f}")

grad_unblended = np.sqrt(np.gradient(gray_unblended, axis=0)**2 + np.gradient(gray_unblended, axis=1)**2)
grad_ref = np.sqrt(np.gradient(gray_ref, axis=0)**2 + np.gradient(gray_ref, axis=1)**2)

print(f"\n=== GRADIENT MAGNITUDE ===")
print(f"  Unblended (new): {grad_unblended[wm_mask].mean():.3f}")
print(f"  Ref:             {grad_ref[wm_mask].mean():.3f}")

# Save visual comparison
fig_unblended = np.clip(unblended, 0, 255).astype(np.uint8)
fig_ref = ref_region.astype(np.uint8)
fig_orig = orig_region.astype(np.uint8)

# Side by side: orig | unblended | ref
comparison = np.hstack([fig_orig, fig_unblended, fig_ref])
Image.fromarray(comparison).save(os.path.join(test_dir, "correct_pos_comparison.png"))

# Save amplified diff between unblended and ref
diff_vis = (np.abs(unblended - ref_region) * 10).clip(0, 255).astype(np.uint8)
Image.fromarray(diff_vis).save(os.path.join(test_dir, "correct_pos_diff.png"))

print(f"\nSaved comparison images at correct position!")
