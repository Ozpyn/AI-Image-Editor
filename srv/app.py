from flask import Flask, request, jsonify, send_file
from ai import run_inpaint, run_outpaint, run_deblur, run_describe
import json

app = Flask(__name__)

@app.route("/")
def welcome():
    return "AI-Image Editor Flask API"

@app.route("/inpaint", methods=["POST"])
def inpaint():
    if "image" not in request.files or "mask" not in request.files:
        return jsonify({"error": "image and mask are required"}), 400

    try:
        output_path = run_inpaint(
        request.files["image"],
        request.files["mask"],
        request.form.get("prompt")  # optional
        )
        return send_file(output_path, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/outpaint", methods=["POST"])
def outpaint():
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    directions = request.form.get("directions")
    if not directions:
        return jsonify({"error": "directions required"}), 400

    try:
        directions = json.loads(directions)
        output_path = run_outpaint(
            request.files["image"],
            directions,
            request.form.get("prompt")  # optional
        )
        return send_file(output_path, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/deblur", methods=["POST"])
def deblur():
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    try:
        output_path = run_deblur(
            request.files["image"],
            request.form.get("prompt")  # optional
        )
        return send_file(output_path, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/describeme", methods=["POST"])
def desc():
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    description = run_describe(request.files["image"])

    return jsonify ({"description": description}), 200

if __name__ == '__main__':
	app.run(port=8000)
