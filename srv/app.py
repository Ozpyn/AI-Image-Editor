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

task_storage = {}
MAX_TASK_AGE = 3600  # Keep completed tasks for 1 hour
task_lock = threading.Lock()

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
    # This one is fast, no need for async
    # This one is fast, no need for async
    description = run_describe(request.files["image"])

    return jsonify ({"description": description}), 200

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