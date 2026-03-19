from flask import Flask, request, jsonify, send_file, send_from_directory
import json, os, threading, uuid, time, tempfile
from io import BytesIO
from ai import run_inpaint, run_outpaint, run_deblur, run_describe, run_remove_background
from flask_cors import CORS  # Add this import
from ai import run_inpaint, run_outpaint, run_deblur, run_describe, run_remove_background
import json
import os
import uuid
import time
import threading
import tempfile
from io import BytesIO

app = Flask(
    __name__,
    static_folder="../frontend/dist",
    static_url_path="/"
)

# Configure CORS - allow all origins in development
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

task_storage = {}
MAX_TASK_AGE = 3600  # Keep completed tasks for 1 hour
task_lock = threading.Lock()

# Serve SPA
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, "index.html")

@app.route("/hello")
def welcome():
    return "AI-Image Editor Flask API"


def _run_task_async(task_id, task_func, cleanup_files):
    """Helper to run AI task in background thread with error handling"""
    try:
        result = task_func()
        with task_lock:
            task_storage[task_id]["result"] = result
            task_storage[task_id]["status"] = "completed"
    except Exception as e:
        with task_lock:
            task_storage[task_id]["error"] = str(e)
            task_storage[task_id]["status"] = "failed"
    finally:
        for filepath in cleanup_files:
            try:
                os.unlink(filepath)
            except:
                pass


@app.route("/api/inpaint", methods=["POST"])
                if os.path.exists(filepath):
                    os.unlink(filepath)
            except:
                pass

@app.route("/inpaint", methods=["POST", "OPTIONS"])
def inpaint():
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return "", 200
        
    if "image" not in request.files or "mask" not in request.files:
        return jsonify({"error": "image and mask are required"}), 400

    # Generate unique task ID
    task_id = str(uuid.uuid4())
    
    with task_lock:
        task_storage[task_id] = {
            "status": "processing",
            "result": None,
            "error": None,
            "created_at": time.time()
        }
    
    img_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    mask_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    request.files["image"].save(img_tmp.name)
    request.files["mask"].save(mask_tmp.name)
    prompt = request.form.get("prompt")
    
    def run():
        output_path = run_inpaint(
            open(img_tmp.name, "rb"),
            open(mask_tmp.name, "rb"),
            prompt
    
    # Get parameters from form
    prompt = request.form.get("prompt", "")
    guidance_scale = float(request.form.get("guidance_scale", 7.5))
    steps = int(request.form.get("steps", 40))
    seed = int(request.form.get("seed", -1))
    
    def run():
        output_path = run_inpaint(
            img_tmp.name,
            mask_tmp.name,
            prompt,
            guidance_scale=guidance_scale,
            num_inference_steps=steps,
            seed=seed
        )
        with open(output_path, "rb") as f:
            result = f.read()
        os.unlink(output_path)
        return result
    
    thread = threading.Thread(
        target=_run_task_async,
        args=(task_id, run, [img_tmp.name, mask_tmp.name]),
        daemon=True
    )
    thread.start()
    
    return jsonify({"task_id": task_id}), 202

    response = jsonify({"task_id": task_id})
    response.status_code = 202
    return response

@app.route("/outpaint", methods=["POST", "OPTIONS"])
def outpaint():
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return "", 200
        
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    directions = request.form.get("directions")
    if not directions:
        return jsonify({"error": "directions required"}), 400

    task_id = str(uuid.uuid4())
    
    with task_lock:
        task_storage[task_id] = {
            "status": "processing",
            "result": None,
            "error": None,
            "created_at": time.time()
        }
    
    img_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    request.files["image"].save(img_tmp.name)
    directions_data = json.loads(directions)
    prompt = request.form.get("prompt")
    
    def run():
        output_path = run_outpaint(
            open(img_tmp.name, "rb"),
            directions_data,
            prompt
    
    # Get parameters
    prompt = request.form.get("prompt", "")
    guidance_scale = float(request.form.get("guidance_scale", 7.5))
    steps = int(request.form.get("steps", 40))
    seed = int(request.form.get("seed", -1))
    
    # Get expansion directions (left, right, top, bottom)
    left = int(request.form.get("left", 0))
    right = int(request.form.get("right", 0))
    top = int(request.form.get("top", 0))
    bottom = int(request.form.get("bottom", 0))
    
    directions = {
        "left": left,
        "right": right,
        "top": top,
        "bottom": bottom
    }
    
    def run():
        output_path = run_outpaint(
            img_tmp.name,
            directions,
            prompt,
            guidance_scale=guidance_scale,
            num_inference_steps=steps,
            seed=seed
        )
        with open(output_path, "rb") as f:
            result = f.read()
        os.unlink(output_path)
        return result
    
    thread = threading.Thread(
        target=_run_task_async,
        args=(task_id, run, [img_tmp.name]),
        daemon=True
    )
    thread.start()
    
    return jsonify({"task_id": task_id}), 202

    response = jsonify({"task_id": task_id})
    response.status_code = 202
    return response

@app.route("/deblur", methods=["POST", "OPTIONS"])
def deblur():
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return "", 200
        
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    task_id = str(uuid.uuid4())
    
    with task_lock:
        task_storage[task_id] = {
            "status": "processing",
            "result": None,
            "error": None,
            "created_at": time.time()
        }
    
    img_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    request.files["image"].save(img_tmp.name)
    prompt = request.form.get("prompt")
    
    def run():
        output_path = run_deblur(
            open(img_tmp.name, "rb"),
            prompt
    
    # Get parameters
    prompt = request.form.get("prompt", "")
    strength = float(request.form.get("strength", 0.35))
    guidance_scale = float(request.form.get("guidance_scale", 4.0))
    steps = int(request.form.get("steps", 40))
    
    def run():
        output_path = run_deblur(
            img_tmp.name,
            prompt,
            strength=strength,
            guidance_scale=guidance_scale,
            num_inference_steps=steps
        )
        with open(output_path, "rb") as f:
            result = f.read()
        os.unlink(output_path)
        return result
    
    thread = threading.Thread(
        target=_run_task_async,
        args=(task_id, run, [img_tmp.name]),
        daemon=True
    )
    thread.start()
    
    return jsonify({"task_id": task_id}), 202

    response = jsonify({"task_id": task_id})
    response.status_code = 202
    return response

@app.route("/describeme", methods=["POST", "OPTIONS"])
def desc():
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return "", 200
        
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    # This one is fast, no need for async
    description = run_describe(request.files["image"])
    return jsonify({"description": description}), 200


@app.route("/api/task/<task_id>", methods=["GET"])
def get_task(task_id):
    """Poll for task status and retrieve result"""
    with task_lock:
        if task_id not in task_storage:
            return jsonify({"error": "Task not found"}), 404
        
        task = task_storage[task_id]
        
        if task["status"] == "processing":
            return jsonify({"status": "processing"}), 202
        elif task["status"] == "completed":
            return send_file(
                BytesIO(task["result"]),
                mimetype="image/png"
            )
        elif task["status"] == "failed":
            return jsonify({"error": task["error"]}), 500


def cleanup_old_tasks():
    """Periodically clean up old completed tasks from memory"""
    current_time = time.time()
    with task_lock:
        expired_tasks = [
            task_id for task_id, task in task_storage.items()
            if current_time - task["created_at"] > MAX_TASK_AGE
        ]
        for task_id in expired_tasks:
            del task_storage[task_id]


# Run cleanup every 5 minutes
@app.before_request
def periodic_cleanup():
    if not hasattr(app, '_cleanup_last_run'):
        app._cleanup_last_run = time.time()
    
    if time.time() - app._cleanup_last_run > 300:  # 5 minutes
        cleanup_old_tasks()
        app._cleanup_last_run = time.time()


@app.route("/api/removebg", methods=["POST"])
def remove_background():
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    try:
        output_path = run_remove_background(request.files["image"])
        return send_file(output_path, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
	app.run(host="0.0.0.0", port=8000)
    image_file = request.files["image"]
    description = run_describe(image_file)

    return jsonify({"description": description}), 200

@app.route("/removebg", methods=["POST", "OPTIONS"])
def remove_background():
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return "", 200
        
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    try:
        output_path = run_remove_background(request.files["image"])
        return send_file(output_path, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/task/<task_id>", methods=["GET", "OPTIONS"])
def get_task(task_id):
    """Poll for task status and retrieve result"""
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return "", 200
        
    with task_lock:
        if task_id not in task_storage:
            return jsonify({"error": "Task not found"}), 404
        
        task = task_storage[task_id]
        
        if task["status"] == "processing":
            response = jsonify({"status": "processing"})
            response.status_code = 202
            return response
        elif task["status"] == "completed":
            return send_file(
                BytesIO(task["result"]),
                mimetype="image/png"
            )
        elif task["status"] == "failed":
            return jsonify({"error": task["error"]}), 500

def cleanup_old_tasks():
    """Periodically clean up old completed tasks from memory"""
    current_time = time.time()
    with task_lock:
        expired_tasks = [
            task_id for task_id, task in task_storage.items()
            if current_time - task["created_at"] > MAX_TASK_AGE
        ]
        for task_id in expired_tasks:
            del task_storage[task_id]

# Run cleanup every 5 minutes
@app.before_request
def periodic_cleanup():
    if not hasattr(app, '_cleanup_last_run'):
        app._cleanup_last_run = time.time()
    
    if time.time() - app._cleanup_last_run > 300:  # 5 minutes
        cleanup_old_tasks()
        app._cleanup_last_run = time.time()

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8000, debug=True)
