
import { PencilBrush, Textbox, IText } from "fabric";


const toolModes = {
  select: enableSelectMode,
  crop: enableCropMode,
  erase: enableEraseMode,
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

// canvasUtils.js
import { PencilBrush, Textbox } from "fabric";
import { fabricImageFromURL } from "./loadImage";

/* =========================================================
   Core helpers
========================================================= */

export function setCanvasSize(canvas, w, h) {
  if (!canvas) return;
  canvas.setDimensions({
    width: w,
    height: h,
  });
  canvas.calcOffset();
  canvas.requestRenderAll();
}

export function clearCanvas(canvas) {
  if (!canvas) return;

  resetCanvasState(canvas);

  const handler = toolModes[mode] ?? enableSelectMode;

  // pass options into the tool enable function
  handler(canvas, options);

  canvas.getObjects().forEach((obj) => canvas.remove(obj));
  canvas.discardActiveObject();
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

export function exportPNG(canvas, multiplier = 1) {
  if (!canvas) return null;
  return canvas.toDataURL({
    format: "png",
    multiplier,
    enableRetinaScaling: false,//to avoid computer export size mismatch
  });
}

export function fitObjectToCanvas(canvas, obj, padding = 32) {
  if (!canvas || !obj) return;

  const cw = canvas.getWidth();
  const ch = canvas.getHeight();

  const maxW = Math.max(1, cw - padding * 2);
  const maxH = Math.max(1, ch - padding * 2);

  // Ensure dimensions are up-to-date
  obj.setCoords();
  const ow = obj.getScaledWidth();
  const oh = obj.getScaledHeight();

  // If image has no scaled size yet, compute from intrinsic
  const baseW = ow || obj.width || 1;
  const baseH = oh || obj.height || 1;

  const scale = Math.min(maxW / baseW, maxH / baseH);

  obj.set({
    scaleX: scale,
    scaleY: scale,
    left: cw / 2,
    top: ch / 2,
    originX: "center",
    originY: "center",
  });

  obj.setCoords();
  canvas.requestRenderAll();
}

/* =========================================================
   Tool system
========================================================= */

function resetCanvasState(canvas) {
  if (!canvas) return;

  canvas.isDrawingMode = false;
  canvas.selection = false;

  // Prevent stacking listeners across tool switches
  canvas.off("mouse:down");
  canvas.off("mouse:move");
  canvas.off("mouse:up");
  canvas.off("path:created");

  canvas.discardActiveObject();

  // Default everything non-interactive; modes can re-enable selectively
  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

  canvas.defaultCursor = "default";
  canvas.requestRenderAll();
}

const toolModes = {
  select: enableSelectMode,
  crop: enableCropMode,
  erase: enableEraseMode,
  text: enableTextMode,
  brush: enableBrushMode,
};

export function setToolMode(canvas, mode = "select", options = {}) {
  if (!canvas) return;

  resetCanvasState(canvas);

  const handler = toolModes[mode] ?? enableSelectMode;
  handler(canvas, options);

  canvas.requestRenderAll();
}

/* =========================================================
   Select mode
========================================================= */

function enableSelectMode(canvas) {
  canvas.selection = true;
  canvas.defaultCursor = "default";

  canvas.forEachObject((obj) => {
    // Keep mask paths non-interactive by default
    const isMask = obj?.data?.role === "mask";
    obj.selectable = !isMask;
    obj.evented = !isMask;
  });

  canvas.requestRenderAll();
}

/* =========================================================
   Crop mode (placeholder)
   You can replace with your real crop implementation later.
========================================================= */

function enableCropMode(canvas) {
  canvas.selection = false;
  canvas.defaultCursor = "crosshair";
  canvas.requestRenderAll();
}

/* =========================================================
   Brush mode (draws normal strokes)
========================================================= */

function enableBrushMode(canvas, options = {}) {
  const { color = "#ff3b30", size = 12, decimate = 0.4 } = options;

  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = true;
  canvas.defaultCursor = "crosshair";

  const brush = new PencilBrush(canvas);
  brush.color = color;
  brush.width = size;
  brush.decimate = decimate;
  canvas.freeDrawingBrush = brush;

  // (Optional) tag brush strokes if you want later
  canvas.off("path:created");
  canvas.on("path:created", (e) => {
    if (!e?.path) return;
    e.path.set({ selectable: false, evented: false });
    // e.path.data = { role: "brush" };
  });

  canvas.requestRenderAll();
}

/* =========================================================
   Erase mode (REAL erase)
   Uses destination-out so strokes erase underlying pixels during render/export.
========================================================= */

function enableEraseMode(canvas, options = {}) {
  const { size = 40, decimate = 0.4 } = options;

  console.log("Erase tool active (destination-out)");

  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = true;
  canvas.defaultCursor = "crosshair";

  const eraser = new PencilBrush(canvas);
  eraser.width = size;
  eraser.color = "rgba(0,0,0,1)"; // color doesn't matter with destination-out
  eraser.decimate = decimate;
  canvas.freeDrawingBrush = eraser;

  canvas.off("path:created");
  canvas.on("path:created", (e) => {
    const path = e?.path;
    if (!path) return;

    // This is the key: erase underlying pixels during drawing/render.
    path.set({
      selectable: false,
      evented: false,
      globalCompositeOperation: "destination-out",
    });

    // Make sure it stays on top so it erases what's beneath
    canvas.bringObjectToFront(path);
    canvas.requestRenderAll();
  });

  canvas.requestRenderAll();
}

/* =========================================================
   Text mode
========================================================= */

function enableTextMode(canvas, options = {}) {
  const {
    fill = "#ffffff",
    fontSize = 36,
    fontFamily = "Inter, system-ui, sans-serif",
  } = options;

  canvas.selection = false;
  canvas.defaultCursor = "text";

  canvas.on("mouse:down", (opt) => {
    const p = canvas.getScenePoint(opt.e);

    const tb = new Textbox("Type here", {
      left: p.x,
      top: p.y,
      fill,
      fontSize,
      fontFamily,
      editable: true,
      selectable: true,
      evented: true,
      originX: "left",
      originY: "top",
    });

    canvas.add(tb);
    canvas.setActiveObject(tb);
    tb.enterEditing();
    tb.selectAll();

    canvas.requestRenderAll();
  });
}

/* =========================================================
   AI bridge utilities (no AI tool logic here)
========================================================= */

function dataURLToBlob(dataURL) {
  const [header, base64] = dataURL.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/png";
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// 1) Export full canvas as PNG blob
export function exportPNGBlob(canvas, multiplier = 1) {
  const dataURL = exportPNG(canvas, multiplier);
  return dataURL ? dataURLToBlob(dataURL) : null;
}

// 2) Export mask blob from objects tagged { data: { role: "mask" } }
export function exportMaskBlob(canvas, multiplier = 1) {
  if (!canvas) return null;

  const originalBg = canvas.backgroundColor;
  const originals = [];

  canvas.getObjects().forEach((obj) => {
    const isMask = obj?.data?.role === "mask";
    originals.push({
      obj,
      visible: obj.visible,
      opacity: obj.opacity,
      stroke: obj.stroke,
      fill: obj.fill,
      gco: obj.globalCompositeOperation,
    });

    if (!isMask) {
      obj.visible = false;
    } else {
      // Force solid white strokes for mask export
      obj.visible = true;
      obj.opacity = 1;
      obj.stroke = "white";
      obj.fill = null;
      obj.globalCompositeOperation = "source-over"; // ensure mask draws normally
    }
  });

  canvas.backgroundColor = "black";
  canvas.requestRenderAll();
}




  try {
    const dataURL = canvas.toDataURL({
      format: "png",
      multiplier,
      enableRetinaScaling: true,
    });
    return dataURL ? dataURLToBlob(dataURL) : null;
  } finally {
    originals.forEach(({ obj, visible, opacity, stroke, fill, gco }) => {
      obj.visible = visible;
      obj.opacity = opacity;
      obj.stroke = stroke;
      obj.fill = fill;
      obj.globalCompositeOperation = gco;
    });

    canvas.backgroundColor = originalBg;
    canvas.requestRenderAll();
  }
}

// 3) Apply backend result blob onto the canvas
export async function applyResultBlob(
  canvas,
  blob,
  { mode = "replace", padding = 32 } = {}
) {
  if (!canvas || !blob) return;

  const url = URL.createObjectURL(blob);

  try {
    const img = await fabricImageFromURL(url, { selectable: true, evented: true });

    if (mode === "replace") {
      clearCanvas(canvas);
      canvas.add(img);
      fitObjectToCanvas(canvas, img, padding);
      canvas.setActiveObject(img);
    } else if (mode === "newLayer") {
      canvas.add(img);
      fitObjectToCanvas(canvas, img, padding);
      canvas.setActiveObject(img);
    } else {
      canvas.add(img);
      fitObjectToCanvas(canvas, img, padding);
      canvas.setActiveObject(img);
    }

    canvas.requestRenderAll();
  } finally {
    URL.revokeObjectURL(url);
  }
}