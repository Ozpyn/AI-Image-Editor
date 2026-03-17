from flask import Flask, request, jsonify, send_file, send_from_directory
from ai import run_inpaint, run_outpaint, run_deblur, run_describe
import json, os, threading, uuid, time, tempfile
from io import BytesIO

app = Flask(
    __name__,
    static_folder="../frontend/dist",
    static_url_path="/"
)

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


@app.route("/api/hello")
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


@app.route("/api/outpaint", methods=["POST"])
def outpaint():
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


@app.route("/api/describeme", methods=["POST"])
def desc():
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


if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8000)

