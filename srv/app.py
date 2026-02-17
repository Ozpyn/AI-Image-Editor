from flask import Flask, request, jsonify, send_file
from ai import run_inpaint, run_outpaint, run_deblur, run_describe

app = Flask(__name__)

@app.route("/")
def welcome():
    return "AI-Image Editor Flask API"

@app.route("/inpaint", methods=["POST"])
def inpaint():
    if "image" not in request.files or "mask" not in request.files:
        return jsonify({"error": "image and mask are required"}), 400

    image = request.files["image"]
    mask = request.files["mask"]

    output_path = run_inpaint(image, mask)

    return send_file(output_path, mimetype="image/png")

@app.route("/outpaint", methods=["POST"])
def outpaint():
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    directions = request.form.get("directions")
    if not directions:
        return jsonify({"error": "directions required"}), 400

    output_path = run_outpaint(
        request.files["image"],
        directions
    )

    return send_file(output_path, mimetype="image/png")

@app.route("/deblur", methods=["POST"])
def deblur():
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    output_path = run_deblur(request.files["image"])

    return send_file(output_path, mimetype="image/png")

@app.route("/describeme", methods=["POST"])
def inpaintDescribe():
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    image = request.files["image"]

    description = run_describe(image, mask)

    return jsonify ({"description": description}), 200
