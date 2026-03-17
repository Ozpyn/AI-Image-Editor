import torch
from PIL import Image
from diffusers import StableDiffusionInpaintPipeline, StableDiffusionImg2ImgPipeline
from transformers import BlipProcessor, BlipForConditionalGeneration
from rembg import remove
from rembg import remove
import tempfile
import io

DEVICE = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

print(f"Using device: {DEVICE}")

# Initialize models
print("Loading inpainting model...")
inpainting_pipe = StableDiffusionInpaintPipeline.from_pretrained(
    "runwayml/stable-diffusion-inpainting",
    torch_dtype=DTYPE,
    safety_checker=None,
    requires_safety_checker=False
).to(DEVICE)

# Enable memory efficient attention if available
if DEVICE == "cuda":
    inpainting_pipe.enable_attention_slicing()

print("Loading img2img model...")
deblur_pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=DTYPE,
    safety_checker=None,
    requires_safety_checker=False
).to(DEVICE)

if DEVICE == "cuda":
    deblur_pipe.enable_attention_slicing()

print("Loading BLIP model...")
caption_processor = BlipProcessor.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)

caption_model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base",
    torch_dtype=DTYPE
).to(DEVICE)

print("All models loaded successfully!")

caption_processor = BlipProcessor.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)
caption_model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base"
).to(DEVICE)

# inpainting_pipe.enable_xformers_memory_efficient_attention()

# These might be changed later to implement Redis, which would allow us to queue jobs.
# We could also 'lazy load' each model and keep it in memory for as long as the Flask app is running, making it so subsequent requests are faster.

def run_inpaint(image, mask, prompt=None, progress_callback=None):
    image = Image.open(image).convert("RGB")
    mask = Image.open(mask).convert("RGB")
    original_size = image.size  # Store original dimensions (width, height)
    prompt = prompt or ""
    guidance = 1.0 if prompt == "" else 4.0

    total_steps = 40

    def callback(step, timestep, latents):
        if progress_callback:
            percent = int(((step + 1) / total_steps) * 100)
            progress_callback(percent)

    with torch.inference_mode():
        result = inpainting_pipe(
            prompt=prompt,
            image=image,
            mask_image=mask,
            guidance_scale=guidance,
            num_inference_steps=total_steps,
            callback=callback,
            callback_steps=1,
        )
    
    # Resize output back to original image size
    output_image = result.images[0].resize(original_size, Image.Resampling.LANCZOS)
    
    # Save to a temporary file
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    output_image.save(tmp.name)
    return tmp.name

def run_outpaint(image, directions, prompt=None, progress_callback=None):
    image = Image.open(image).convert("RGB")
    w, h = image.size

    x = directions.get("x", 0)
    y = directions.get("y", 0)

    left = directions.get("left", x)
    right = directions.get("right", x)
    top = directions.get("top", y)
    bottom = directions.get("bottom", y)

    mod_image = Image.new("RGB", (w + left + right, h + top + bottom))
    mod_image.paste(image, (left, top))

    new_mask = Image.new("L", mod_image.size, 255)
    new_mask.paste(Image.new("L", (w, h), 0), (left, top))

    return run_inpaint(mod_image, new_mask, prompt, progress_callback)

def run_deblur(image, prompt=None, progress_callback=None):
    image = Image.open(image).convert("RGB")
    original_size = image.size  # Store original dimensions (width, height)

    if not prompt:
        inputs = caption_processor(image, return_tensors="pt").to(DEVICE)
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
        if inpainted.size != original_size:
            print(f"Resizing output from {inpainted.size} to {original_size}")
            inpainted = inpainted.resize(original_size, Image.Resampling.LANCZOS)
        
        if composite:
            # For "remove object": keep original outside mask
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
            print("Using composite mode (remove object)")
        else:
            # For "replace object": use AI result everywhere
            result_image = inpainted
            print("Using full replacement mode (replace object)")
        
        # Save to temporary file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        result_image.save(tmp.name, format="PNG", quality=100)
        
        print(f"Inpaint result saved to: {tmp.name}")
        
        # Verify the file was saved correctly
        with open(tmp.name, 'rb') as f:
            header = f.read(8)
            if not header.startswith(b'\x89PNG\r\n\x1a\n'):
                print("WARNING: Output is not a valid PNG!")
                result_image.save(tmp.name, format="PNG", compress_level=0)
            else:
                print("Output is valid PNG")
        
        return tmp.name
        
    except Exception as e:
        print(f"Error in run_inpaint: {str(e)}")
        traceback.print_exc()
        raise e

    strength = 0.35
    total_steps = 40

    def callback(step, timestep, latents):
        if progress_callback:
            percent = int(((step + 1) / total_steps) * 100)
            progress_callback(percent)

    with torch.inference_mode():
        result = deblur_pipe(
            prompt=prompt,
            image=image,
            strength=strength,
            guidance_scale=4.0,
            num_inference_steps=total_steps,
            callback=callback,
            callback_steps=1,
        )

    # Resize output back to original image size
    output_image = result.images[0].resize(original_size, Image.Resampling.LANCZOS)
    
    try:
        # Load image
        image = Image.open(image_path).convert("RGB")
        w, h = image.size
        print(f"Original image dimensions: {w}x{h}")
        
        # Get expansion amounts
        left = directions.get("left", 0)
        right = directions.get("right", 0)
        top = directions.get("top", 0)
        bottom = directions.get("bottom", 0)
        
        print(f"Expanding: left={left}, right={right}, top={top}, bottom={bottom}")
        
        # Create expanded canvas
        new_width = w + left + right
        new_height = h + top + bottom
        
        print(f"New dimensions: {new_width}x{new_height}")
        
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
        
        # Save expanded image and mask temporarily
        expanded_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        mask_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        
        expanded_image.save(expanded_tmp.name, format="PNG")
        mask.save(mask_tmp.name, format="PNG")
        
        print(f"Saved expanded image to: {expanded_tmp.name}")
        print(f"Saved mask to: {mask_tmp.name}")
        
        # Use inpainting to fill expanded areas
        output_path = run_inpaint(
            expanded_tmp.name,
            mask_tmp.name,
            prompt=prompt or "expand the image naturally, seamless continuation",
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
            seed=seed
        )
        
        # Clean up temp files
        try:
            os.unlink(expanded_tmp.name)
            os.unlink(mask_tmp.name)
        except:
            pass
        
        return output_path
        
    except Exception as e:
        print(f"Error in run_outpaint: {str(e)}")
        traceback.print_exc()
        raise e

def run_deblur(image_path, prompt=None, strength=0.35, guidance_scale=4.0, num_inference_steps=40):
    """Deblur an image using img2img"""
    try:
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
        
    except Exception as e:
        print(f"Error in run_deblur: {str(e)}")
        traceback.print_exc()
        raise e

def run_describe(image_file):
    """Generate a caption for an image"""
    try:
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
        
        print(f"Generated description: {description}")
        return description
        
    except Exception as e:
        print(f"Error in run_describe: {str(e)}")
        traceback.print_exc()
        raise e

    description = caption_processor.decode(
        out[0],
        skip_special_tokens=True
    )

    return description

def run_remove_background(image):
    image = Image.open(image).convert("RGBA")

    # Convert image to bytes
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format="PNG")

    # Remove background
    output = remove(img_byte_arr.getvalue())

    # Convert to PIL
    result = Image.open(io.BytesIO(output))
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    result.save(tmp.name)

    return
