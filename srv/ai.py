import torch
from diffusers import AutoPipelineForInpainting
from diffusers.utils import load_image

# These might be changed later to implement Redis, which would allow us to queue jobs.
# We could also 'lazy load' each model and keep it in memory for as long as the Flask app is running, making it so subsequent requests are faster.

def run_inpaint(image, mask):
    # Call and Run model here
    return

def run_outpaint(image, directions):
    # Call and Run
    return

def run_deblur(image):
    # Call and Run
    return