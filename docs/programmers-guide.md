[~ Home](../README.md)

# Programmers Guide
The goal of this guide is to allow other people to re-create, continue, or modify the existing project based on the implemented design or potentially using a different language.

## Requirement Definition

### Front End

The frontend is responsible for presenting the editor interface, managing canvas state, exposing manual editing tools, collecting AI settings, exporting image data for backend processing, and applying returned results back to the canvas.

#### Functional requirements

The frontend shall provide the following user-facing functions:

1. Import an image from local storage into the editor canvas.
2. Display a canvas-based editing workspace with menu bar, toolbox, canvas area, and properties panel.
3. Allow the user to select exactly one active tool at a time.
4. Support manual tools for select, crop, rotate, brush, mask, erase, text, heal, and image adjustment.
5. Support AI workflows for inpaint, outpaint, deblur, background removal, and background replacement.
6. Export the visible canvas as a PNG image.
7. Maintain undo and redo history across meaningful canvas edits.
8. Resize the editing surface with the browser layout while keeping the image fitted into view.

#### Inputs and outputs by frontend feature

`File import`

- Input: image file selected by the user.
- Output: a Fabric image object placed on the canvas and fitted to the workspace.

`Select`

- Input: pointer click or drag on an existing object.
- Output: active selection and object transforms such as move or resize.

`Crop`

- Input: crop rectangle placement and confirmation.
- Output: image object updated to the selected crop bounds.

`Rotate`

- Input: rotate left, rotate right, reset rotation, or object rotation handle interaction.
- Output: image angle changed and retained in canvas state.

`Brush`

- Input: color, size, and pointer stroke path.
- Output: freehand path objects drawn onto the canvas.

`Mask`

- Input: mask brush size and pointer stroke path.
- Output: path objects marked with mask metadata so they can be exported separately for inpainting.

`Erase`

- Input: eraser size and pointer movement over brush or mask content.
- Output: selected stroke content removed from the canvas.

`Text`

- Input: pointer click position and typed text.
- Output: editable text object added to the canvas.

`Heal`

- Input: source point, stamp size, flow, and paint path.
- Output: pixel data on the active image updated by clone-style blending.

`Adjust`

- Input: brightness, contrast, and saturation values in the range `-1` to `1`.
- Output: Fabric image filters updated on the current image.

`Inpaint`

- Input: exported image blob, exported mask blob, optional prompt, guidance scale, steps, and seed.
- Output: generated replacement image applied back onto the canvas after the backend task completes.

`Outpaint`

- Input: exported image blob, direction map, and optional prompt.
- Output: expanded image applied back onto the canvas after the backend task completes.

`Deblur`

- Input: exported image blob and optional prompt.
- Output: sharpened image applied back onto the canvas after the backend task completes.

`Background removal`

- Input: image blob from the current canvas image.
- Output: PNG with background removed, applied to the canvas.

`Background replacement`

- Input: image blob and prompt describing the new background.
- Output: PNG with subject preserved and a generated background applied to the canvas.

#### Frontend constraints and behavior

- The application is a single-page React interface.
- The canvas is managed with Fabric, so interactive objects are stored as Fabric objects rather than raw DOM elements.
- Long-running AI operations must not block the browser UI. The client should remain responsive while polling for results.
- Undo and redo should ignore temporary helper objects such as crop overlays and heal source markers.
- Tool settings shown in the properties panel must reflect the active tool.
- Exported mask data must match the image dimensions used for inpainting.

### Back End
The flask definition contains the location of the built front end

#### The following contains definitions for `app.py`

There is a collection of functions built to assist the serving of the documentation associated with this project. `load_safe_file()` ensures it is only loading the docs that match the location of where they are supposed to be: /docs . `rewrite_links()` parses each markdown file and determines if it has links that would route to another markdown file or asset and converts it into a navigable link. `render_md()` applys some extensions to the markdown so that it appears uniform when viewed from the generated links. `TEMPLATE` is more or less just defining how to show the markdown, and what theme to use. `docs_index()` defined the README.md in the root of the project as the entrypoint to documentation and is tied to the route for `/docs`. `docs()` loads each markdown document in the docs folder and provisions a valid url, and is tied to the `/docs/<path:doc>` endpoint. `docs_assets()` is a simple function to allow loading of images or other assets into the markdown files.

There is a `task_storage` object, it holds jobs for a set period of time before disposing of them and its contents.

`make_progress_callback()` is a helper that is a factory function, it binds to a specific task in order to report on its specific progress, allowing the API to return an accurate completion percentage. The function takes in a task_id and reports the task progress.

Next is a blurb that serves the built Single Page Application (the front end), the blurb only functions if the location in the flask definition is correct

`/api/hello` is a simple testing url to verify that the API has indeed started, it only returns a string of text, which flask in turn parses into an html document.

`_run_task_async()` is a helper function that is given the function definition, which it will run, along with the associated task_id. This allows multiple requests to run concurrently.

`inpaint()` is bound to `/api/inpaint`, and it expects to be given an image, the mask of what the user wants to be removed, and an optional prompt. It will save each image as a temporary file. It will then build a function definition to be run asyncronously. The function will return a single inpainted image. The thread is then told to start, and `inpaint()` returns a `202` status code stating that the job has started.

`outpaint()` is bound to `/api/outpaint`, and it expects a single image, directions to expand, and an optional prompt as input. It will save the image as a temporary file and parse the directions to expand in the 4 directions. It will then build a function definition to be run asyncronously. The function will return a single outpainted image. The thread is then told to start, and `outpaint()` returns a `202` status code stating that the job has started.

`deblur()` is bound to `/api/deblur`, and it expects a single image, and an optional prompt as the input. It will save the image as a temporary file. It will then build a function definition to be run asyncronously. The function will return a single deblurred image. The thread is then told to start, and `deblur()` returns a `202` status code stating that the job has started.

`desc()` expects a single image as input. It will run `run_describe()` synchronously, this is because the model is so fast making it async would not be worth it. It will return a single string containing the image's description and code `200`.

`get_task()` requires a task_id. It will then query the task_storage, and will do an action based on the task's status. If the task is in the `processing` state, the function returns the current progress of the task. If state is `complete` the function returns the requested image. `Failed` will return the error encountered. There is also a catch-all for anything unknown.

`cleanup_old_tasks()` is a helper that checks the creation time of a task, determines if it has expired, then deletes the task if it is expired.

`periodic_cleanup()` will run before every request, but will quit until 5 minutes have elapsed since last clean, thus saving resources. Once 5 minutes have passed and the function is called again, task cleaning will occur.

`remove_background()` is bound to the `/api/removebg` endpoint. The function expects a single image as input. And runs `run_remove_background()` synchronously. It will then return the generated image.

#### The following contains definitions for `ai.py`

`logging.set_verbosity_error()` hides warnings from terminal view when running the program. Comment it out if you wish to see the warnings

`DEVICE` identifies what capabilities the program can used based on the hardware it detects.
`DTYPE ` determines what kind of float can be used, float16 is better

`run_inpaint()` expects an image as a filepath, a mask as a filepath, an optional prompt, and an optional callback. Using pillow to open the two images it saves them as image objects. It then determines the original image size so the output can be resized back after processing. It assigns a default empty prompt if none is provided and adjusts the guidance scale accordingly, using a lower value when no prompt is given. It uses the previously defined callback and calculates progress as a percentage based on the current step and total number of inference steps. The Stable Diffusion pipeline is then executed in inference mode. The resulting image is resized to the original dimensions, saved to a temporary file, and the file path is returned.

`run_outpaint()` expects an image filepath, a dictionary describing expansion directions, an optional prompt, and an optional callback. It loads the image and reads directional values, supporting both combined (`x`, `y`) (where the direction to expand up and down is the same value y, and left and right is value x) and individual (`left`, `right`, `top`, `bottom`) inputs. A new larger image canvas is created and the original image is pasted into the correct position. A corresponding mask is generated where the original image area is protected and the new regions are marked for generation. The function then calls `run_inpaint()` with the modified image and mask to fill in the expanded regions. Essentially outpainting is being defined as a convolution of inpainting, as such it can utilize inpaint's percentage based callback.

`run_deblur()` expects an image filepath, an optional prompt, and an optional callback. It loads the image and stores its original size. If no prompt is provided, it uses the captioning model to generate a descriptive prompt automatically. It defines a callback similar to `run_inpaint()` to report progress. The image-to-image pipeline is then executed with a low strength value to preserve the original structure while improving clarity. The result is resized back to the original size, saved to a temporary file, and the file path is returned.

`run_describe()` expects an image filepath and converts the image into the required tensor format using the caption processor. It runs the captioning model in inference mode to generate a textual description of the image, decodes the output tokens into a string, and returns the description directly.

`run_remove_background()` expects an image filepath and loads it in RGBA format to preserve transparency. The image is converted into a byte stream and passed to the background removal library. The processed output is converted back into a PIL image, saved to a temporary file, and the file path is returned.

## Getting Started & Setup

### System Requirements

- [python3](https://www.python.org/downloads/) and Python3-venv (if not included in python3)
- git
- Some kind of web browser
- Optional: [NodeJS](https://nodejs.org/en/download/) (includes npm)

While optional, it is highly recommended to have a dedicated CUDA capable processing unit (e.g. an NVIDIA GPU)

### Clone the repository

```
git clone https://github.com/Ozpyn/AI-Image-Editor.git
```

### Running the project

While not strictly required, I would recommend setting up and enabling a python virtual environment, purely so that this project will be isolated and will not affect your system packages.

This project supports two options for node, an official installation that includes npm (listed above) or a python package called `nodeenv`. `nodeenv` allows you to treat node like a python virtual environment, completely isolated.

To install nodeenv:
```
pip install nodeenv
```

#### MacOS Known Issue: NodeEnv blocked

For some reason when installing NodeEnv from pip macos will prevent it from running and say it is malware, this is inaccurate. The fix to this is to install NodeEnv using brew: [NodeEnv](https://github.com/nodenv/nodenv)

```
brew install nodenv
```

Build and enable the nodeenv:
```
cd frontent/ &&
nodeenv env &&
source env/bin/activate
```

The main difference between development and production environments is the way in which the front end is made: build or dev.

```
npm install &&
npm run dev
```

It is recommended to open another terminal, repeating the previous steps in order to run the backend.

At this point you should install pytorch for your specific hardware: [PyTorch](https://pytorch.org/get-started/locally/)
You will also need to choose and install Rembg for your hardware: [Rembg](https://github.com/danielgatis/rembg)

You now only need a few more packages, all of which exist in requirements.txt:
```
pip install -r srv/requirements.txt
```
Last, but certainly not least, you need to run the backend: 
```
python3 srv/app.py
```


## Architecture & Design
The figure below shows the high level architecture of the project. The frontend handles user interactions and canvas management, while the backend processes AI tasks asynchronously and serves results back to the frontend. The application code is organized into separate modules for clarity and maintainability, with clear interfaces between the frontend and backend through API endpoints. App.jsx serves as the main entry point for the React application, managing global state and routing. The `useCanvas` hook encapsulates all canvas-related logic, while `useAiFeatures` manages interactions with the backend AI endpoints. On the backend, `app.py` defines API routes and task management, while `ai.py` contains the core logic for each AI feature. This modular design allows for easy extension and maintenance of both frontend and backend components.
![bg fit](assets/app-overview-flow.png)
When a user interacts with the frontend from the menu bar or properties panel, the React state is updated to reflect the active tool and its settings. The infromation is sent to App.jsx, which passes the relevant data down to the `useCanvas` hook. The `useCanvas` hook then updates the Fabric canvas accordingly, whether that means changing the cursor for a new tool, applying brush strokes, or exporting the current canvas state as blobs for AI processing. When an AI feature is activated, the frontend sends the image and mask blobs to the backend API. The backend processes the request asynchronously, updating the task status in `task_storage`. The frontend polls for task completion and applies the resulting image back onto the canvas once ready. This flow ensures a responsive user experience while handling potentially time-consuming AI operations in the background.

### Front End Architecture

The frontend is structured around a small set of React components and two main hooks:

1. `App.jsx` owns shared UI state such as the active tool, brush settings, AI parameters, and the `canvasActions` object exposed by the canvas hook.
2. Layout components in `frontend/src/components/layout/` render the visible interface:
   - `menuBar.jsx` handles file import, AI tool selection, export, undo, and redo.
   - `toolBox.jsx` renders the manual tools and context-specific controls for brush, rotate, mask, and erase workflows.
   - `canvasArea.jsx` mounts the actual HTML canvas, handles resizing, and exposes buttons for import, clear, crop apply, crop cancel, zoom, and fit.
   - `propertiesPanel.jsx` renders the right-side settings for brush, heal, adjust, and AI tools.
3. `useCanvas.jsx` is the main stateful controller for the Fabric canvas. It initializes Fabric, registers tool behavior, stores history stacks, exposes canvas actions, and keeps zoom and adjustments synchronized with the UI.
4. `canvasUtils.js` contains lower-level canvas operations such as tool-mode setup, crop logic, heal logic, export helpers, zoom helpers, image fitting, rotation, and result application.
5. `useAiFeatures.jsx` is the client-side integration layer for backend AI routes. It exports the current canvas state to blobs, sends requests, polls asynchronous jobs where required, and applies the returned image back to the canvas.

#### Frontend data flow

The normal frontend data flow is:

1. The user selects a tool or changes a setting in a visible React component.
2. `App.jsx` stores that setting in React state.
3. The state is passed into `CanvasArea`, which passes it into `useCanvas`.
4. `useCanvas` updates the Fabric canvas by calling helpers in `canvasUtils.js`.
5. If the action is AI-driven, `useAiFeatures.jsx` exports the image or mask from the Fabric canvas, calls the backend route, then applies the returned PNG back through `applyBlobResult`.

#### Key frontend files

- `frontend/src/App.jsx`: top-level state coordination.
- `frontend/src/features/canvas/useCanvas.jsx`: canvas lifecycle, history, exposed actions.
- `frontend/src/features/canvas/canvasUtils.js`: shared canvas algorithms and tool implementations.
- `frontend/src/features/canvas/loadImage.js`: blob and image loading utilities.
- `frontend/src/features/aiFeatures/useAiFeatures.jsx`: API integration and asynchronous task polling.
- `frontend/src/components/layout/*.jsx`: visible editor panels and controls.

## Technical Documentation
Below is a flow chart that shows the flow of data and function calls for a single AI operation, in this case inpainting. The user initiates the inpaint action from the frontend, which triggers a series of function calls that ultimately result in the processed image being applied back to the canvas.
![bg fit](assets/inpaint-flow.png)

For Undo, Redo operations, the flow is more straightforward. When the user performs an action that modifies the canvas, a snapshot of the current state is pushed onto the undo stack.
Below is a pseudocode representation of the undo/redo flow:
```javascript
Algorithm: performAction(argumentType)

Begin
    Snapshot <- Canvas.currentState
    HistoryStack.push(Snapshot)
    SnapshotCount <- SnapshotCount + 1

    Apply Action(argumentType) -> Canvas
    CanvasRender <- CanvasRender + 1

    If ActionSuccess = true Then
        ResultState <- Canvas.updatedState
        RedoStack <- empty
        UndoPointer <- UndoPointer + 1
        Return ResultState
    Else
        Return ErrorState
    End If
End

```  
 If the user clicks undo, the most recent snapshot is popped from the undo stack and applied to the canvas, while also being pushed onto the redo stack. If redo is clicked, the process is reversed. This allows users to easily navigate through their editing history without worrying about complex state management, as all snapshots are stored as simple JSON representations of the canvas state.

### Front End Implementation Notes

The frontend uses React for UI state management and Fabric for interactive canvas behavior.

- React state in `App.jsx` stores tool selection and tool settings. This keeps the visible controls and canvas behavior synchronized.
- `useCanvas.jsx` exposes an `actions` object so other components can trigger canvas operations without owning Fabric directly.
- History snapshots are serialized as JSON strings rather than copied object graphs. This keeps undo and redo implementation simple and makes state restoration predictable.
- Helper artifacts such as crop overlays and heal source markers are excluded from history to avoid noisy undo behavior.
- AI exports are split into two types:
  - full image export for deblur, outpaint, description, and background tools
  - image plus mask export for inpainting
- For asynchronous backend routes, the frontend expects a `202` response with a `task_id`, then polls `/api/task/<task_id>` until the PNG result is available.
- Background removal and background replacement currently use direct requests rather than the async polling flow used by inpaint, outpaint, and deblur.

### Front End Testing Considerations

The current project does not include an automated frontend test suite, so validation is largely manual.

Recommended manual test cases:

1. Import an image and confirm it fits into the canvas correctly.
2. Draw with brush, mask, erase, and text tools, then verify undo and redo for each.
3. Crop and rotate an image, then export and verify the output.
4. Run inpaint with a small mask and confirm the returned image applies to the canvas.
5. Run outpaint in one direction and verify the output dimensions visibly increase.
6. Run deblur and confirm the returned image replaces the current one.
7. Run background removal and replacement and confirm the result applies without breaking history.
8. Resize the browser window and confirm the stage resizes without losing the current canvas state.
## Maintenance and Future Work
This section helps future programmers fix bugs and extend the project quickly.

### How the software is organized

1. Frontend (`frontend/`): React UI + Fabric canvas tools.
2. Backend (`srv/`): Flask API + AI model functions.

The frontend sends image/mask data to backend endpoints. Slow AI jobs return `202` with a `task_id`, and the frontend polls `/api/task/<task_id>` until task completion.

### Important functions to know

#### Frontend

* `useCanvas` in `frontend/src/features/canvas/useCanvas.jsx`
    1. Main canvas controller (tools, zoom, import/export, undo/redo).
    2. History logic: `pushHistorySnapshot()` and `restoreSnapshot()`.

* `setToolMode` in `frontend/src/features/canvas/canvasUtils.js`
    1. Switches tool behavior (select, brush, crop, heal, rotate, mask, erase, text).
    2. Export helpers create blobs for backend AI calls.

* `useAiFeatures` in `frontend/src/features/aiFeatures/useAiFeatures.jsx`
    1. API wrappers: `inpaintFromCanvas`, `outpaintFromCanvas`, `deblurFromCanvas`, `describeFromCanvas`, `removeBackground`, `replaceBackground`.
    2. Polling logic: `pollTaskResult()` and `fetchBlob()`.

#### Backend

* `srv/app.py`
    1. Main API routes and async task handling.
    2. `task_storage` keeps temporary task state.
    3. `_run_task_async()` runs model work in background threads.

* `srv/ai.py`
    1. Model functions: `run_inpaint`, `run_outpaint`, `run_deblur`, `run_describe`, `run_remove_background`, `run_replace_background`.
    2. `DEVICE` and `DTYPE` choose hardware mode.

### Key data structures

Backend task record (`task_storage[task_id]`):

```python
{
  "status": "processing" | "completed" | "failed",
  "result": bytes | None,
  "error": str | None,
  "created_at": float,
  "progress": int
}
```

Frontend canvas state stores custom fields like:

1. `canvas.__fitScale`, `canvas.__zoomLevel`
2. `canvas.__adjustments`
3. `canvas.__toolHandlers`
4. Undo/redo stacks in `undoStackRef.current` and `redoStackRef.current`

### Common maintenance issues

1. `task_storage` is in-memory only (not durable across restarts/multi-worker setups).
4. Temporary output cleanup is incomplete in some routes.
5. Excessive VRAM Usage, likely need to use smaller models or memory efficient xformers.

### Safe extension checklist

For a new AI feature:

1. Add model function in `srv/ai.py`.
2. Add route in `srv/app.py`.
3. Use async task flow for long jobs.
4. Add frontend wrapper in `useAiFeatures.jsx`.
5. Add UI controls in menu/properties panel.
6. Verify undo/redo and result apply behavior.

For a new manual tool:

1. Add/update tool mode in `canvasUtils.js`.
2. Wire tool state in `App.jsx`.
3. Add tool controls in UI.
4. Mark helper objects as transient so history is not polluted.

### Future work

1. Replace in-memory task threads with a durable queue (Redis + worker).
2. Standardize API input fields and output format across endpoints.
3. Add a real layer system (visibility, lock, blend modes).
4. Improve mask editing (feather, edge refine, lasso/polygon).
5. Add multiple export formats.
6. Add drag-and-drop and clipboard image input.
7. Add containerized deployment and CI for Linux/macOS/Windows.
8. Add backend and frontend integration tests for core flows.
