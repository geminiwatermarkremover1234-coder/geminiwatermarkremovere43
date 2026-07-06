"""
Compare the NEW cleaned video (v2, with fixed opacity) vs reference and old cleaned video.
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
from scipy.ndimage import uniform_filter

test_dir = os.path.dirname(os.path.abspath(__file__))

new_video = os.path.join(test_dir, "cleaned_test_v2.mp4")
old_video = os.path.join(test_dir, "cleaned_test_browser.mp4")
ref_video = os.path.join(test_dir, "clean from reference website.mp4")
orig_video = os.path.join(test_dir, "test.mp4")

def extract_frame(video_path, frame_idx=30):
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) if ret else None

# Analyze multiple frames
frames = [10, 30, 60, 90, 120]

print("=" * 70)
print("COMPREHENSIVE COMPARISON: NEW vs OLD vs REFERENCE")
print("=" * 70)

for fi in frames:
    new_f = extract_frame(new_video, fi)
    old_f = extract_frame(old_video, fi)
    ref_f = extract_frame(ref_video, fi)
    orig_f = extract_frame(orig_video, fi)
    
    if new_f is None or ref_f is None or orig_f is None:
        print(f"Frame {fi}: Could not extract")
        continue
    
    h, w = orig_f.shape[:2]
    
    # Watermark region: centered at (1160, 600), template is 48x48
    # Use a 80x80 crop around it
    wx, wy = 1160, 600
    cs = 40
    y1, y2 = max(0, wy-cs), min(h, wy+cs+8)
    x1, x2 = max(0, wx-cs), min(w, wx+cs+8)
    
    new_crop = new_f[y1:y2, x1:x2, :3].astype(np.float64)
    ref_crop = ref_f[y1:y2, x1:x2, :3].astype(np.float64)
    orig_crop = orig_f[y1:y2, x1:x2, :3].astype(np.float64)
    
    diff_new_ref = np.abs(new_crop - ref_crop).mean()
    diff_new_orig = np.abs(new_crop - orig_crop).mean()
    diff_ref_orig = np.abs(ref_crop - orig_crop).mean()
    
    old_crop = old_f[y1:y2, x1:x2, :3].astype(np.float64) if old_f is not None else None
    diff_old_ref = np.abs(old_crop - ref_crop).mean() if old_crop is not None else -1
    
    # Texture quality (Laplacian)
    gray_new = new_crop.mean(axis=2)
    gray_ref = ref_crop.mean(axis=2)
    gray_old = old_crop.mean(axis=2) if old_crop is not None else None
    gray_orig = orig_crop.mean(axis=2)
    
    lap_new = np.abs(cv2.Laplacian(gray_new, cv2.CV_64F)).mean()
    lap_ref = np.abs(cv2.Laplacian(gray_ref, cv2.CV_64F)).mean()
    lap_old = np.abs(cv2.Laplacian(gray_old, cv2.CV_64F)).mean() if gray_old is not None else -1
    lap_orig = np.abs(cv2.Laplacian(gray_orig, cv2.CV_64F)).mean()
    
    print(f"\nFrame {fi}:")
    print(f"  Pixel diff from ref: NEW={diff_new_ref:.2f}, OLD={diff_old_ref:.2f}  << {'IMPROVED!' if diff_new_ref < diff_old_ref else 'worse'}")
    print(f"  Laplacian energy:    NEW={lap_new:.2f}, REF={lap_ref:.2f}, OLD={lap_old:.2f}, ORIG={lap_orig:.2f}")
    old_brightness = f"{old_crop.mean():.1f}" if old_crop is not None else "N/A"
    print(f"  Brightness:          NEW={new_crop.mean():.1f}, REF={ref_crop.mean():.1f}, OLD={old_brightness}, ORIG={orig_crop.mean():.1f}")

# Full-frame comparison at frame 30
print(f"\n{'='*70}")
print("FULL-FRAME COMPARISON (Frame 30)")
print(f"{'='*70}")

fi = 30
new_f = extract_frame(new_video, fi)
old_f = extract_frame(old_video, fi)
ref_f = extract_frame(ref_video, fi)
orig_f = extract_frame(orig_video, fi)
h, w = orig_f.shape[:2]

# 200x200 bottom-right corner
crop = 200
y1, y2 = h-crop, h
x1, x2 = w-crop, w

new_c = new_f[y1:y2, x1:x2, :3].astype(np.float64)
old_c = old_f[y1:y2, x1:x2, :3].astype(np.float64)
ref_c = ref_f[y1:y2, x1:x2, :3].astype(np.float64)
orig_c = orig_f[y1:y2, x1:x2, :3].astype(np.float64)

print(f"  200x200 corner: NEW vs REF = {np.abs(new_c - ref_c).mean():.3f}")
print(f"  200x200 corner: OLD vs REF = {np.abs(old_c - ref_c).mean():.3f}")
print(f"  Improvement: {np.abs(old_c - ref_c).mean() - np.abs(new_c - ref_c).mean():.3f} pixels closer to ref")

# Save comparison images
wx, wy = 1160, 600
cs = 40
y1b, y2b = max(0, wy-cs), min(h, wy+cs+8)
x1b, x2b = max(0, wx-cs), min(w, wx+cs+8)

new_crop_img = new_f[y1b:y2b, x1b:x2b]
old_crop_img = old_f[y1b:y2b, x1b:x2b] if old_f is not None else np.zeros_like(new_crop_img)
ref_crop_img = ref_f[y1b:y2b, x1b:x2b]
orig_crop_img = orig_f[y1b:y2b, x1b:x2b]

# Save: Original | Old | New | Reference
row = np.hstack([orig_crop_img, old_crop_img, new_crop_img, ref_crop_img])
Image.fromarray(row).save(os.path.join(test_dir, "v2_comparison_4way.png"))

# Save amplified diffs
diff_new = (np.abs(new_f[y1b:y2b, x1b:x2b].astype(np.float32) - ref_f[y1b:y2b, x1b:x2b].astype(np.float32)) * 15).clip(0, 255).astype(np.uint8)
diff_old = (np.abs(old_f[y1b:y2b, x1b:x2b].astype(np.float32) - ref_f[y1b:y2b, x1b:x2b].astype(np.float32)) * 15).clip(0, 255).astype(np.uint8)
diff_row = np.hstack([diff_old, diff_new])
Image.fromarray(diff_row).save(os.path.join(test_dir, "v2_amplified_diffs.png"))

print(f"\nSaved comparison images!")
print(f"  v2_comparison_4way.png = [Original | Old | New | Reference]")
print(f"  v2_amplified_diffs.png = [Old-vs-Ref (15x) | New-vs-Ref (15x)]")
