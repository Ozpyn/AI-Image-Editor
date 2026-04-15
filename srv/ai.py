import os
import sys
import io
import tempfile

import numpy as np
import torch
from PIL import Image, ImageFilter

from diffusers import StableDiffusionInpaintPipeline
from transformers import BlipProcessor, BlipForConditionalGeneration, logging
from rembg import remove 
import tempfile
import io

logging.set_verbosity_error()

# -----------------------------
# Paths
# -----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

# Your local Restormer repo and weights
RESTORMER_REPO_DIR = os.path.join(BASE_DIR, "Restormer")
RESTORMER_WEIGHT_PATH = os.path.join(
    BASE_DIR, "weights", "restormer_motion_deblurring.pth"
)

# Make Restormer importable
if RESTORMER_REPO_DIR not in sys.path:
    sys.path.append(RESTORMER_REPO_DIR)

# print(f"[INIT] BASE_DIR = {BASE_DIR}", flush=True)
# print(f"[INIT] RESTORMER_REPO_DIR = {RESTORMER_REPO_DIR}", flush=True)
# print(f"[INIT] RESTORMER_WEIGHT_PATH = {RESTORMER_WEIGHT_PATH}", flush=True)

# -----------------------------
# Device
# -----------------------------
DEVICE = (
    "cuda"
    if torch.cuda.is_available()
    else "mps"
    if torch.backends.mps.is_available()
    else "cpu"
)

DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32
# print(f"[INIT] DEVICE = {DEVICE}", flush=True)
# print(f"[INIT] DTYPE = {DTYPE}", flush=True)

# -----------------------------
# Inpainting pipeline
# -----------------------------
# print("[INIT] Loading Stable Diffusion inpainting pipeline...", flush=True)
inpainting_pipe = StableDiffusionInpaintPipeline.from_pretrained(
    "runwayml/stable-diffusion-inpainting",
    torch_dtype=DTYPE,
    use_safetensors=False,
).to(DEVICE)
# print("[INIT] Inpainting pipeline loaded.", flush=True)

# -----------------------------
# Caption model
# -----------------------------
# print("[INIT] Loading BLIP caption processor/model...", flush=True)
caption_processor = BlipProcessor.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)

caption_model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base",
    torch_dtype=DTYPE,
).to(DEVICE)
# print("[INIT] BLIP caption model loaded.", flush=True)

# -----------------------------
# Restormer model cache
# -----------------------------
restormer_model = None


def _load_restormer():
    global restormer_model

    if restormer_model is not None:
        print("[Restormer] Using cached model.", flush=True)
        return restormer_model

    print("[Restormer] Loading Restormer model for the first time...", flush=True)

    if not os.path.exists(RESTORMER_REPO_DIR):
        raise FileNotFoundError(f"Restormer repo folder not found: {RESTORMER_REPO_DIR}")

    if not os.path.exists(RESTORMER_WEIGHT_PATH):
        raise FileNotFoundError(f"Restormer weights not found: {RESTORMER_WEIGHT_PATH}")

    # print("[Restormer] Repo folder exists.", flush=True)
    # print("[Restormer] Weight file exists.", flush=True)

    try:
        # print("[Restormer] About to import architecture directly...", flush=True)
        restormer_arch_dir = os.path.join(
            RESTORMER_REPO_DIR, "basicsr", "models", "archs"
        )
        if restormer_arch_dir not in sys.path:
            sys.path.append(restormer_arch_dir)

        from restormer_arch import Restormer
        # print("[Restormer] Architecture imported.", flush=True)
    except Exception as e:
        raise ImportError(
            "Could not import restormer_arch.py directly. Check this file exists: "
            f"{os.path.join(RESTORMER_REPO_DIR, 'basicsr', 'models', 'archs', 'restormer_arch.py')}"
        ) from e

    # print("[Restormer] About to instantiate model...", flush=True)
    model = Restormer(
        inp_channels=3,
        out_channels=3,
        dim=48,
        num_blocks=[4, 6, 6, 8],
        num_refinement_blocks=4,
        heads=[1, 2, 4, 8],
        ffn_expansion_factor=2.66,
        bias=False,
        LayerNorm_type="WithBias",
    )
    # print("[Restormer] Model instantiated.", flush=True)

    # print("[Restormer] About to load checkpoint file...", flush=True)
    checkpoint = torch.load(RESTORMER_WEIGHT_PATH, map_location=DEVICE)
    # print("[Restormer] Checkpoint file loaded.", flush=True)

    # if isinstance(checkpoint, dict):
        # print(f"[Restormer] Checkpoint keys: {list(checkpoint.keys())[:20]}", flush=True)

    if isinstance(checkpoint, dict) and "params" in checkpoint:
        state_dict = checkpoint["params"]
    else:
        state_dict = checkpoint

    # print("[Restormer] About to load weights into model...", flush=True)
    model.load_state_dict(state_dict, strict=True)
    # print("[Restormer] Weights loaded into model successfully.", flush=True)

    model.to(DEVICE)
    model.eval()
    # print("[Restormer] Model moved to device and set to eval mode.", flush=True)

    restormer_model = model
    return restormer_model


def _to_model_tensor(image: Image.Image) -> torch.Tensor:
    """
    Convert a PIL RGB image to a normalized BCHW torch tensor.
    """
    arr = np.array(image).astype(np.float32) / 255.0
    # print(
    #     f"[Tensor] Input image -> numpy shape={arr.shape}, dtype={arr.dtype}, "
    #     f"min={arr.min():.4f}, max={arr.max():.4f}",
    #     flush=True,
    # )
    tensor = torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0)
    # print(
    #     f"[Tensor] Numpy -> tensor shape={tuple(tensor.shape)}, dtype={tensor.dtype}",
    #     flush=True,
    # )
    tensor = tensor.to(DEVICE)
    # print(
    #     f"[Tensor] Tensor moved to device={DEVICE}, shape={tuple(tensor.shape)}, dtype={tensor.dtype}",
    #     flush=True,
    # )
    return tensor


def _from_model_tensor(tensor: torch.Tensor) -> Image.Image:
    """
    Convert BCHW tensor back to a PIL RGB image.
    """
    # print(
    #     f"[Tensor] Model output tensor before clamp: shape={tuple(tensor.shape)}, "
    #     f"dtype={tensor.dtype}, min={tensor.min().item():.6f}, max={tensor.max().item():.6f}",
    #     flush=True,
    # )
    tensor = torch.clamp(tensor, 0, 1)
    arr = tensor.squeeze(0).permute(1, 2, 0).detach().cpu().numpy()
    # print(
    #     f"[Tensor] Output numpy shape={arr.shape}, dtype={arr.dtype}, "
    #     f"min={arr.min():.6f}, max={arr.max():.6f}",
    #     flush=True,
    # )
    arr = (arr * 255.0).round().astype(np.uint8)
    image = Image.fromarray(arr)
    # print(f"[Tensor] Converted output PIL size={image.size}", flush=True)
    return image


def _pad_to_multiple(tensor: torch.Tensor, multiple: int = 8):
    """
    Pad BCHW tensor so height and width are divisible by `multiple`.
    Returns:
      padded_tensor, original_height, original_width
    """
    _, _, h, w = tensor.shape
    pad_h = (multiple - h % multiple) % multiple
    pad_w = (multiple - w % multiple) % multiple

    # print(
    #     f"[Pad] Original tensor size: h={h}, w={w}, multiple={multiple}, "
    #     f"pad_h={pad_h}, pad_w={pad_w}",
    #     flush=True,
    # )

    if pad_h == 0 and pad_w == 0:
        # print("[Pad] No padding needed.", flush=True)
        return tensor, h, w

    padded = torch.nn.functional.pad(
        tensor,
        (0, pad_w, 0, pad_h),
        mode="reflect",
    )
    # print(f"[Pad] Padded tensor shape={tuple(padded.shape)}", flush=True)
    return padded, h, w


def run_inpaint(image, mask, prompt=None, progress_callback=None):
    # print("[Inpaint] Starting inpaint request.", flush=True)

    image = Image.open(image).convert("RGB")
    mask = Image.open(mask).convert("L")
    original_size = image.size
    prompt = prompt or ""
    guidance = 1.0 if prompt == "" else 7.5
    strength = 0.75 if prompt == "" else 1.0

    # print(
    #     f"[Inpaint] original_size={original_size}, prompt='{prompt}', guidance={guidance}",
    #     flush=True,
    # )

    total_steps = 30 if prompt == "" else 40

    def callback(step, timestep, latents):
        if progress_callback:
            percent = int(((step + 1) / total_steps) * 100)
            progress_callback(percent)

    with torch.inference_mode():
        result = inpainting_pipe(
            prompt=prompt,
            image=image,
            mask_image=mask,
            strength=strength,
            guidance_scale=guidance,
            num_inference_steps=total_steps,
            callback=callback,
            callback_steps=2,
        )

    output_image = result.images[0].resize(original_size, Image.Resampling.LANCZOS)

    mask = mask.resize(original_size, Image.Resampling.LANCZOS)
    soft_mask = mask.filter(ImageFilter.GaussianBlur(radius=3))
    soft_mask = soft_mask.point(lambda x: min(255, max(0, x)))

    blended = Image.composite(output_image, image, soft_mask)

    if progress_callback:
        progress_callback(100)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    blended.save(tmp.name)

    # print(f"[Inpaint] Saved output to {tmp.name}", flush=True)
    return tmp.name


def run_outpaint(image, directions, prompt=None, progress_callback=None):
    # print("[Outpaint] Starting outpaint request.", flush=True)

    image = Image.open(image).convert("RGB")
    w, h = image.size

    x = directions.get("x", 0)
    y = directions.get("y", 0)

    left = directions.get("left", x)
    right = directions.get("right", x)
    top = directions.get("top", y)
    bottom = directions.get("bottom", y)

    # print(
    #     f"[Outpaint] image_size={(w, h)}, left={left}, right={right}, top={top}, bottom={bottom}",
    #     flush=True,
    # )

    mod_image = Image.new("RGB", (w + left + right, h + top + bottom))
    mod_image.paste(image, (left, top))

    new_mask = Image.new("L", mod_image.size, 255)
    new_mask.paste(Image.new("L", (w, h), 0), (left, top))

    # Convert mod_image to bytes
    img_bytes = io.BytesIO()
    mod_image.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    # Also convert mask to bytes
    mask_bytes = io.BytesIO()
    new_mask.save(mask_bytes, format='PNG')
    mask_bytes.seek(0)
    
    
    return run_inpaint(img_bytes, mask_bytes, prompt, progress_callback)


def run_deblur(image, progress_callback=None):
    """
    Deblur using Restormer.
    No text prompt is required because Restormer is a restoration model.
    """
    # print("🔥 Restormer run_deblur() called 🔥", flush=True)
    # print(f"[Deblur] DEVICE={DEVICE}", flush=True)
    # print(f"[Deblur] RESTORMER_WEIGHT_PATH={RESTORMER_WEIGHT_PATH}", flush=True)

    model = _load_restormer()

    image = Image.open(image).convert("RGB")
    original_image_np = np.array(image).astype(np.float32)
    original_size = image.size

    # print(f"[Deblur] Input PIL size={original_size}", flush=True)

    if progress_callback:
        progress_callback(10)

    img_tensor = _to_model_tensor(image)
    img_tensor, original_h, original_w = _pad_to_multiple(img_tensor, multiple=8)

    # print(
    #     f"[Deblur] original_h={original_h}, original_w={original_w}, "
    #     f"tensor_after_pad={tuple(img_tensor.shape)}",
    #     flush=True,
    # )

    if progress_callback:
        progress_callback(30)

    with torch.inference_mode():
        restored = model(img_tensor)

    # print(f"[Deblur] Raw model output shape={tuple(restored.shape)}", flush=True)

    if progress_callback:
        progress_callback(90)

    restored = restored[:, :, :original_h, :original_w]
    # print(f"[Deblur] Cropped model output shape={tuple(restored.shape)}", flush=True)

    output_image = _from_model_tensor(restored)

    if output_image.size != original_size:
        # print(
        #     f"[Deblur] Resizing output from {output_image.size} to {original_size}",
        #     flush=True,
        # )
        output_image = output_image.resize(original_size, Image.Resampling.LANCZOS)

    output_image_np = np.array(output_image).astype(np.float32)
    mean_pixel_diff = np.mean(np.abs(output_image_np - original_image_np))
    max_pixel_diff = np.max(np.abs(output_image_np - original_image_np))

    # print(f"[Deblur] Mean pixel diff vs input: {mean_pixel_diff:.6f}", flush=True)
    # print(f"[Deblur] Max pixel diff vs input: {max_pixel_diff:.6f}", flush=True)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    output_image.save(tmp.name)

    # print(f"[Deblur] Saved output to {tmp.name}", flush=True)

    if progress_callback:
        progress_callback(100)

    return tmp.name


def run_describe(image):
    # print("[Describe] Starting describe request.", flush=True)

    image = Image.open(image).convert("RGB")

    inputs = caption_processor(image, return_tensors="pt").to(DEVICE)

    with torch.inference_mode():
        out = caption_model.generate(
            **inputs,
            max_new_tokens=50,
        )

    description = caption_processor.decode(
        out[0],
        skip_special_tokens=True,
    )

    # print(f"[Describe] Description: {description}", flush=True)
    return description


def run_remove_background(image):
    # print("[RemoveBG] Starting background removal.", flush=True)

    image = Image.open(image).convert("RGBA")

    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format="PNG")

    output = remove(img_byte_arr.getvalue())

    result = Image.open(io.BytesIO(output))
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    result.save(tmp.name)

    # print(f"[RemoveBG] Saved output to {tmp.name}", flush=True)
    return tmp.name


def run_replace_background(image, prompt=None, progress_callback=None):
    # print("[ReplaceBG] Starting background replacement.", flush=True)

    image = Image.open(image).convert("RGBA")
    prompt = prompt or "a clean, natural background behind the subject"

    # print(f"[ReplaceBG] prompt='{prompt}'", flush=True)
    
    # Remove background
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format="PNG")
    removed = remove(img_byte_arr.getvalue())
    foreground = Image.open(io.BytesIO(removed)).convert("RGBA")
    
    # Create a solid colored background instead of transparent
    background = Image.new("RGB", image.size, (128, 128, 128))  # Neutral gray
    background.paste(foreground, (0, 0), foreground)
    
    # Create mask (white where background should be generated)
    mask = Image.new("L", image.size, 0)
    alpha = foreground.split()[-1]
    mask_data = mask.load()
    alpha_data = alpha.load()
    
    for x in range(image.size[0]):
        for y in range(image.size[1]):
            if alpha_data[x, y] == 0:
                mask_data[x, y] = 255
    
    # Convert to bytes
    bg_bytes = io.BytesIO()
    background.save(bg_bytes, format="PNG")
    bg_bytes.seek(0)
    
    mask_bytes = io.BytesIO()
    mask.save(mask_bytes, format="PNG")
    mask_bytes.seek(0)
    
    return run_inpaint(bg_bytes, mask_bytes, prompt, progress_callback)