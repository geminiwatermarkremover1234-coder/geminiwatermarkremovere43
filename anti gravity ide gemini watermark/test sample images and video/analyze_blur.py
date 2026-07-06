"""
Detailed multi-frame analysis to understand the exact smoothing/blur the reference website applies.
Analyzes frequency domain and gradient patterns.
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
from scipy.ndimage import uniform_filter, gaussian_filter

test_dir = os.path.dirname(os.path.abspath(__file__))

ours_video = os.path.join(test_dir, "cleaned_test_browser.mp4")
ref_video = os.path.join(test_dir, "clean from reference website.mp4")
orig_video = os.path.join(test_dir, "test.mp4")

def extract_frame(video_path, frame_idx=30):
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) if ret else None

# Multi-frame analysis
frames_to_check = [10, 30, 60, 90, 120]

print("=" * 70)
print("MULTI-FRAME WATERMARK FOOTPRINT ANALYSIS")
print("=" * 70)

for fi in frames_to_check:
    ours_f = extract_frame(ours_video, fi)
    ref_f = extract_frame(ref_video, fi)
    orig_f = extract_frame(orig_video, fi)
    
    if ours_f is None or ref_f is None or orig_f is None:
        print(f"Frame {fi}: Could not extract from one or more videos")
        continue
    
    h, w = orig_f.shape[:2]
    
    # The watermark is at bottom-right. Use offset 120 (seems to be the most active)
    # Extract a tight 80x80 crop around the watermark
    for off in [120]:
        cx, cy = w - off, h - off
        bx1, bx2 = max(0, cx - 40), min(w, cx + 40)
        by1, by2 = max(0, cy - 40), min(h, cy + 40)
        
        t_ours = ours_f[by1:by2, bx1:bx2, :3].astype(np.float64)
        t_ref = ref_f[by1:by2, bx1:bx2, :3].astype(np.float64)
        t_orig = orig_f[by1:by2, bx1:bx2, :3].astype(np.float64)
        
        # Check if reference applied Gaussian blur by testing if 
        # blurring our output makes it closer to reference
        gray_ours = t_ours.mean(axis=2)
        gray_ref = t_ref.mean(axis=2)
        gray_orig = t_orig.mean(axis=2)
        
        # Where is the watermark? Pixels where orig is significantly brighter
        wm_pixels = (gray_orig - gray_ref) > 5  # where ref subtracted watermark
        
        if wm_pixels.sum() < 5:
            print(f"Frame {fi}: No significant watermark pixels at offset {off}")
            continue
        
        # Try different Gaussian blur sigmas on our output
        print(f"\nFrame {fi}, offset {off} (WM pixels: {wm_pixels.sum()}):")
        base_diff = np.abs(t_ours - t_ref)[wm_pixels].mean()
        print(f"  Base ours-vs-ref diff (WM zone): {base_diff:.3f}")
        
        for sigma in [0.3, 0.5, 0.7, 1.0, 1.5, 2.0]:
            blurred = np.stack([gaussian_filter(t_ours[:,:,c], sigma) for c in range(3)], axis=2)
            blurred_diff = np.abs(blurred - t_ref)[wm_pixels].mean()
            improvement = base_diff - blurred_diff
            print(f"  Gaussian sigma={sigma:.1f}: diff={blurred_diff:.3f} (improvement: {improvement:+.3f})")
        
        # Check gradient magnitude (edge sharpness) in WM zone
        ours_grad = np.sqrt(np.gradient(gray_ours, axis=0)**2 + np.gradient(gray_ours, axis=1)**2)
        ref_grad = np.sqrt(np.gradient(gray_ref, axis=0)**2 + np.gradient(gray_ref, axis=1)**2)
        orig_grad = np.sqrt(np.gradient(gray_orig, axis=0)**2 + np.gradient(gray_orig, axis=1)**2)
        
        print(f"  Gradient magnitude in WM zone:")
        print(f"    Ours:  {ours_grad[wm_pixels].mean():.3f}")
        print(f"    Ref:   {ref_grad[wm_pixels].mean():.3f}")
        print(f"    Orig:  {orig_grad[wm_pixels].mean():.3f}")
        
        # Check high-frequency energy (Laplacian)
        ours_lap = np.abs(cv2.Laplacian(gray_ours.astype(np.float64), cv2.CV_64F))
        ref_lap = np.abs(cv2.Laplacian(gray_ref.astype(np.float64), cv2.CV_64F))
        orig_lap = np.abs(cv2.Laplacian(gray_orig.astype(np.float64), cv2.CV_64F))
        
        print(f"  Laplacian (high-freq energy) in WM zone:")
        print(f"    Ours:  {ours_lap[wm_pixels].mean():.3f}")
        print(f"    Ref:   {ref_lap[wm_pixels].mean():.3f}")
        print(f"    Orig:  {orig_lap[wm_pixels].mean():.3f}")

# Detailed pixel-by-pixel comparison in the core watermark area
print("\n" + "=" * 70)
print("PIXEL-BY-PIXEL CORE WATERMARK ANALYSIS (Frame 30)")
print("=" * 70)

ours_f = extract_frame(ours_video, 30)
ref_f = extract_frame(ref_video, 30)
orig_f = extract_frame(orig_video, 30)
h, w = orig_f.shape[:2]

# Find exact watermark center by looking at max diff between orig and ref
off = 120
cx, cy = w - off, h - off
bx1, bx2 = max(0, cx - 40), min(w, cx + 40)
by1, by2 = max(0, cy - 40), min(h, cy + 40)

t_orig = orig_f[by1:by2, bx1:bx2].astype(np.float64)
t_ref = ref_f[by1:by2, bx1:bx2].astype(np.float64)
t_ours = ours_f[by1:by2, bx1:bx2].astype(np.float64)

diff_map = np.abs(t_orig - t_ref).mean(axis=2)
max_y, max_x = np.unravel_index(np.argmax(diff_map), diff_map.shape)
print(f"Peak diff at local ({max_x}, {max_y}), value: {diff_map[max_y, max_x]:.1f}")
print(f"Global coords: ({bx1+max_x}, {by1+max_y})")

# Check a 5x5 neighborhood around the peak
for dy in range(-2, 3):
    row_data = []
    for dx in range(-2, 3):
        py, px = max_y + dy, max_x + dx
        if 0 <= py < diff_map.shape[0] and 0 <= px < diff_map.shape[1]:
            o_val = t_orig[py, px].mean()
            r_val = t_ref[py, px].mean()
            u_val = t_ours[py, px].mean()
            row_data.append(f"O:{o_val:.0f} R:{r_val:.0f} U:{u_val:.0f}")
        else:
            row_data.append("---")
    print(f"  dy={dy:+d}: " + " | ".join(row_data))

# Key finding: does ref apply uniform darkening or true unblending?
print(f"\n=== UNBLENDING PATTERN ANALYSIS ===")
# For alpha blending: composited = (1-a)*background + a*white
# So background = (composited - a*255) / (1-a)
# If ref and ours both unblend correctly, they should match the same background
# Any difference would be in post-processing (blur/smooth)

# Look at the correction delta: how much each method subtracted from original
ours_delta = t_orig - t_ours  # what we subtracted
ref_delta = t_orig - t_ref    # what ref subtracted

# In WM zone
wm_mask = diff_map > 5
if wm_mask.sum() > 0:
    print(f"  Our avg subtraction (WM zone):  {ours_delta[wm_mask].mean():.2f}")
    print(f"  Ref avg subtraction (WM zone):  {ref_delta[wm_mask].mean():.2f}")
    print(f"  Ratio (ref/ours):               {ref_delta[wm_mask].mean() / max(ours_delta[wm_mask].mean(), 0.01):.3f}")
    
    # Per-channel
    for c, name in enumerate(["R", "G", "B"]):
        our_ch = (t_orig[:,:,c] - t_ours[:,:,c])[wm_mask]
        ref_ch = (t_orig[:,:,c] - t_ref[:,:,c])[wm_mask]
        print(f"  {name}: ours_delta={our_ch.mean():.2f}, ref_delta={ref_ch.mean():.2f}")

print("\nDone.")
