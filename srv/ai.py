import torch
from PIL import Image
from diffusers.utils import load_image
from diffusers import StableDiffusionInpaintPipeline, StableDiffusionImg2ImgPipeline
from transformers import BlipProcessor, BlipForConditionalGeneration
from rembg import remove
import tempfile
import io

DEVICE = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

inpainting_pipe = StableDiffusionInpaintPipeline.from_pretrained(
    "runwayml/stable-diffusion-inpainting",
    torch_dtype=DTYPE
).to(DEVICE)

deblur_pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=DTYPE
).to(DEVICE)

caption_processor = BlipProcessor.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)

caption_model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base",
    torch_dtype=DTYPE
).to(DEVICE)

deblur_pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=torch.float16
).to(DEVICE)

caption_processor = BlipProcessor.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)
caption_model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base"
).to(DEVICE)

# inpainting_pipe.enable_xformers_memory_efficient_attention()

# These might be changed later to implement Redis, which would allow us to queue jobs.
# We could also 'lazy load' each model and keep it in memory for as long as the Flask app is running, making it so subsequent requests are faster.

def run_inpaint(image, mask, prompt=None):
    image = Image.open(image).convert("RGB")
    mask = Image.open(mask).convert("RGB")
    original_size = image.size  # Store original dimensions (width, height)
    prompt = prompt or ""
    guidance = 1.0 if prompt == "" else 4.0

    with torch.inference_mode():
        result = inpainting_pipe(
            prompt=prompt,
            image=image,
            mask_image=mask,
            guidance_scale=guidance,
            num_inference_steps=40,
        )
    
    # Resize output back to original image size
    output_image = result.images[0].resize(original_size, Image.Resampling.LANCZOS)
    
    # Save to a temporary file
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    output_image.save(tmp.name)
    return tmp.name

def run_outpaint(image, directions, prompt=None):
    image=Image.open(image).convert("RGB")
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

    outpainted = run_inpaint(mod_image, new_mask, prompt)

    return outpainted

def run_deblur(image, prompt=None):
    image = Image.open(image).convert("RGB")
    original_size = image.size  # Store original dimensions (width, height)

    # Auto-generate caption if no prompt provided
    if not prompt:
        inputs = caption_processor(image, return_tensors="pt").to(DEVICE)
        with torch.inference_mode():
            out = caption_model.generate(**inputs, max_new_tokens=50)
        prompt = caption_processor.decode(out[0], skip_special_tokens=True)

    # Low strength keeps structure, reduces blur
    strength = 0.35

    with torch.inference_mode():
        result = deblur_pipe(
            prompt=prompt,
            image=image,
            strength=strength,
            guidance_scale=4.0,
            num_inference_steps=40,
        )

    # Resize output back to original image size
    output_image = result.images[0].resize(original_size, Image.Resampling.LANCZOS)
    
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    output_image.save(tmp.name)

    return tmp.name

def run_describe(image):
    image = Image.open(image).convert("RGB")

    inputs = caption_processor(image, return_tensors="pt").to(DEVICE)

    with torch.inference_mode():
        out = caption_model.generate(
            **inputs,
            max_new_tokens=50
        )

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