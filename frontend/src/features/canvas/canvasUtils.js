// canvasUtils.js
import { PencilBrush, Textbox } from "fabric";
import { fabricImageFromURL } from "./loadImage";

/* =========================================================
   Core helpers
========================================================= */

//We need the user to draw around where they want the inpainting to happen
//so we can create a mask by leaving that place white and other places black 

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
  canvas.getObjects().forEach((obj) => canvas.remove(obj));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

export function clearMaskObjects(canvas) {
  if (!canvas) return;
  const maskObjects = canvas.getObjects().filter(obj => obj?.data?.role === "mask");
  maskObjects.forEach((obj) => canvas.remove(obj));
  canvas.requestRenderAll();
  console.log(`Cleared ${maskObjects.length} mask object(s)`);
}

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

export function getBaseImageObject(canvas) {
  if (!canvas) return null;
  
  const objects = canvas.getObjects();
  // Find first object that's not a mask and has width/height (likely the base image)
  for (const obj of objects) {
    const isMask = obj?.data?.role === "mask";
    const isPath = obj.type === "path"; // Brush/mask strokes
    if (!isMask && !isPath && obj.width && obj.height) {
      console.log("Found base image object:", {
        type: obj.type,
        width: obj.width,
        height: obj.height,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        hasElement: !!obj._element,
        hasOriginalElement: !!obj._originalElement,
      });
      return obj;
    }
  }
  return null;
}

export function getOriginalImageDimensions(imageObj) {
  if (!imageObj) return null;
  
  const element = imageObj._element || imageObj._originalElement;
  if (element && element.naturalWidth && element.naturalHeight) {
    return {
      width: element.naturalWidth,
      height: element.naturalHeight,
    };
  }
  return {
    width: imageObj.width,
    height: imageObj.height,
  };
}

export function getOriginalSizeMultiplier(canvas) {
  const baseImage = getBaseImageObject(canvas);
  if (!baseImage) return 1;

  const originalDims = getOriginalImageDimensions(baseImage);
  if (!originalDims) return 1;
  
  const originalW = originalDims.width;
  const originalH = originalDims.height;
  
  const canvasW = canvas.getWidth();
  const canvasH = canvas.getHeight();
  
  const imageScaledW = baseImage.getScaledWidth();
  const imageScaledH = baseImage.getScaledHeight();
  
  const multiplierW = originalW / imageScaledW;
  const multiplierH = originalH / imageScaledH;
  
  const multiplier = (multiplierW + multiplierH) / 2;
  
  console.log("Original size calculation:", {
    original: { width: originalW, height: originalH },
    canvas: { width: canvasW, height: canvasH },
    imageScaled: { width: Math.round(imageScaledW), height: Math.round(imageScaledH) },
    multipliers: { width: multiplierW.toFixed(3), height: multiplierH.toFixed(3) },
    calculatedMultiplier: multiplier,
    exportSize: { 
      width: Math.round(canvasW * multiplier), 
      height: Math.round(canvasH * multiplier) 
    },
    expectedImageSize: {
      width: Math.round(imageScaledW * multiplier),
      height: Math.round(imageScaledH * multiplier)
    }
  });
  
  return multiplier;
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
  mask: enableMaskMode,
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
   Mask mode (draws white strokes for AI inpainting)
   Creates paths tagged with data.role = "mask"
========================================================= */

function enableMaskMode(canvas, options = {}) {
  const { size = 40, decimate = 0.4 } = options;

  console.log("Mask tool active - drawing mask for inpainting");

  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = true;
  canvas.defaultCursor = "crosshair";

  const maskBrush = new PencilBrush(canvas);
  maskBrush.color = "rgba(255, 255, 255, 0.6)"; // Semi-transparent white for visibility
  maskBrush.width = size;
  maskBrush.decimate = decimate;
  canvas.freeDrawingBrush = maskBrush;

  canvas.off("path:created");
  canvas.on("path:created", (e) => {
    const path = e?.path;
    if (!path) return;

    path.set({
      selectable: false,
      evented: false,
      stroke: "rgba(255, 255, 255, 0.6)", // Semi-transparent for editing
      strokeWidth: size,
    });
    
    path.data = { role: "mask" };

    console.log("Mask stroke created and tagged");
    canvas.requestRenderAll();
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
export async function exportPNGBlob(canvas, multiplier = 1, useOriginalSize = false) {
  if (!canvas) return null;
  
  if (useOriginalSize) {
    return await exportImageAtOriginalSize(canvas);
  }
  
  console.log("Exporting PNG - Canvas dimensions:", {
    width: canvas.getWidth(),
    height: canvas.getHeight(),
    multiplier,
    useOriginalSize,
    finalWidth: canvas.getWidth() * multiplier,
    finalHeight: canvas.getHeight() * multiplier
  });
  
  const dataURL = exportPNG(canvas, multiplier);
  return dataURL ? dataURLToBlob(dataURL) : null;
}

async function exportImageAtOriginalSize(canvas) {
  const baseImage = getBaseImageObject(canvas);
  if (!baseImage) {
    console.warn("No base image found, falling back to canvas export");
    return await exportPNGBlob(canvas, 1, false);
  }
  
  const originalDims = getOriginalImageDimensions(baseImage);
  if (!originalDims) {
    console.warn("Could not get original dimensions, falling back");
    return await exportPNGBlob(canvas, 1, false);
  }
  
  const { width: origW, height: origH } = originalDims;
  const element = baseImage._element || baseImage._originalElement;
  
  console.log("Exporting image at original size:", {
    original: { width: origW, height: origH },
    method: "drawImage to fixed-size canvas"
  });

  if (!element) {
    console.warn("Base image element missing, falling back to object.toDataURL");
    const fallbackDataURL = baseImage.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
      enableRetinaScaling: false,
      width: origW,
      height: origH,
    });
    return fallbackDataURL ? dataURLToBlob(fallbackDataURL) : null;
  }

  const out = document.createElement("canvas");
  out.width = origW;
  out.height = origH;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(element, 0, 0, origW, origH);

  const dataURL = out.toDataURL("image/png");
  
  return dataURL ? dataURLToBlob(dataURL) : null;
}

// 2) Export mask blob from objects tagged { data: { role: "mask" } }
export async function exportMaskBlob(canvas, multiplier = 1, useOriginalSize = false) {
  if (!canvas) return null;

  // If useOriginalSize, export mask at original image dimensions
  if (useOriginalSize) {
    return await exportMaskAtOriginalSize(canvas);
  }

  console.log("Exporting Mask - Canvas dimensions:", {
    width: canvas.getWidth(),
    height: canvas.getHeight(),
    multiplier,
    useOriginalSize,
    finalWidth: canvas.getWidth() * multiplier,
    finalHeight: canvas.getHeight() * multiplier
  });

  const originalBg = canvas.backgroundColor;
  const originals = [];
  
  let maskObjectCount = 0;

  canvas.getObjects().forEach((obj) => {
    const isMask = obj?.data?.role === "mask";
    if (isMask) maskObjectCount++;
    
    originals.push({
      obj,
      visible: obj.visible,
      opacity: obj.opacity,
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth,
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
      obj.strokeWidth = obj.strokeWidth || 1; // Ensure stroke width is set
      obj.fill = null;
      obj.globalCompositeOperation = "source-over"; // ensure mask draws normally
    }
  });
  
  console.log("Mask objects found:", maskObjectCount);
  if (maskObjectCount === 0) {
    console.warn("No mask objects found! (objects with data.role === 'mask')");
  }

  canvas.backgroundColor = "black";
  canvas.requestRenderAll();

  try {
    const dataURL = canvas.toDataURL({
      format: "png",
      multiplier,
      enableRetinaScaling: false, // Match exportPNG to ensure same dimensions
    });
    return dataURL ? dataURLToBlob(dataURL) : null;
  } finally {
    originals.forEach(({ obj, visible, opacity, stroke, strokeWidth, fill, gco }) => {
      obj.visible = visible;
      obj.opacity = opacity;
      obj.stroke = stroke;
      obj.strokeWidth = strokeWidth;
      obj.fill = fill;
      obj.globalCompositeOperation = gco;
    });

    canvas.backgroundColor = originalBg;
    canvas.requestRenderAll();
  }
}

/**
 * Export mask at original image size (not canvas size)
 * Ensures mask dimensions match the original image exactly by cropping
 */
async function exportMaskAtOriginalSize(canvas) {
  if (!canvas) return null;
  
  const baseImage = getBaseImageObject(canvas);
  if (!baseImage) {
    console.warn("No base image found for mask export");
    return await exportMaskBlob(canvas, 1, false);
  }
  
  const originalDims = getOriginalImageDimensions(baseImage);
  if (!originalDims) {
    console.warn("Could not get original dimensions for mask");
    return await exportMaskBlob(canvas, 1, false);
  }
  
  const { width: origW, height: origH } = originalDims;
  const imageBounds = baseImage.getBoundingRect();
  const boundsW = Math.max(1, imageBounds.width);
  const boundsH = Math.max(1, imageBounds.height);
  const multiplierW = origW / boundsW;
  const multiplierH = origH / boundsH;
  const multiplier = (multiplierW + multiplierH) / 2;
  
  console.log("Exporting mask at original image size:", {
    original: { width: origW, height: origH },
    imageBounds: {
      left: imageBounds.left,
      top: imageBounds.top,
      width: boundsW,
      height: boundsH,
    },
    multipliers: {
      width: multiplierW,
      height: multiplierH,
      used: multiplier,
    },
    method: "canvas.toDataURL with image-bounds crop"
  });
  
  const originalBg = canvas.backgroundColor;
  const originals = [];
  let maskObjectCount = 0;
  
  canvas.getObjects().forEach((obj) => {
    const isMask = obj?.data?.role === "mask";
    if (isMask) maskObjectCount++;
    
    originals.push({
      obj,
      visible: obj.visible,
      opacity: obj.opacity,
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth,
      fill: obj.fill,
      gco: obj.globalCompositeOperation,
    });
    
    if (!isMask) {
      obj.visible = false;
    } else {
      obj.visible = true;
      obj.opacity = 1;
      obj.stroke = "white";
      obj.strokeWidth = obj.strokeWidth || 1;
      obj.fill = null;
      obj.globalCompositeOperation = "source-over";
    }
  });
  
  console.log("Mask objects found:", maskObjectCount);
  
  canvas.backgroundColor = "black";
  canvas.requestRenderAll();
  
  try {
    const dataURL = canvas.toDataURL({
      format: "png",
      left: imageBounds.left,
      top: imageBounds.top,
      width: boundsW,
      height: boundsH,
      multiplier,
      enableRetinaScaling: false,
    });

    return dataURL ? dataURLToBlob(dataURL) : null;
  } finally {
    // Restore original state
    originals.forEach(({ obj, visible, opacity, stroke, strokeWidth, fill, gco }) => {
      obj.visible = visible;
      obj.opacity = opacity;
      obj.stroke = stroke;
      obj.strokeWidth = strokeWidth;
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