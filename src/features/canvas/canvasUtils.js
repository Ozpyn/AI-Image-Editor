

/** Will have all canvas related utility functions like fitting objects, clearing canvas, exporting, zoom
 * Fit a fabric object (typically an image) into the canvas bounds with padding.
 * 
 * You'll notice some functions starts with "export" because they could be could by 
 * any component or feature e.g fitObjectToCanvas 
 * others that modify canvas state by clicking on tools are called by setToolMode
 */
import { PencilBrush } from "fabric";

const toolModes = {
  select: enableSelectMode,
  crop: enableCropMode,
  erase: enableEraseMode,
  //text: enableTextMode,
}
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

export function setToolMode(canvas, mode = "select") {
  
  if (!canvas) return;

  //First Reset canvas to neutral state
  resetCanvasState(canvas);

  // Enable the requested tool mode
  const handler = toolModes[mode] ?? enableSelectMode;

  //call the handler function 
  handler(canvas);
  
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

  // Hey, canvas, listen for when user does "path:created", do {}
  //other event options: "path:created", "path:updated", "path:removed", mouse:down, mouse:move, mouse:up
  canvas.on("path:created", (e) => {
    const path = e.path; 
    path.set({
      selectable: false,
      evented: false,
    });
    e.path.data = { role: "mask" };
    // Optional: make mask visible overlay look nicer
    // NOTE: This path is white. If you want red overlay, set path.stroke = "rgba(255,0,0,0.45)" AND store true mask separately later.
  });

  canvas.requestRenderAll();
}


