from flask import Flask, request, jsonify, send_file, send_from_directory, render_template_string, abort
import json, os, threading, uuid, time, tempfile, re
from io import BytesIO
import markdown

from ai import run_inpaint, run_outpaint, run_deblur, run_describe, run_remove_background, run_replace_background

app = Flask(
    __name__,
    static_folder="../frontend/dist",
    static_url_path="/"
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

DOCS_ROOT = os.path.join(PROJECT_ROOT, "docs")
README_PATH = os.path.join(PROJECT_ROOT, "README.md")

def load_file_safe(base, relative_path):
    full_path = os.path.abspath(os.path.join(base, relative_path))

    if not full_path.startswith(base):
        abort(403)

    if not os.path.exists(full_path):
        abort(404)

    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()


from urllib.parse import urljoin

def rewrite_links(html, current_path):
    def repl(match):
        href = match.group(1)

        if not href.endswith(".md"):
            return match.group(0)

        joined = os.path.normpath(os.path.join(current_path, href))

        if joined in ("README.md", "../README.md"):
            return 'href="/docs"'

        joined = joined.replace("\\", "/")
        joined = joined.lstrip("./")
        joined = joined.replace("docs/", "")

        if joined.endswith(".md"):
            joined = joined[:-3]

        return f'href="/docs/{joined}"'

    return re.sub(r'href="([^"]+)"', repl, html)


def render_md(md_text, current_path=""):
    html = markdown.markdown(
        md_text,
        extensions=["fenced_code", "tables", "codehilite"]
    )
    return rewrite_links(html, current_path)

TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown.min.css">
    <style>
        body {
            background: #fff;
        }
        .markdown-body {
            box-sizing: border-box;
            max-width: 900px;
            margin: auto;
            padding: 2rem;
        }
    </style>
</head>
<body>
    <article class="markdown-body">
        {{ content|safe }}
    </article>
</body>
</html>
"""


@app.route("/docs")
@app.route("/docs/")
def docs_index():
    with open(README_PATH, "r", encoding="utf-8") as f:
        md = f.read()
    return render_template_string(
        TEMPLATE,
        content=render_md(md, "")
    )


@app.route("/docs/<path:doc>")
def docs(doc):
    if not doc.endswith(".md"):
        doc += ".md"

    md = load_file_safe(DOCS_ROOT, doc)

    current_dir = os.path.dirname(doc)

    return render_template_string(
        TEMPLATE,
        content=render_md(md, current_dir)
    )


@app.route("/docs/assets/<path:filename>")
def docs_assets(filename):
    return send_from_directory(os.path.join(DOCS_ROOT, "assets"), filename)


task_storage = {}
MAX_TASK_AGE = 3600  # Keep completed tasks for 1 hour
task_lock = threading.Lock()

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


@app.route("/api/describeme", methods=["POST"])
def desc():
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

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


@app.route("/api/replacebg", methods=["POST"])
def replace_background():
    if "image" not in request.files:
        return jsonify({"error": "image is required"}), 400

    prompt = request.form.get("prompt", "")
    try:
        output_path = run_replace_background(request.files["image"], prompt)
        return send_file(output_path, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
	app.run(host="0.0.0.0", port=8000)
