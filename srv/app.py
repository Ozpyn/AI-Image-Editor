from flask import Flask

app = Flask(__name__)

@app.route("/")
def welcome():
    return "AI-Image Editor Flask API"

@app.route("/inpaint")
def inpaint():
    # Should be provided two images: base image, and mask (should be same resolution or aspect ratio)
    # Should call a function that runs the AI-model once, then shuts it down
    # Returns the generated image
    return 1

@app.route("/outpaint")
def outpaint():
    # Should be provided two objects: base image, and list of north south east west [1,2,3,4]?
    # Should call a function that runs the AI-model once, then shuts it down
    # Returns the generated image
    return 1