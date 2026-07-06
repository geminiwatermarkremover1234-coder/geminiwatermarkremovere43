"""
Test the updated watermark removal by processing test.mp4 through the browser 
and comparing output with reference. Uses a headless approach via Python to extract 
frames and simulate what the JS code does, matching the exact algorithm.
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
from scipy.ndimage import uniform_filter

test_dir = os.path.dirname(os.path.abspath(__file__))

# We can't run JS from Python, but we can verify the algorithm by implementing 
# the same logic and comparing. Let's check what the current browser output looks like
# by examining the crop of cleaned_test_browser.mp4 (which was the OLD algorithm).

# The key metrics we need to verify:
# 1. Laplacian energy in WM zone should be closer to reference (2.855) not our old value (0.796)
# 2. Gradient magnitude should be closer to reference (0.931) not our old value (0.377)

# Since we can't re-process through the browser right now, let's simulate the new 
# algorithm in Python to predict the improvement.

ours_video = os.path.join(test_dir, "cleaned_test_browser.mp4")
ref_video = os.path.join(test_dir, "clean from reference website.mp4")
orig_video = os.path.join(test_dir, "test.mp4")

def extract_frame(video_path, frame_idx=30):
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) if ret else None

# Load watermark template
wm_path = os.path.join(test_dir, "..", "watermarks", "bg_48.png")
wm_template = np.array(Image.open(wm_path).convert('L')).astype(np.float64) / 255.0

orig_f = extract_frame(orig_video, 30)
ref_f = extract_frame(ref_video, 30)
h, w = orig_f.shape[:2]

print(f"Video: {w}x{h}")
print(f"Template: {wm_template.shape}")

# Find watermark position by checking correlation at expected offsets
offsets = [144, 120, 128, 72]
best_score = -1
best_off = 120

for off in offsets:
    cx, cy = w - off, h - off
    x1, x2 = max(0, cx - 24), min(w, cx + 24)
    y1, y2 = max(0, cy - 24), min(h, cy + 24)
    
    # Check brightness difference
    crop = orig_f[y1:y2, x1:x2].astype(np.float64).mean(axis=2)
    ref_crop = ref_f[y1:y2, x1:x2].astype(np.float64).mean(axis=2)
    diff = np.abs(crop - ref_crop).mean()
    print(f"Offset {off}: diff from ref = {diff:.2f}")
    if diff > best_score:
        best_score = diff
        best_off = off

print(f"\nBest offset: {best_off} (diff={best_score:.2f})")

# Now simulate the NEW algorithm (underflow-only inpainting, no over-smoothing)
# vs OLD algorithm (full diffusion smoothing)

# Watermark position
tw, th = wm_template.shape[1], wm_template.shape[0]
wx = w - best_off - tw // 2
wy = h - best_off - th // 2

# Ensure bounds
wx = max(0, min(wx, w - tw))
wy = max(0, min(wy, h - th))

print(f"Watermark region: ({wx}, {wy}) to ({wx+tw}, {wy+th})")

# Extract watermark region from original
orig_region = orig_f[wy:wy+th, wx:wx+tw].astype(np.float64)
ref_region = ref_f[wy:wy+th, wx:wx+tw].astype(np.float64)

# Step 1: Alpha unblending (same for old and new)
opacity = 1.0
overlay_value = 255.0
unblended = np.zeros_like(orig_region)

for c in range(3):
    for y in range(th):
        for x in range(tw):
            alpha = wm_template[y, x]
            p = min(alpha * opacity, 0.99)
            if p < 0.002:
                unblended[y, x, c] = orig_region[y, x, c]
                continue
            inv_p = 1 - p
            if inv_p <= 0.0001:
                unblended[y, x, c] = orig_region[y, x, c]
                continue
            restored = (orig_region[y, x, c] - p * overlay_value) / inv_p
            unblended[y, x, c] = np.clip(restored, 0, 255)

print(f"\n=== UNBLENDING RESULTS ===")
print(f"Unblended mean: {unblended.mean():.2f}")
print(f"Ref mean: {ref_region.mean():.2f}")
print(f"Diff unblended vs ref: {np.abs(unblended - ref_region).mean():.3f}")

# Count underflow pixels
underflow_count = 0
for y in range(th):
    for x in range(tw):
        alpha = wm_template[y, x]
        p = min(alpha * opacity, 0.99)
        if p < 0.002:
            continue
        inv_p = 1 - p
        if inv_p <= 0.0001:
            continue
        for c in range(3):
            restored = (orig_region[y, x, c] - p * overlay_value) / inv_p
            if restored < 0:
                underflow_count += 1
                break

print(f"Underflow pixels: {underflow_count} / {tw*th}")

# The NEW algorithm: only smooth underflow pixels, preserve everything else
# vs OLD algorithm: smooth ALL watermark pixels with high strength

# Simulate NEW: just use the unblended values (since most pixels are correct)
new_result = unblended.copy()

# For underflow pixels only, replace with neighbor average
for y in range(th):
    for x in range(tw):
        alpha = wm_template[y, x]
        p = min(alpha * opacity, 0.99)
        if p < 0.002:
            continue
        inv_p = 1 - p
        if inv_p <= 0.0001:
            continue
        
        has_underflow = False
        for c in range(3):
            restored = (orig_region[y, x, c] - p * overlay_value) / inv_p
            if restored < 0:
                has_underflow = True
                break
        
        if has_underflow:
            # Replace with neighbor average
            count = 0
            avg = np.zeros(3)
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    if dy == 0 and dx == 0:
                        continue
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < th and 0 <= nx < tw:
                        # Use unblended value if neighbor is not underflow
                        n_alpha = wm_template[ny, nx]
                        n_p = min(n_alpha * opacity, 0.99)
                        n_inv = 1 - n_p
                        n_underflow = False
                        if n_p >= 0.002 and n_inv > 0.0001:
                            for c in range(3):
                                if (orig_region[ny, nx, c] - n_p * overlay_value) / n_inv < 0:
                                    n_underflow = True
                                    break
                        if not n_underflow:
                            avg += unblended[ny, nx]
                            count += 1
            if count > 0:
                new_result[y, x] = avg / count

# Compare quality metrics
gray_new = new_result.mean(axis=2)
gray_ref = ref_region.mean(axis=2)
gray_unblended = unblended.mean(axis=2)

# Laplacian (high-frequency energy)
lap_new = np.abs(cv2.Laplacian(gray_new, cv2.CV_64F))
lap_ref = np.abs(cv2.Laplacian(gray_ref, cv2.CV_64F))
lap_unblended = np.abs(cv2.Laplacian(gray_unblended, cv2.CV_64F))

wm_mask = wm_template > 0.08

print(f"\n=== NEW ALGORITHM QUALITY (WM zone) ===")
print(f"Laplacian energy:")
print(f"  New:       {lap_new[wm_mask].mean():.3f}")
print(f"  Ref:       {lap_ref[wm_mask].mean():.3f}")
print(f"  Unblended: {lap_unblended[wm_mask].mean():.3f}")

# Gradient magnitude
grad_new = np.sqrt(np.gradient(gray_new, axis=0)**2 + np.gradient(gray_new, axis=1)**2)
grad_ref = np.sqrt(np.gradient(gray_ref, axis=0)**2 + np.gradient(gray_ref, axis=1)**2)

print(f"Gradient magnitude:")
print(f"  New:  {grad_new[wm_mask].mean():.3f}")
print(f"  Ref:  {grad_ref[wm_mask].mean():.3f}")

# Pixel diff from reference
diff_new_ref = np.abs(new_result - ref_region)
print(f"Mean pixel diff from ref:")
print(f"  New:       {diff_new_ref[wm_mask].mean():.3f}")
print(f"  Unblended: {np.abs(unblended - ref_region)[wm_mask].mean():.3f}")

print(f"\nDone!")
