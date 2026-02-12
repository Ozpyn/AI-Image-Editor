
import { PencilBrush, Textbox, IText } from "fabric";

import { PencilBrush, Textbox, IText } from "fabric";


const toolModes = {
  select: enableSelectMode,
  crop: enableCropMode,
  erase: enableEraseMode,
  text: enableTextMode,
  brush: enableBrushMode, 
};


  text: enableTextMode,
  brush: enableBrushMode, 
};


function enableSelectMode(canvas) {
  canvas.isDrawingMode = false;
  canvas.selection = true;

  // Make all objects selectable
  canvas.forEachObject((obj) => {
    if (obj.data?.role === "mask") {
      obj.selectable = false;
      obj.evented = false;
    } else {
      obj.selectable = true;
      obj.evented = true;
    }
  });

  canvas.requestRenderAll();
}

export function setToolMode(canvas, mode = "select", options = {}) {
export function setToolMode(canvas, mode = "select", options = {}) {
  if (!canvas) return;

  resetCanvasState(canvas);

  const handler = toolModes[mode] ?? enableSelectMode;

  // pass options into the tool enable function
  handler(canvas, options);

  // pass options into the tool enable function
  handler(canvas, options);

  canvas.requestRenderAll();
}



function resetCanvasState(canvas) {
  canvas.isDrawingMode = false;
  canvas.selection = false;

  canvas.off("mouse:down");
  canvas.off("mouse:move");
  canvas.off("mouse:up");
  // Deselect any active object
  canvas.discardActiveObject();

  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });
}

export function fitObjectToCanvas(canvas, obj, padding = 32) {
  if (!canvas || !obj) return;

  const cw = canvas.getWidth();
  const ch = canvas.getHeight();

  const availableW = Math.max(1, cw - padding * 2);
  const availableH = Math.max(1, ch - padding * 2);

  const objW = Math.max(1, obj.width * obj.scaleX);
  const objH = Math.max(1, obj.height * obj.scaleY);

  const scale = Math.min(availableW / objW, availableH / objH);

  obj.scale(obj.scaleX * scale);
  obj.set({
    left: cw / 2,
    top: ch / 2,
    originX: "center",
    originY: "center",
  });

  canvas.requestRenderAll();
}

/**
 * Clear canvas safely.
 */
export function clearCanvas(canvas) {
  if (!canvas) return;
  canvas.getObjects().forEach((o) => canvas.remove(o));
  canvas.requestRenderAll();
}

/**
 * Export canvas to PNG dataURL.
 */
export function exportPNG(canvas, multiplier = 2) {
  if (!canvas) return null;
  return canvas.toDataURL({
    format: "png",
    multiplier,
    enableRetinaScaling: true,
  });
}

/**
 * Set canvas size.
 */
export function setCanvasSize(canvas, width, height) {
  if (!canvas) return;

  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));

  // Fabric v6+ preferred API
  if (typeof canvas.setDimensions === "function") {
    canvas.setDimensions({ width: w, height: h });
  } else {
    // Fabric v4/v5 fallback
    if (typeof canvas.setWidth === "function") canvas.setWidth(w);
    if (typeof canvas.setHeight === "function") canvas.setHeight(h);
  }

  if (typeof canvas.calcOffset === "function") {
    canvas.calcOffset();
  }

  if (typeof canvas.requestRenderAll === "function") {
    canvas.requestRenderAll();
  } else if (typeof canvas.renderAll === "function") {
    canvas.renderAll();
  }
}

function enableCropMode(canvas) {
  // Implement crop mode logic here
  console.log("Crop mode enabled at canvasUtils, code to be added in cropImage.js");
}

// Enable erase mode using fabric's free drawing mode
function enableEraseMode(canvas) {
  console.log(" Erase tool active from canvasUtils.js through useCanvas.jsx by App.jsx");
  // turn off selection to avoid conflicts
  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = true;


  console.log("[ERASE] size:", canvas.getWidth(), canvas.getHeight());
  console.log("[ERASE] drawingMode:", canvas.isDrawingMode);

    // Make everything unselectable while erasing
  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

  const brush = new PencilBrush(canvas);
  brush.width = 50;           // TODO later: controlled by UI slider
  brush.color = "white";      // white = paint mask
  brush.decimate = 0.4;       // smoother paths with fewer points
  canvas.freeDrawingBrush = brush;
  
  console.log("[ERASE] brush:", canvas.freeDrawingBrush);

  canvas.on("path:created", (e) => {
    const path = e.path; 
    path.set({
      selectable: false,
      evented: false,
    });
    e.path.data = { role: "mask" };
    
  });

  canvas.requestRenderAll();
}
function enableTextMode(canvas) {
  console.log("Text tool active from canvasUtils.js through useCanvas.jsx by App.jsx");

  // turn off selection to avoid conflicts while placing text
  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = false;
  canvas.defaultCursor = "text";

  // Make everything unselectable while in text placement mode
  canvas.forEachObject((obj) => {
    if (obj.data?.role === "mask") {
      obj.selectable = false;
      obj.evented = false;
    } else {
      obj.selectable = false;
      obj.evented = false;
    }
  });

  // Helper: cross-version pointer resolve (no canvas.getPointer dependency)
  const getPoint = (opt) => {
    const e = opt?.e;
    return (
      (typeof canvas.getScenePoint === "function" && e ? canvas.getScenePoint(e) : null) ||
      (typeof canvas.getViewportPoint === "function" && e ? canvas.getViewportPoint(e) : null) ||
      opt?.absolutePointer ||
      opt?.pointer ||
      null
    );
  };

  // Prefer Textbox; fallback to IText if needed
  const TextClass = Textbox || IText;

  canvas.on("mouse:down", (opt) => {
    const p = getPoint(opt);
    if (!p) return;

    const textObj = new TextClass("Type here", {
      left: p.x,
      top: p.y,
      width: 260,          
      fontSize: 36,
      fill: "white",
      selectable: true,
      evented: true,
      editable: true,
      originX: "left",
      originY: "top",
    });

    textObj.data = { role: "text" };

    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    canvas.requestRenderAll();

    // enter edit mode immediately if supported
    setTimeout(() => {
      textObj.enterEditing?.();
      textObj.hiddenTextarea?.focus?.();
    }, 0);
  });

  canvas.requestRenderAll();
}
function enableBrushMode(canvas, options = {}) {
  console.log("Brush tool active from canvasUtils.js");

  const {
    color = "#ff3b30", // default brush color
    size = 12,         // default brush size
    decimate = 0.2,    // smoother paths
  } = options;

  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = true;
  canvas.defaultCursor = "crosshair";

  // Make objects unselectable while drawing (same idea as erase)
  canvas.forEachObject((obj) => {
    // you can keep masks unselectable always
    obj.selectable = false;
    obj.evented = false;
  });

  const brush = new PencilBrush(canvas);
  brush.width = size;
  brush.color = color;
  brush.decimate = decimate;
  canvas.freeDrawingBrush = brush;

  // Optional: tag strokes so you can later undo/remove/identify brush paths
  canvas.on("path:created", (e) => {
    const path = e.path;
    path.set({ selectable: false, evented: false });
    path.data = { role: "brush" };
  });

  canvas.requestRenderAll();
}


