import torch
from PIL import Image
from diffusers import StableDiffusionInpaintPipeline, StableDiffusionImg2ImgPipeline
from transformers import BlipProcessor, BlipForConditionalGeneration
from rembg import remove
import tempfile
import io
import numpy as np

DEVICE = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

print(f"Using device: {DEVICE}")

# Initialize models
inpainting_pipe = StableDiffusionInpaintPipeline.from_pretrained(
    "runwayml/stable-diffusion-inpainting",
    torch_dtype=DTYPE,
    safety_checker=None,
    requires_safety_checker=False
).to(DEVICE)

# Enable memory efficient attention if available
if DEVICE == "cuda":
    inpainting_pipe.enable_attention_slicing()

deblur_pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=DTYPE,
    safety_checker=None,
    requires_safety_checker=False
).to(DEVICE)

if DEVICE == "cuda":
    deblur_pipe.enable_attention_slicing()

caption_processor = BlipProcessor.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)

caption_model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base",
    torch_dtype=DTYPE
).to(DEVICE)

def run_inpaint(image_path, mask_path, prompt=None, guidance_scale=7.5, num_inference_steps=40, seed=-1):
    """Run inpainting on an image with a mask"""
    # Set seed for reproducibility
    if seed >= 0:
        torch.manual_seed(seed)
    
    # Load images
    original_image = Image.open(image_path).convert("RGB")
    mask = Image.open(mask_path).convert("L")  # Convert to grayscale
    
    # Ensure mask is binary
    mask = mask.point(lambda x: 255 if x > 128 else 0)
    
    original_size = original_image.size
    
    # Resize for model if needed
    target_size = (512, 512)
    if original_image.size != target_size:
        image_resized = original_image.resize(target_size, Image.Resampling.LANCZOS)
        mask_resized = mask.resize(target_size, Image.Resampling.LANCZOS)
    else:
        image_resized = original_image
        mask_resized = mask
    
    prompt = prompt or ""
    
    with torch.inference_mode():
        result = inpainting_pipe(
            prompt=prompt,
            image=image_resized,
            mask_image=mask_resized,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
        )
    
    # Get the inpainted result
    inpainted = result.images[0]
    
    # Resize back to original size
    inpainted = inpainted.resize(original_size, Image.Resampling.LANCZOS)
    
    # Composite: keep original where mask is black, use inpainted where mask is white
    # Convert mask to numpy for pixel-wise operation
    import numpy as np
    
    # Ensure mask is the same size as original
    if mask.size != original_size:
        mask = mask.resize(original_size, Image.Resampling.NEAREST)
    
    # Convert to numpy arrays
    original_np = np.array(original_image)
    inpainted_np = np.array(inpainted)
    mask_np = np.array(mask)
    
    # Normalize mask to 0-1 range
    if mask_np.max() > 1:
        mask_np = mask_np / 255.0
    
    # Ensure mask is 3-channel for RGB compositing
    if len(mask_np.shape) == 2:
        mask_np = np.stack([mask_np] * 3, axis=2)
    
    # Composite: result = (1 - mask) * original + mask * inpainted
    result_np = (1 - mask_np) * original_np + mask_np * inpainted_np
    result_np = result_np.astype(np.uint8)
    
    # Convert back to PIL Image
    result_image = Image.fromarray(result_np)
    
    # Save to temporary file
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    result_image.save(tmp.name, format="PNG", quality=100)
    
    # Verify the file was saved correctly
    with open(tmp.name, 'rb') as f:
        header = f.read(8)
        if not header.startswith(b'\x89PNG\r\n\x1a\n'):
            print("ERROR: Output is not a valid PNG!")
            result_image.save(tmp.name, format="PNG", compress_level=0)
        else:
            print("Output is valid PNG")
    
    return tmp.name

def run_outpaint(image_path, directions, prompt=None, guidance_scale=7.5, num_inference_steps=40, seed=-1):
    """Run outpainting to expand an image in given directions"""
    # Load image
    image = Image.open(image_path).convert("RGB")
    w, h = image.size
    
    # Get expansion amounts
    left = directions.get("left", 0)
    right = directions.get("right", 0)
    top = directions.get("top", 0)
    bottom = directions.get("bottom", 0)
    
    # Create expanded canvas
    new_width = w + left + right
    new_height = h + top + bottom
    
    # Create new image with extended canvas
    expanded_image = Image.new("RGB", (new_width, new_height), color=(255, 255, 255))
    expanded_image.paste(image, (left, top))
    
    # Create mask for the expanded areas (white = areas to inpaint)
    mask = Image.new("L", (new_width, new_height), 0)  # Black = keep original
    # White areas are the expanded regions
    if left > 0:
        mask.paste(255, (0, 0, left, new_height))
    if right > 0:
        mask.paste(255, (new_width - right, 0, new_width, new_height))
    if top > 0:
        mask.paste(255, (0, 0, new_width, top))
    if bottom > 0:
        mask.paste(255, (0, new_height - bottom, new_width, new_height))
    
    # Save mask temporarily
    mask_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    mask.save(mask_tmp.name, format="PNG")
    
    # Use inpainting to fill expanded areas
    output_path = run_inpaint(
        expanded_image,  # Pass PIL image directly
        mask_tmp.name,
        prompt=prompt or "expand the image naturally, seamless continuation",
        guidance_scale=guidance_scale,
        num_inference_steps=num_inference_steps,
        seed=seed
    )
    
    # Clean up mask temp file
    try:
        os.unlink(mask_tmp.name)
    except:
        pass
    
    return output_path

def run_deblur(image_path, prompt=None, strength=0.35, guidance_scale=4.0, num_inference_steps=40):
    """Deblur an image using img2img"""
    image = Image.open(image_path).convert("RGB")
    original_size = image.size
    
    # Auto-generate caption if no prompt provided
    if not prompt:
        with open(image_path, "rb") as f:
            prompt = run_describe(f)
    
    # Resize for model if needed
    target_size = (512, 512)
    if image.size != target_size:
        image = image.resize(target_size, Image.Resampling.LANCZOS)
    
    with torch.inference_mode():
        result = deblur_pipe(
            prompt=prompt,
            image=image,
            strength=strength,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
        )
    
    # Resize output back to original image size
    output_image = result.images[0].resize(original_size, Image.Resampling.LANCZOS)
    
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    output_image.save(tmp.name, format="PNG")
    
    return tmp.name

def run_describe(image_file):
    """Generate a caption for an image"""
    image = Image.open(image_file).convert("RGB")
    
    inputs = caption_processor(image, return_tensors="pt").to(DEVICE)
    
    with torch.inference_mode():
        out = caption_model.generate(
            **inputs,
            max_new_tokens=50,
            num_beams=5
        )
    
    description = caption_processor.decode(
        out[0],
        skip_special_tokens=True
    )
    
    return description

def run_remove_background(image_file):
    """Remove background from an image using rembg"""
    image = Image.open(image_file).convert("RGBA")
    
    # Convert image to bytes
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)
    
    # Remove background
    output = remove(img_byte_arr.read())
    
    # Convert to PIL
    result = Image.open(io.BytesIO(output))
    
    # Create a white background and composite
    white_bg = Image.new("RGBA", result.size, (255, 255, 255, 255))
    if result.mode == "RGBA":
        # Composite with white background
        result = Image.alpha_composite(white_bg, result)
        result = result.convert("RGB")
    else:
        result = result.convert("RGB")
    
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    result.save(tmp.name, format="PNG")
    
    return tmp.name