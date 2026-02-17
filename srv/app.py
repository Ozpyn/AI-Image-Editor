from flask import Flask, request, jsonify, send_file, send_from_directory
from ai import run_inpaint, run_outpaint, run_deblur, run_describe
import json
from flask import Flask, send_from_directory
import os

app = Flask(
    __name__,
    static_folder="../frontend/dist",
    static_url_path="/"
)

@app.route("/api/hello")
def hello():
    return {"message": "Hello from Flask"}

from flask import Flask, request, jsonify, send_file
from ai import run_inpaint, run_outpaint, run_deblur, run_describe
import json

app = Flask(
    __name__,
    static_folder="../dist",
    static_url_path="/"
)

# Serve SPA
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, "index.html")


@app.route("/api/hello")
def welcome():
    return "AI-Image Editor Flask API"

@app.route("/api/inpaint", methods=["POST"])
@app.route("/api/inpaint", methods=["POST"])
def inpaint():
    if "image" not in request.files or "mask" not in request.files:
        return jsonify({"error": "image and mask are required"}), 400

    image = request.files["image"]
    mask = request.files["mask"]
    prompt = request.form.get("prompt")

    try:
        output_path = run_inpaint(image, mask, prompt)
        output_path = run_inpaint(
        request.files["image"],
        request.files["mask"],
        request.form.get("prompt")  # optional
        )
    print("Try to get files")

    image = request.files["image"]
    mask = request.files["mask"]
    prompt = request.form.get("prompt")

    try:
        print("try to inpaint")
        output_path = run_inpaint(image, mask, prompt)
        print("try to send")
        return send_file(output_path, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route("/api/outpaint", methods=["POST"])
def outpaint():
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    directions = request.form.get("directions")
    if not directions:
        return jsonify({"error": "directions required"}), 400

    try:
        directions = json.loads(directions)
        directions = json.loads(directions)
        output_path = run_outpaint(
            request.files["image"],
            directions,
            request.form.get("prompt")  # optional
            request.form.get("prompt")  # optional
        )
        return send_file(output_path, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/deblur", methods=["POST"])
@app.route("/api/deblur", methods=["POST"])
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
    try:
        output_path = run_deblur(
            request.files["image"],
            request.form.get("prompt")  # optional
        )
        return send_file(output_path, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    try:
        output_path = run_deblur(
            request.files["image"],
            request.form.get("prompt")  # optional
        )
        return send_file(output_path, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/describeme", methods=["POST"])
def desc():
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    description = run_describe(request.files["image"])
    description = run_describe(request.files["image"])

    return jsonify ({"description": description}), 200

if __name__ == '__main__':
	app.run(port=8000)
