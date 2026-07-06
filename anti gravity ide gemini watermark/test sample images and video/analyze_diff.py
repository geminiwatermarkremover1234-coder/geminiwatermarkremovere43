"""
Compare our cleaned video vs reference website cleaned video at the watermark region.
Uses OpenCV to extract frames.
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

test_dir = os.path.dirname(os.path.abspath(__file__))

# Paths
ours_video = os.path.join(test_dir, "cleaned_test_browser.mp4")
ref_video = os.path.join(test_dir, "clean from reference website.mp4")
orig_video = os.path.join(test_dir, "test.mp4")

def extract_frame(video_path, frame_idx=30):
    """Extract a specific frame from video"""
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        raise ValueError(f"Could not read frame {frame_idx} from {video_path}")
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

# Extract frames at frame 30 (~1 second)
print("Extracting frames...")
ours_frame = extract_frame(ours_video, 30)
ref_frame = extract_frame(ref_video, 30)
orig_frame = extract_frame(orig_video, 30)

print(f"Ours shape: {ours_frame.shape}")
print(f"Ref shape:  {ref_frame.shape}")
print(f"Orig shape: {orig_frame.shape}")

h, w = orig_frame.shape[:2]

# Ensure all frames are same size
if ours_frame.shape != orig_frame.shape:
    print(f"WARNING: Ours has different shape, resizing...")
    ours_frame = cv2.resize(ours_frame, (w, h))
if ref_frame.shape != orig_frame.shape:
    print(f"WARNING: Ref has different shape, resizing...")
    ref_frame = cv2.resize(ref_frame, (w, h))

# Crop region: bottom-right corner where watermark lives (generous 200x200 crop)
crop_size = 200
y1, y2 = h - crop_size, h
x1, x2 = w - crop_size, w

ours_crop = ours_frame[y1:y2, x1:x2, :3].astype(np.float32)
ref_crop = ref_frame[y1:y2, x1:x2, :3].astype(np.float32)
orig_crop = orig_frame[y1:y2, x1:x2, :3].astype(np.float32)

# Compare ours vs ref
diff_ours_ref = np.abs(ours_crop - ref_crop)
print(f"\n=== OURS vs REFERENCE (watermark region {crop_size}x{crop_size}) ===")
print(f"Mean pixel diff: {diff_ours_ref.mean():.3f}")
print(f"Max pixel diff:  {diff_ours_ref.max():.1f}")
print(f"Std pixel diff:  {diff_ours_ref.std():.3f}")
print(f"Pixels > 5 diff: {(diff_ours_ref > 5).sum()} / {diff_ours_ref.size}")
print(f"Pixels > 10 diff: {(diff_ours_ref > 10).sum()} / {diff_ours_ref.size}")
print(f"Pixels > 20 diff: {(diff_ours_ref > 20).sum()} / {diff_ours_ref.size}")

# Compare ours vs orig (how much did we change from original)
diff_ours_orig = np.abs(ours_crop - orig_crop)
print(f"\n=== OURS vs ORIGINAL (watermark region) ===")
print(f"Mean pixel diff: {diff_ours_orig.mean():.3f}")
print(f"Max pixel diff:  {diff_ours_orig.max():.1f}")

# Compare ref vs orig (how much did reference change from original)
diff_ref_orig = np.abs(ref_crop - orig_crop)
print(f"\n=== REFERENCE vs ORIGINAL (watermark region) ===")
print(f"Mean pixel diff: {diff_ref_orig.mean():.3f}")
print(f"Max pixel diff:  {diff_ref_orig.max():.1f}")

# Analyze where ours and reference diverge most
diff_map = diff_ours_ref.mean(axis=2)
print(f"\n=== SPATIAL ANALYSIS of OURS vs REF diff ===")
mid = crop_size // 2
quadrants = {
    "top-left (away from watermark)": diff_map[:mid, :mid],
    "top-right": diff_map[:mid, mid:],
    "bottom-left": diff_map[mid:, :mid],
    "bottom-right (watermark center)": diff_map[mid:, mid:],
}
for name, q in quadrants.items():
    print(f"  {name}: mean={q.mean():.3f}, max={q.max():.1f}")

# Tight watermark footprint analysis
print(f"\n=== TIGHT WATERMARK FOOTPRINT ANALYSIS (60x60 around offset) ===")
offsets_720 = [144, 120, 128, 72]
for off in offsets_720:
    cx = w - off
    cy = h - off
    bx1, bx2 = max(0, cx - 30), min(w, cx + 30)
    by1, by2 = max(0, cy - 30), min(h, cy + 30)
    
    tight_ours = ours_frame[by1:by2, bx1:bx2, :3].astype(np.float32)
    tight_ref = ref_frame[by1:by2, bx1:bx2, :3].astype(np.float32)
    tight_orig = orig_frame[by1:by2, bx1:bx2, :3].astype(np.float32)
    
    d_or = np.abs(tight_ours - tight_ref).mean()
    d_oo = np.abs(tight_ours - tight_orig).mean()
    d_ro = np.abs(tight_ref - tight_orig).mean()
    
    print(f"  Offset {off}: ours_vs_ref={d_or:.2f}, ours_vs_orig={d_oo:.2f}, ref_vs_orig={d_ro:.2f}")

# Per-channel analysis
print(f"\n=== PER-CHANNEL ANALYSIS (ours vs ref, full crop) ===")
for c, name in enumerate(["Red", "Green", "Blue"]):
    ch_diff = np.abs(ours_crop[:,:,c] - ref_crop[:,:,c])
    print(f"  {name}: mean={ch_diff.mean():.3f}, max={ch_diff.max():.1f}, std={ch_diff.std():.3f}")

# Brightness analysis
print(f"\n=== BRIGHTNESS ANALYSIS ===")
ours_brightness = ours_crop.mean()
ref_brightness = ref_crop.mean()
orig_brightness = orig_crop.mean()
print(f"  Ours mean brightness: {ours_brightness:.2f}")
print(f"  Ref mean brightness:  {ref_brightness:.2f}")  
print(f"  Orig mean brightness: {orig_brightness:.2f}")
print(f"  Ours - Ref:  {ours_brightness - ref_brightness:+.2f}")
print(f"  Ours - Orig: {ours_brightness - orig_brightness:+.2f}")
print(f"  Ref - Orig:  {ref_brightness - orig_brightness:+.2f}")

# Check if reference applies Gaussian blur
# By computing local variance in the watermark area for both ours and ref
print(f"\n=== TEXTURE/BLUR ANALYSIS (local variance) ===")
from scipy.ndimage import uniform_filter
# Compute local variance (3x3 window)
def local_variance(img, window=5):
    """Compute local variance of an image"""
    mean = uniform_filter(img.astype(np.float64), window)
    sqr_mean = uniform_filter((img.astype(np.float64))**2, window)
    return sqr_mean - mean**2

# Find where the watermark actually is
# Let's look at where ref differs most from orig (that's the watermark zone)
diff_ref_orig_map = np.abs(ref_crop - orig_crop).mean(axis=2)
wm_mask = diff_ref_orig_map > 3  # pixels where reference changed from original

print(f"  Watermark affected pixels: {wm_mask.sum()} / {wm_mask.size}")

if wm_mask.sum() > 10:
    # Compute local variance inside watermark zone
    for name, crop in [("Ours", ours_crop), ("Ref", ref_crop), ("Orig", orig_crop)]:
        gray = crop.mean(axis=2)
        lv = local_variance(gray, 5)
        wm_var = lv[wm_mask].mean()
        non_wm_var = lv[~wm_mask].mean()
        print(f"  {name}: WM zone variance={wm_var:.2f}, Non-WM variance={non_wm_var:.2f}, ratio={wm_var/max(non_wm_var, 0.01):.3f}")

# Save crops for visual inspection
Image.fromarray(orig_crop.astype(np.uint8)).save(os.path.join(test_dir, "crop_analysis_orig.png"))
Image.fromarray(ours_crop.astype(np.uint8)).save(os.path.join(test_dir, "crop_analysis_ours.png"))
Image.fromarray(ref_crop.astype(np.uint8)).save(os.path.join(test_dir, "crop_analysis_ref.png"))

# Save amplified diff
diff_vis = (diff_ours_ref * 10).clip(0, 255).astype(np.uint8)
Image.fromarray(diff_vis).save(os.path.join(test_dir, "amplified_diff_ours_vs_ref.png"))

# Also save the diff between ours and orig (10x amplified) - shows what we changed
diff_ours_orig_vis = (diff_ours_orig * 10).clip(0, 255).astype(np.uint8)
Image.fromarray(diff_ours_orig_vis).save(os.path.join(test_dir, "amplified_diff_ours_vs_orig.png"))

# And diff between ref and orig - shows what reference changed
diff_ref_orig_vis = (diff_ref_orig * 10).clip(0, 255).astype(np.uint8)
Image.fromarray(diff_ref_orig_vis).save(os.path.join(test_dir, "amplified_diff_ref_vs_orig.png"))

print(f"\nSaved all analysis images!")
print(f"\nDone.")
