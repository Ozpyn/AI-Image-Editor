import torch
from PIL import Image, ImageFilter
from diffusers.utils import load_image
from diffusers import StableDiffusionInpaintPipeline, StableDiffusionImg2ImgPipeline
from transformers import BlipProcessor, BlipForConditionalGeneration, logging
from rembg import remove
import tempfile
import io

logging.set_verbosity_error()

DEVICE = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

inpainting_pipe = StableDiffusionInpaintPipeline.from_pretrained(
    "runwayml/stable-diffusion-inpainting",
    torch_dtype=DTYPE,
    use_safetensors=False
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
    torch_dtype=DTYPE
).to(DEVICE)

caption_processor = BlipProcessor.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)
caption_model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base"
).to(DEVICE)

# inpainting_pipe.enable_xformers_memory_efficient_attention()

def run_inpaint(image, mask, prompt=None, progress_callback=None):
    image = Image.open(image).convert("RGB")
    mask = Image.open(mask).convert("L")
    original_size = image.size
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

    output_image = result.images[0].resize(original_size, Image.Resampling.LANCZOS)

    mask = mask.resize(original_size, Image.Resampling.LANCZOS)

    soft_mask = mask.filter(ImageFilter.GaussianBlur(radius=3))

    soft_mask = soft_mask.point(lambda x: min(255, max(0, x)))

    blended = Image.composite(output_image, image, soft_mask)

    if progress_callback:
        progress_callback(100)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    blended.save(tmp.name)
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
    original_size = image.size

    if not prompt:
        inputs = caption_processor(image, return_tensors="pt").to(DEVICE)
        with torch.inference_mode():
            out = caption_model.generate(**inputs, max_new_tokens=50)
        prompt = caption_processor.decode(out[0], skip_special_tokens=True)

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

    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format="PNG")

    output = remove(img_byte_arr.getvalue())

    result = Image.open(io.BytesIO(output))
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    result.save(tmp.name)

    return tmp.name


def run_replace_background(image, prompt=None):
    image = Image.open(image).convert("RGBA")
    prompt = prompt or "a clean, natural background behind the subject"

    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format="PNG")

    removed = remove(img_byte_arr.getvalue())
    foreground = Image.open(io.BytesIO(removed)).convert("RGBA")

    alpha = foreground.split()[-1]
    mask = alpha.point(lambda a: 255 if a == 0 else 0).convert("RGB")
    rgb_foreground = foreground.convert("RGB")

    mask_bytes = io.BytesIO()
    mask.save(mask_bytes, format="PNG")
    mask_bytes.seek(0)

    fg_bytes = io.BytesIO()
    rgb_foreground.save(fg_bytes, format="PNG")
    fg_bytes.seek(0)

    return run_inpaint(fg_bytes, mask_bytes, prompt)