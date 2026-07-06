"""
Find the TRUE optimal opacity by brute-force testing at the correct position.
"""
import sys, os
import numpy as np
try:
    import cv2
except:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "opencv-python-headless", "-q"])
    import cv2
from PIL import Image

test_dir = os.path.dirname(os.path.abspath(__file__))
orig_video = os.path.join(test_dir, "test.mp4")
ref_video = os.path.join(test_dir, "clean from reference website.mp4")

def extract_frame(video_path, frame_idx=30):
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) if ret else None

wm_path = os.path.join(test_dir, "..", "watermarks", "bg_48.png")
wm_img = np.array(Image.open(wm_path).convert('L')).astype(np.float64) / 255.0

orig_f = extract_frame(orig_video, 30)
ref_f = extract_frame(ref_video, 30)
h, w = orig_f.shape[:2]

# Correct position from template matching
wx, wy = 1160, 600
th, tw = wm_img.shape

orig_region = orig_f[wy:wy+th, wx:wx+tw].astype(np.float64)
ref_region = ref_f[wy:wy+th, wx:wx+tw].astype(np.float64)

overlay_value = 255.0
ceiling = 0.99

print("=== OPACITY SWEEP ===")
print(f"{'Opacity':>8} {'Mean Diff':>10} {'Max Diff':>10} {'High-A Diff':>12} {'Med-A Diff':>12}")

wm_mask = wm_img > 0.08
high_a = wm_img > 0.5
med_a = (wm_img > 0.1) & (wm_img <= 0.5)

best_opacity = 1.0
best_diff = 999

for op_int in range(20, 110, 2):
    opacity = op_int / 100.0
    
    unblended = np.zeros_like(orig_region)
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
            for c in range(3):
                restored = (orig_region[y, x, c] - p * overlay_value) / inv_p
                unblended[y, x, c] = np.clip(restored, 0, 255)
    
    diff = np.abs(unblended - ref_region)
    mean_diff = diff[wm_mask].mean()
    max_diff = diff[wm_mask].max()
    high_diff = diff[high_a].mean() if high_a.sum() > 0 else 0
    med_diff = diff[med_a].mean() if med_a.sum() > 0 else 0
    
    if mean_diff < best_diff:
        best_diff = mean_diff
        best_opacity = opacity
    
    print(f"{opacity:>8.2f} {mean_diff:>10.3f} {max_diff:>10.1f} {high_diff:>12.3f} {med_diff:>12.3f}")

print(f"\nBest opacity: {best_opacity} (mean diff: {best_diff:.3f})")

# Also test with baseStrength variations
print(f"\n=== BASE STRENGTH SWEEP (at optimal opacity {best_opacity}) ===")
for bs_int in range(50, 150, 5):
    bs = bs_int / 100.0
    
    unblended = np.zeros_like(orig_region)
    for y in range(th):
        for x in range(tw):
            alpha = wm_img[y, x]
            p = min(alpha * bs * best_opacity, ceiling)
            if p < 0.002:
                unblended[y, x] = orig_region[y, x]
                continue
            inv_p = 1 - p
            if inv_p <= 0.0001:
                unblended[y, x] = orig_region[y, x]
                continue
            for c in range(3):
                restored = (orig_region[y, x, c] - p * overlay_value) / inv_p
                unblended[y, x, c] = np.clip(restored, 0, 255)
    
    diff = np.abs(unblended - ref_region)
    mean_diff = diff[wm_mask].mean()
    print(f"  bs={bs:.2f}: mean_diff={mean_diff:.3f}")

# Now test: what if we use overlay_value < 255?
print(f"\n=== OVERLAY VALUE SWEEP (at optimal opacity {best_opacity}, baseStrength=1.0) ===")
for ov in range(220, 260, 2):
    unblended = np.zeros_like(orig_region)
    for y in range(th):
        for x in range(tw):
            alpha = wm_img[y, x]
            p = min(alpha * 1.0 * best_opacity, ceiling)
            if p < 0.002:
                unblended[y, x] = orig_region[y, x]
                continue
            inv_p = 1 - p
            if inv_p <= 0.0001:
                unblended[y, x] = orig_region[y, x]
                continue
            for c in range(3):
                restored = (orig_region[y, x, c] - p * ov) / inv_p
                unblended[y, x, c] = np.clip(restored, 0, 255)
    
    diff = np.abs(unblended - ref_region)
    mean_diff = diff[wm_mask].mean()
    print(f"  overlay={ov}: mean_diff={mean_diff:.3f}")

# Generate the best possible unblending
print(f"\n=== GENERATING BEST RESULT ===")
# Use the best opacity found
unblended_best = np.zeros_like(orig_region)
for y in range(th):
    for x in range(tw):
        alpha = wm_img[y, x]
        p = min(alpha * 1.0 * best_opacity, ceiling)
        if p < 0.002:
            unblended_best[y, x] = orig_region[y, x]
            continue
        inv_p = 1 - p
        if inv_p <= 0.0001:
            unblended_best[y, x] = orig_region[y, x]
            continue
        for c in range(3):
            restored = (orig_region[y, x, c] - p * overlay_value) / inv_p
            unblended_best[y, x, c] = np.clip(restored, 0, 255)

diff_best = np.abs(unblended_best - ref_region)
print(f"Best result: mean diff = {diff_best[wm_mask].mean():.3f}")
print(f"High-alpha diff: {diff_best[high_a].mean():.3f}")

# Save comparison
comp = np.hstack([
    orig_region.astype(np.uint8),
    unblended_best.astype(np.uint8),
    ref_region.astype(np.uint8)
])
Image.fromarray(comp).save(os.path.join(test_dir, "optimal_opacity_comparison.png"))

# Also check multi-frame consistency
print(f"\n=== MULTI-FRAME OPTIMAL OPACITY ===")
for fi in [10, 30, 60, 90]:
    of = extract_frame(orig_video, fi)
    rf = extract_frame(ref_video, fi)
    if of is None or rf is None:
        continue
    
    or_region = of[wy:wy+th, wx:wx+tw].astype(np.float64)
    rr_region = rf[wy:wy+th, wx:wx+tw].astype(np.float64)
    
    # Find best opacity for this frame
    best_op_frame = 1.0
    best_diff_frame = 999
    for op_int in range(20, 110, 2):
        opacity = op_int / 100.0
        ub = np.zeros_like(or_region)
        for y in range(th):
            for x in range(tw):
                alpha = wm_img[y, x]
                p = min(alpha * opacity, ceiling)
                if p < 0.002:
                    ub[y, x] = or_region[y, x]
                    continue
                inv_p = 1 - p
                if inv_p <= 0.0001:
                    ub[y, x] = or_region[y, x]
                    continue
                for c in range(3):
                    restored = (or_region[y, x, c] - p * overlay_value) / inv_p
                    ub[y, x, c] = np.clip(restored, 0, 255)
        
        d = np.abs(ub - rr_region)[wm_mask].mean()
        if d < best_diff_frame:
            best_diff_frame = d
            best_op_frame = opacity
    
    print(f"  Frame {fi}: best opacity = {best_op_frame}, diff = {best_diff_frame:.3f}")

print("\nDone!")
