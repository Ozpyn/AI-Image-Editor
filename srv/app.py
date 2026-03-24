"""Documentation: When a user imports a 3000×2000px image, it's scaled down to fit the canvas (e.g., 800×533px) for display only.
The outpainting process works with the original full-resolution image—so when a user sets left=200px, right=200px, top=100px, 
bottom=100px in the ExtendPanel, the AI generates a new 3400×2200px image by adding those pixel values to the original dimensions.
The result is then scaled back down to fit the canvas view, but the actual image data is now larger.
 """
from flask import Flask, request, jsonify, send_file, send_from_directory
from ai import run_inpaint, run_outpaint, run_deblur, run_describe, run_remove_background
import json, os

app = Flask(
    __name__,
    static_folder="../frontend/dist",
    static_url_path="/"
)

task_storage = {}
MAX_TASK_AGE = 3600  # Keep completed tasks for 1 hour
task_lock = threading.Lock()

# Task completion estimate helper
def make_progress_callback(task_id):
    def progress_update(p):
        with task_lock:
            if task_id in task_storage:
                task_storage[task_id]["progress"] = p
    return progress_update

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
        progress_callback = make_progress_callback(task_id)
        output_path = run_inpaint(
            open(img_tmp.name, "rb"),
            open(mask_tmp.name, "rb"),
            prompt,
            progress_callback=progress_callback
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


@app.route("/outpaint", methods=["POST", "OPTIONS"])
def outpaint():
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
    
    print(f"Saved outpaint image to: {img_tmp.name}")
    
    # Get parameters
    prompt = request.form.get("prompt", "")
    guidance_scale = float(request.form.get("guidance_scale", 7.5))
    steps = int(request.form.get("steps", 40))
    seed = int(request.form.get("seed", -1))
    
    # Get expansion directions (left, right, top, bottom)
    left = int(request.form.get("left", 100))
    right = int(request.form.get("right", 100))
    top = int(request.form.get("top", 100))
    bottom = int(request.form.get("bottom", 100))
    
    directions = {
        "left": left,
        "right": right,
        "top": top,
        "bottom": bottom
    }
    
    print(f"Outpaint params: prompt='{prompt}', directions={directions}, guidance_scale={guidance_scale}, steps={steps}, seed={seed}")
    
    def run():
        try:
            output_path = run_outpaint(
                img_tmp.name,
                directions,
                prompt,
                guidance_scale=guidance_scale,
                num_inference_steps=steps,
                seed=seed
            )
            
            print(f"Outpaint output path: {output_path}")
            
            # Verify the output file exists
            if not os.path.exists(output_path):
                raise Exception("Output file was not created")
                
            with open(output_path, "rb") as f:
                result = f.read()
            
            # Verify the result is valid
            if not result or len(result) == 0:
                raise Exception("Output file is empty")
                
            print(f"Outpaint result size: {len(result)} bytes")
            
            # Clean up output file
            try:
                os.unlink(output_path)
            except:
                pass
                
            return result
        except Exception as e:
            print(f"Error in outpaint run function: {str(e)}")
            traceback.print_exc()
            raise e
    
    thread = threading.Thread(
        target=_run_task_async,
        args=(task_id, run, [img_tmp.name]),
        daemon=True
    )
    thread.start()
    
    response = jsonify({"task_id": task_id})
    response.status_code = 202
    return response

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
        progress_callback = make_progress_callback(task_id)
        output_path = run_outpaint(
            open(img_tmp.name, "rb"),
            directions_data,
            prompt,
            progress_callback=progress_callback
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


@app.route("/api/deblur", methods=["POST"])
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
        progress_callback = make_progress_callback(task_id)
        output_path = run_deblur(
            open(img_tmp.name, "rb"),
            prompt,
            progress_callback=progress_callback
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
                mimetype="image/png",
                download_name="result.png"
            )
        elif task["status"] == "failed":
            return jsonify({"error": task["error"]}), 500

    # This one is fast, no need for async or for a progress updater
    description = run_describe(request.files["image"])
    return jsonify({"description": description}), 200


@app.route("/api/task/<task_id>", methods=["GET"])
def get_task(task_id):
    """Poll for task status and retrieve result"""
    with task_lock:
        if task_id not in task_storage:
            return jsonify({"error": "Task not found"}), 404
        
        task = task_storage[task_id]
        
        match task["status"]:
            case "processing":
                return jsonify({
                    "status": "processing",
                    "progress": task.get("progress", 0)
                }), 202
            case "completed":
                return send_file(BytesIO(task["result"]), mimetype="image/png")
            case "failed":
                return jsonify({"error": task["error"]}), 500
            case _:
                return jsonify({"error": "Unknown task status"}), 500


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