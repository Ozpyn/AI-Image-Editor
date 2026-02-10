import torch
from PIL import Image
from diffusers.utils import load_image
from diffusers import StableDiffusionInpaintPipeline

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

inpainting_pipe = StableDiffusionInpaintPipeline.from_pretrained(
    "runwayml/stable-diffusion-inpainting",
    torch_dtype=torch.float16
).to(DEVICE)

# inpainting_pipe.enable_xformers_memory_efficient_attention()

# These might be changed later to implement Redis, which would allow us to queue jobs.
# We could also 'lazy load' each model and keep it in memory for as long as the Flask app is running, making it so subsequent requests are faster.

def run_inpaint(image, mask, prompt=None):
    prompt = prompt or ""
    guidance = 1.0 if prompt == "" else 4.0

    with torch.inference_mode():
        result = inpainting_pipe(
            prompt=prompt,
            image=image,
            mask_image=mask,
            guidance_scale=0.0 if prompt == "" else 4.0,
            num_inference_steps=40,
        )
    return result.images[0]

def run_outpaint(image, directions, prompt=None):
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

    return run_inpaint(mod_image, new_mask, prompt)

def run_deblur(image):
    # Call and Run
    return