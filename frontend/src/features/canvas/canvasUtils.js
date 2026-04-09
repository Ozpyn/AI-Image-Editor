// Import Fabric classes used for drawing and objects
import { PencilBrush, Textbox, IText, Rect } from "fabric";

// Import the whole Fabric namespace to access helpers and filters
import * as fabricNS from "fabric";

// Import helpers for loading images and converting blobs
import { fabricImageFromURL, blobToDataURL } from "./loadImage";

// Fabric filter namespace helper
const Filters = fabricNS.filters || fabricNS.fabric?.filters;

/**
 * Force 2D filter backend to avoid WebGL texture cropping/strips on some large images.
 */
let __forcedFilterBackend = false;

// Make Fabric use 2D filtering to avoid WebGL rendering glitches
function ensure2DFilterBackend() {
  // Stop if backend has already been forced
  if (__forcedFilterBackend) return;

  try {
    // Read Fabric 2D filter backend constructor from whichever namespace is available
    const Canvas2dFilterBackend =
      fabricNS.Canvas2dFilterBackend || fabricNS.fabric?.Canvas2dFilterBackend;

    // Read Fabric configuration object
    const config = fabricNS.config || fabricNS.fabric?.config;

    // Disable WebGL filtering if supported
    if (config && "enableGLFiltering" in config) {
      config.enableGLFiltering = false;
    }

    // Assign 2D filter backend if possible
    if (config && Canvas2dFilterBackend) {
      config.filterBackend = new Canvas2dFilterBackend();
      __forcedFilterBackend = true;
    } else {
      // Mark as done even if no backend was assigned
      __forcedFilterBackend = true;
    }
  } catch {
    // Prevent repeated attempts if something throws
    __forcedFilterBackend = true;
  }
}

// Map tool names to the function that prepares the canvas for that tool
const toolModes = {
  select: enableSelectMode,
  crop: enableCropMode,
  rotate: enableRotateMode,
  erase: enableEraseMode,
  mask: enableMaskMode,
  text: enableTextMode,
  brush: enableBrushMode,
  heal: enableHealMode,
};

// Remove old temporary event handlers before a new tool is activated
function clearToolHandlers(canvas) {
  // Stop if no handlers object exists
  if (!canvas?.__toolHandlers) return;

  // Short alias for stored handlers
  const h = canvas.__toolHandlers;

  // Remove stored mouse-down handler if present
  if (h.mouseDown) canvas.off("mouse:down", h.mouseDown);

  // Remove stored mouse-move handler if present
  if (h.mouseMove) canvas.off("mouse:move", h.mouseMove);

  // Remove stored mouse-up handler if present
  if (h.mouseUp) canvas.off("mouse:up", h.mouseUp);

  // Remove stored path-created handler if present
  if (h.pathCreated) canvas.off("path:created", h.pathCreated);

  // Reset handler storage
  canvas.__toolHandlers = {};
}

// Attach and remember a temporary tool handler
function setToolHandler(canvas, key, eventName, handler) {
  // Create handler storage if it does not exist
  if (!canvas.__toolHandlers) canvas.__toolHandlers = {};

  // Store the handler by key
  canvas.__toolHandlers[key] = handler;

  // Attach the Fabric event listener
  canvas.on(eventName, handler);
}

// Public helper used by useCanvas to switch the active tool mode
export function setToolMode(canvas, mode = "select", options = {}) {
  // Stop if canvas does not exist
  if (!canvas) return;

  // Reset canvas from previous tool state
  resetCanvasState(canvas);

  // Find the mode handler or fall back to select mode
  const handler = toolModes[mode] ?? enableSelectMode;

  // Activate the chosen tool mode
  handler(canvas, options);

  // Request a redraw
  canvas.requestRenderAll();
}

// Reset the canvas before enabling the next tool
function resetCanvasState(canvas) {
  // Stop if canvas is missing
  if (!canvas) return;

  // Disable free drawing
  canvas.isDrawingMode = false;

  // Disable selection box
  canvas.selection = false;

  // Reset cursor
  canvas.defaultCursor = "default";

  // Remove crop helper objects
  removeCropArtifacts(canvas);

  // Remove heal helper objects
  removeHealArtifacts(canvas);

  // Remove old event handlers
  clearToolHandlers(canvas);

  // Clear currently active object
  canvas.discardActiveObject();

  // Make all objects non-interactive by default
  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
    obj.hasControls = false;
    obj.lockRotation = true;
  });
}

// Normal select mode: allow objects to be interacted with except mask paths
function enableSelectMode(canvas) {
  // Disable drawing mode
  canvas.isDrawingMode = false;

  // Enable selection
  canvas.selection = true;

  // Reset cursor
  canvas.defaultCursor = "default";

  // Configure each object
  canvas.forEachObject((obj) => {
    // Keep mask objects non-selectable
    if (obj.data?.role === "mask") {
      obj.selectable = false;
      obj.evented = false;
      obj.hasControls = false;
      obj.lockRotation = true;
    } else {
      // Allow normal objects to be selected and edited
      obj.selectable = true;
      obj.evented = true;
      obj.hasControls = true;
      obj.lockRotation = false;
    }
  });

  // Redraw canvas
  canvas.requestRenderAll();
}

// Rotate mode: only the main image should be selectable and rotatable
function enableRotateMode(canvas) {
  // Disable drawing mode
  canvas.isDrawingMode = false;

  // Disable drag selection
  canvas.selection = false;

  // Change cursor to indicate dragging
  canvas.defaultCursor = "grab";

  // Clear active object first
  canvas.discardActiveObject();

  // Find the main image
  const img = getImageObject(canvas);

  // Stop if no image exists
  if (!img) return;

  // Configure all objects
  canvas.forEachObject((obj) => {
    // Only the image should be interactive
    const isTarget = obj === img;

    obj.selectable = isTarget;
    obj.evented = isTarget;
    obj.hasControls = isTarget;
    obj.lockRotation = !isTarget;

    // Configure image rotation behavior
    if (isTarget) {
      obj.hasBorders = true;
      obj.centeredRotation = true;
    }
  });

  // Make image active
  canvas.setActiveObject?.(img);

  // Redraw canvas
  canvas.requestRenderAll();
}

/* ------------------------------- Image utils ------------------------------ */

// Fit an object inside the canvas with padding and center it
export function fitObjectToCanvas(canvas, obj, padding = 32) {
  // Stop if canvas or object is missing
  if (!canvas || !obj) return 1;

  // Canvas width
  const cw = canvas.getWidth();

  // Canvas height
  const ch = canvas.getHeight();

  // Available width after padding
  const availableW = Math.max(1, cw - padding * 2);

  // Available height after padding
  const availableH = Math.max(1, ch - padding * 2);

  // Raw object width
  const rawW = Math.max(1, obj.width || 1);

  // Raw object height
  const rawH = Math.max(1, obj.height || 1);

  // Scale needed to fit object into canvas
  const scale = Math.min(availableW / rawW, availableH / rawH);

  // Center and scale the object
  obj.set({
    originX: "center",
    originY: "center",
    left: cw / 2,
    top: ch / 2,
    scaleX: scale,
    scaleY: scale,
  });

  // Recompute object controls and bounds
  obj.setCoords?.();

  // Save fit scale
  canvas.__fitScale = scale;

  // Reset zoom multiplier
  canvas.__zoomLevel = 1;

  // Redraw canvas
  canvas.requestRenderAll?.();

  // Return applied scale
  return scale;
}

// Zoom the main image in or out while keeping it centered
export function zoomImage(canvas, factor = 1) {
  // Stop if canvas is missing
  if (!canvas) return 100;

  // Find image object
  const img = canvas.getObjects?.().find((o) => o?.type === "image");

  // Return default zoom if no image exists
  if (!img) return 100;

  // Use existing fit scale or compute one
  const fitScale =
    canvas.__fitScale ||
    Math.min(
      Math.max(1, canvas.getWidth() - 64) / Math.max(1, img.width || 1),
      Math.max(1, canvas.getHeight() - 64) / Math.max(1, img.height || 1)
    );

  // Current zoom factor
  const currentZoom = canvas.__zoomLevel || 1;

  // Clamp next zoom factor
  const nextZoom = Math.max(0.1, Math.min(8, currentZoom * factor));

  // Final image scale
  const nextScale = fitScale * nextZoom;

  // Recenter and scale image
  img.set({
    originX: "center",
    originY: "center",
    left: canvas.getWidth() / 2,
    top: canvas.getHeight() / 2,
    scaleX: nextScale,
    scaleY: nextScale,
  });

  // Update object bounds
  img.setCoords?.();

  // Save zoom level
  canvas.__zoomLevel = nextZoom;

  // Keep image active
  canvas.setActiveObject?.(img);

  // Redraw canvas
  canvas.requestRenderAll?.();

  // Return percentage form of zoom
  return Math.round(nextZoom * 100);
}

// Fit the current image back into the visible area
export function fitImageToView(canvas, padding = 32) {
  // Stop if canvas is missing
  if (!canvas) return 100;

  // Find image object
  const img = canvas.getObjects?.().find((o) => o?.type === "image");

  // Return default zoom if no image exists
  if (!img) return 100;

  // Fit image to canvas
  fitObjectToCanvas(canvas, img, padding);

  // Return 100% zoom display
  return 100;
}

// Read the current zoom level as percentage
export function getZoomPercent(canvas) {
  // Return default if no canvas exists
  if (!canvas) return 100;

  // Convert stored zoom factor to percentage
  return Math.round((canvas.__zoomLevel || 1) * 100);
}

// Rotate the main image by a fixed angle
export function rotateImageBy(canvas, delta = 90) {
  // Stop if canvas is missing
  if (!canvas) return null;

  // Find image object
  const img = getImageObject(canvas);

  // Stop if image is missing
  if (!img) return null;

  // Current image rotation
  const currentAngle = img.angle || 0;

  // Next image rotation
  const nextAngle = currentAngle + delta;

  // Apply rotation
  img.set({
    angle: nextAngle,
    centeredRotation: true,
  });

  // Update bounds
  img.setCoords?.();

  // Keep image active
  canvas.setActiveObject?.(img);

  // Redraw canvas
  canvas.requestRenderAll?.();

  // Return rotated image
  return img;
}

// Reset the main image rotation
export function resetImageRotation(canvas) {
  // Stop if canvas is missing
  if (!canvas) return null;

  // Find image object
  const img = getImageObject(canvas);

  // Stop if image is missing
  if (!img) return null;

  // Reset rotation to zero
  img.set({
    angle: 0,
    centeredRotation: true,
  });

  // Update bounds
  img.setCoords?.();

  // Keep image active
  canvas.setActiveObject?.(img);

  // Redraw canvas
  canvas.requestRenderAll?.();

  // Return image
  return img;
}

// Remove all objects from the canvas and reset view-related state
export function clearCanvas(canvas) {
  // Stop if canvas is missing
  if (!canvas) return;

  // Remove every object
  canvas.getObjects().forEach((o) => canvas.remove(o));

  // Reset fit scale
  canvas.__fitScale = 1;

  // Reset zoom level
  canvas.__zoomLevel = 1;

  // Clear crop references
  canvas.__cropRect = null;
  canvas.__cropShade = null;

  // Clear heal marker
  canvas.__healSourceMarker = null;

  // Clear active object
  canvas.discardActiveObject();

  // Redraw canvas
  canvas.requestRenderAll();
}

// Export the whole canvas as a PNG data URL
export function exportPNG(canvas, multiplier = 2) {
  // Stop if canvas is missing
  if (!canvas) return null;

  // Return data URL generated by Fabric
  return canvas.toDataURL({
    format: "png",
    multiplier,
    enableRetinaScaling: false,
  });
}

// Resize the Fabric canvas
export function setCanvasSize(canvas, width, height) {
  // Stop if canvas is missing
  if (!canvas) return;

  // Rounded width
  const w = Math.max(1, Math.floor(width));

  // Rounded height
  const h = Math.max(1, Math.floor(height));

  // Use setDimensions if available
  if (typeof canvas.setDimensions === "function") {
    canvas.setDimensions({ width: w, height: h });
  } else {
    // Fallback setters
    canvas.setWidth?.(w);
    canvas.setHeight?.(h);
  }

  // Refresh canvas offset
  canvas.calcOffset?.();

  // Redraw canvas
  canvas.requestRenderAll?.();
}

// Remove all mask objects from the canvas
export function clearMaskObjects(canvas) {
  // Stop if canvas is missing
  if (!canvas) return;

  // Find mask-role objects
  const maskObjects = canvas.getObjects().filter((obj) => obj?.data?.role === "mask");

  // Remove each mask object
  maskObjects.forEach((obj) => canvas.remove(obj));

  // Redraw canvas
  canvas.requestRenderAll();
}

// Return the base image object on the canvas
export function getBaseImageObject(canvas) {
  // Stop if canvas is missing
  if (!canvas) return null;

  // Read object list
  const objects = canvas.getObjects();

  // Find the first non-mask, non-path object with size
  for (const obj of objects) {
    const isMask = obj?.data?.role === "mask";
    const isPath = obj.type === "path";
    if (!isMask && !isPath && obj.width && obj.height) {
      return obj;
    }
  }

  // Return null if nothing matches
  return null;
}

// Return original image dimensions if available
export function getOriginalImageDimensions(imageObj) {
  // Stop if image object is missing
  if (!imageObj) return null;

  // Read image DOM element
  const element = imageObj._element || imageObj._originalElement;

  // Prefer natural dimensions when available
  if (element && element.naturalWidth && element.naturalHeight) {
    return {
      width: element.naturalWidth,
      height: element.naturalHeight,
    };
  }

  // Fall back to Fabric dimensions
  return {
    width: imageObj.width,
    height: imageObj.height,
  };
}

// Estimate an export multiplier close to the original image resolution
export function getOriginalSizeMultiplier(canvas) {
  // Find base image object
  const baseImage = getBaseImageObject(canvas);

  // Return 1 if there is no image
  if (!baseImage) return 1;

  // Read original image dimensions
  const originalDims = getOriginalImageDimensions(baseImage);

  // Return 1 if missing
  if (!originalDims) return 1;

  // Original width
  const originalW = originalDims.width;

  // Original height
  const originalH = originalDims.height;

  // Current displayed width
  const imageScaledW = baseImage.getScaledWidth();

  // Current displayed height
  const imageScaledH = baseImage.getScaledHeight();

  // Width-based multiplier
  const multiplierW = originalW / imageScaledW;

  // Height-based multiplier
  const multiplierH = originalH / imageScaledH;

  // Return average multiplier
  return (multiplierW + multiplierH) / 2;
}

/* -------------------------- Image adjustment utils ------------------------- */

// Apply brightness / contrast / saturation filters to the current image
export function applyImageAdjustments(canvas, adjustments = {}) {
  // Stop if canvas is missing
  if (!canvas) return;

  // Stop if filters are unavailable
  if (!Filters) {
    console.warn("Fabric filters are not available in this build. Skipping adjustments.");
    return;
  }

  // Force safe 2D filter backend
  ensure2DFilterBackend();

  // Try active object first, otherwise find first image
  const active = canvas.getActiveObject?.();
  const img =
    active && active.type === "image"
      ? active
      : canvas.getObjects()?.find((o) => o?.type === "image");

  // Stop if image is missing
  if (!img) return;

  // Read adjustment values with defaults
  const { brightness = 0, contrast = 0, saturation = 0 } = adjustments;

  // Save current adjustments on canvas
  canvas.__adjustments = { brightness, contrast, saturation };

  // Disable caching for correct filter updates
  img.objectCaching = false;
  img.set?.("dirty", true);

  // Build next filter list
  const nextFilters = [];

  // Add brightness filter when needed
  if (Math.abs(brightness) > 1e-6) {
    nextFilters.push(new Filters.Brightness({ brightness }));
  }

  // Add contrast filter when needed
  if (Math.abs(contrast) > 1e-6) {
    nextFilters.push(new Filters.Contrast({ contrast }));
  }

  // Add saturation filter when needed
  if (Math.abs(saturation) > 1e-6) {
    nextFilters.push(new Filters.Saturation({ saturation }));
  }

  // Assign filters to image
  img.filters = nextFilters;

  // Apply filters
  img.applyFilters?.();

  // Update image bounds
  img.setCoords?.();

  // Keep image active
  canvas.setActiveObject?.(img);

  // Redraw canvas
  canvas.requestRenderAll?.();
}

/* ------------------------------ Heal helpers ------------------------------ */

// Get pointer location in canvas coordinates
function getCanvasPoint(canvas, opt) {
  // Read original event
  const e = opt?.e;

  // Try available pointer APIs in order
  return (
    (typeof canvas.getScenePoint === "function" && e ? canvas.getScenePoint(e) : null) ||
    (typeof canvas.getViewportPoint === "function" && e ? canvas.getViewportPoint(e) : null) ||
    opt?.absolutePointer ||
    opt?.pointer ||
    null
  );
}

// Convert object origin type to pixel offset
function originOffset(origin, size) {
  // Left/top origin means no offset
  if (origin === "left" || origin === "top") return 0;

  // Center origin means half-size offset
  if (origin === "center") return size / 2;

  // Right/bottom origin means full-size offset
  if (origin === "right" || origin === "bottom") return size;

  // Fallback offset
  return 0;
}

// Convert a canvas point to the corresponding pixel in the image object
function canvasPointToImagePixel(img, canvasPoint) {
  // Read Fabric utilities
  const util = fabricNS.util || fabricNS.fabric?.util;
  const Point = fabricNS.Point || fabricNS.fabric?.Point;

  // Stop if required helpers are missing
  if (!util || !Point || !img || !canvasPoint) return null;

  // Invert image transform matrix
  const invImg = util.invertTransform(img.calcTransformMatrix());

  // Transform canvas point into image local coordinates
  const local = util.transformPoint(new Point(canvasPoint.x, canvasPoint.y), invImg);

  // Compute origin offsets
  const ox = originOffset(img.originX, img.width);
  const oy = originOffset(img.originY, img.height);

  // Convert to image coordinates
  const x = local.x + ox;
  const y = local.y + oy;

  // Return point and whether it is inside image bounds
  return {
    x,
    y,
    inside: x >= 0 && y >= 0 && x <= img.width && y <= img.height,
  };
}

// Return the main image object
function getImageObject(canvas) {
  // Stop if canvas is missing
  if (!canvas) return null;

  // Prefer active image
  const active = canvas.getActiveObject?.();
  if (active && active.type === "image") return active;

  // Otherwise return first image object
  return canvas.getObjects()?.find((o) => o?.type === "image") || null;
}

// Create or reuse an internal bitmap used by the heal tool
function initHealBitmapFromImage(img) {
  // Rounded image width
  const visibleW = Math.max(1, Math.round(img.width || 1));

  // Rounded image height
  const visibleH = Math.max(1, Math.round(img.height || 1));

  // Reuse existing bitmap if size matches
  if (
    img.__healBitmap &&
    img.__healBitmap.width === visibleW &&
    img.__healBitmap.height === visibleH
  ) {
    return img.__healBitmap;
  }

  // Read source DOM element
  const sourceEl = img._originalElement || img._element;

  // Stop if missing
  if (!sourceEl) return null;

  // Create offscreen bitmap canvas
  const bitmap = document.createElement("canvas");
  bitmap.width = visibleW;
  bitmap.height = visibleH;

  // Read drawing context
  const ctx = bitmap.getContext("2d", { alpha: true });

  // Stop if missing
  if (!ctx) return null;

  // Enable smooth drawing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Crop source x
  const sx = Math.max(0, Math.round(img.cropX || 0));

  // Crop source y
  const sy = Math.max(0, Math.round(img.cropY || 0));

  // Source width
  const sw = visibleW;

  // Source height
  const sh = visibleH;

  // Draw source image region onto bitmap
  ctx.drawImage(sourceEl, sx, sy, sw, sh, 0, 0, visibleW, visibleH);

  // Save bitmap on image object
  img.__healBitmap = bitmap;

  // Return bitmap
  return bitmap;
}

// Write the updated heal bitmap back into the Fabric image
function updateImageFromHealBitmap(img, bitmap) {
  // Stop if either input is missing
  if (!img || !bitmap) return;

  // Convert bitmap to PNG data URL
  const dataUrl = bitmap.toDataURL("image/png");

  // Update Fabric image src
  img.set("src", dataUrl);

  // Replace current image element
  img._element = bitmap;
  img._originalElement = bitmap;

  // Update element through Fabric API if available
  if (typeof img.setElement === "function") {
    img.setElement(bitmap);
  }

  // Reset crop and size to bitmap size
  img.set({
    cropX: 0,
    cropY: 0,
    width: bitmap.width,
    height: bitmap.height,
    dirty: true,
    objectCaching: false,
  });

  // Disable caching
  img.objectCaching = false;

  // Update object bounds
  img.setCoords?.();
}

// Create a soft radial mask used by the heal brush
function createSoftBrushMask(size, hardness = 0.28) {
  // Rounded brush diameter
  const diameter = Math.max(1, Math.round(size));

  // Radius value
  const radius = diameter / 2;

  // Create offscreen mask canvas
  const mask = document.createElement("canvas");
  mask.width = diameter;
  mask.height = diameter;

  // Read drawing context
  const ctx = mask.getContext("2d", { alpha: true });

  // Return blank mask if no context exists
  if (!ctx) return mask;

  // Inner hard region size
  const inner = Math.max(0, radius * hardness);

  // Build radial gradient
  const gradient = ctx.createRadialGradient(radius, radius, inner, radius, radius, radius);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  // Fill brush circle with gradient
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  // Return mask
  return mask;
}

// Create a feathered sample area used for clone healing
function createFeatheredSample(bitmap, sourceX, sourceY, size) {
  // Rounded sample diameter
  const diameter = Math.max(1, Math.round(size));

  // Radius value
  const radius = diameter / 2;

  // Create offscreen sample canvas
  const sample = document.createElement("canvas");
  sample.width = diameter;
  sample.height = diameter;

  // Read drawing context
  const sctx = sample.getContext("2d", { alpha: true });

  // Return blank sample if no context exists
  if (!sctx) return sample;

  // Enable smooth sampling
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";

  // Source sample x
  const sx = Math.round(sourceX - radius);

  // Source sample y
  const sy = Math.round(sourceY - radius);

  // Copy source region into sample
  sctx.drawImage(bitmap, sx, sy, diameter, diameter, 0, 0, diameter, diameter);

  // Build soft mask
  const mask = createSoftBrushMask(diameter);

  // Keep only masked sample area
  sctx.globalCompositeOperation = "destination-in";
  sctx.drawImage(mask, 0, 0);

  // Return sample
  return sample;
}

// Stamp one clone-heal dab
function stampCloneDab(img, targetX, targetY, sourceX, sourceY, size, flow = 0.45) {
  // Create or reuse heal bitmap
  const bitmap = initHealBitmapFromImage(img);

  // Stop if bitmap failed
  if (!bitmap) return;

  // Read bitmap drawing context
  const ctx = bitmap.getContext("2d", { alpha: true });

  // Stop if context failed
  if (!ctx) return;

  // Rounded brush diameter
  const diameter = Math.max(1, Math.round(size));

  // Radius value
  const radius = diameter / 2;

  // Build feathered sample from source location
  const sample = createFeatheredSample(bitmap, sourceX, sourceY, diameter);

  // Draw sample onto target with flow
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1, flow));
  ctx.drawImage(
    sample,
    Math.round(targetX - radius),
    Math.round(targetY - radius),
    diameter,
    diameter
  );
  ctx.restore();

  // Push bitmap changes back into Fabric image
  updateImageFromHealBitmap(img, bitmap);
}

// Interpolate multiple clone-heal dabs across a drag stroke
function interpolateCloneStroke(img, lastPt, nextPt, offsetX, offsetY, size, flow) {
  // Stop if points are missing
  if (!lastPt || !nextPt) return;

  // Delta x
  const dx = nextPt.x - lastPt.x;

  // Delta y
  const dy = nextPt.y - lastPt.y;

  // Distance between points
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Step spacing
  const step = Math.max(1, size / 6);

  // Number of interpolated samples
  const steps = Math.max(1, Math.ceil(dist / step));

  // Stamp dabs between the two points
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const tx = lastPt.x + dx * t;
    const ty = lastPt.y + dy * t;
    const sx = tx + offsetX;
    const sy = ty + offsetY;
    stampCloneDab(img, tx, ty, sx, sy, size, flow);
  }
}

// Draw a visible marker showing the clone-heal source point
function setHealSourceMarker(canvas, canvasPoint) {
  // Stop if inputs are missing
  if (!canvas || !canvasPoint) return;

  // Remove old marker if it exists
  if (canvas.__healSourceMarker) {
    canvas.remove(canvas.__healSourceMarker);
    canvas.__healSourceMarker = null;
  }

  // Create a small rectangle marker
  const marker = new Rect({
    left: canvasPoint.x - 5,
    top: canvasPoint.y - 5,
    width: 10,
    height: 10,
    fill: "rgba(255,255,255,0)",
    stroke: "#60a5fa",
    strokeWidth: 2,
    selectable: false,
    evented: false,
    excludeFromExport: true,
    objectCaching: false,
  });

  // Tag object role
  marker.data = { role: "healSourceMarker" };

  // Save marker reference on canvas
  canvas.__healSourceMarker = marker;

  // Add marker to canvas
  canvas.add(marker);

  // Redraw canvas
  canvas.requestRenderAll();
}

// Remove heal helper objects and state
function removeHealArtifacts(canvas) {
  // Stop if canvas is missing
  if (!canvas) return;

  // Remove source marker if it exists
  if (canvas.__healSourceMarker) {
    canvas.remove(canvas.__healSourceMarker);
    canvas.__healSourceMarker = null;
  }

  // Clear heal state object
  canvas.__healState = null;
}

// Enable clone-heal tool mode
function enableHealMode(canvas, options = {}) {
  // Read tool options with defaults
  const { size = 24, flow = 0.45, decimate = 0.2 } = options;

  // Disable selection
  canvas.selection = false;

  // Clear active object
  canvas.discardActiveObject();

  // Disable drawing mode
  canvas.isDrawingMode = false;

  // Use crosshair cursor
  canvas.defaultCursor = "crosshair";

  // Make all objects non-interactive
  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

  // Save heal working state on canvas
  canvas.__healState = {
    size,
    flow,
    decimate,
    sourcePixel: null,
    sourceCanvasPoint: null,
    isPainting: false,
    offsetX: 0,
    offsetY: 0,
    lastTarget: null,
  };

  // Start heal stroke or set source point
  const handleMouseDown = (opt) => {
    const p = getCanvasPoint(canvas, opt);
    if (!p) return;

    const img = getImageObject(canvas);
    if (!img) return;

    const imgPt = canvasPointToImagePixel(img, p);
    if (!imgPt?.inside) return;

    const state = canvas.__healState;
    if (!state) return;

    // Alt/meta click sets source location
    if (opt?.e?.altKey || opt?.e?.metaKey) {
      state.sourcePixel = { x: imgPt.x, y: imgPt.y };
      state.sourceCanvasPoint = { x: p.x, y: p.y };
      setHealSourceMarker(canvas, p);
      return;
    }

    // Do nothing until source is chosen
    if (!state.sourcePixel) return;

    // Start painting
    state.isPainting = true;
    state.offsetX = state.sourcePixel.x - imgPt.x;
    state.offsetY = state.sourcePixel.y - imgPt.y;
    state.lastTarget = { x: imgPt.x, y: imgPt.y };

    // Stamp first dab
    stampCloneDab(
      img,
      imgPt.x,
      imgPt.y,
      imgPt.x + state.offsetX,
      imgPt.y + state.offsetY,
      state.size,
      state.flow
    );

    // Keep image active and redraw
    img.setCoords?.();
    canvas.setActiveObject?.(img);
    canvas.requestRenderAll?.();
  };

  // Continue heal stroke while moving
  const handleMouseMove = (opt) => {
    const state = canvas.__healState;
    if (!state?.isPainting) return;

    const p = getCanvasPoint(canvas, opt);
    if (!p) return;

    const img = getImageObject(canvas);
    if (!img) return;

    const imgPt = canvasPointToImagePixel(img, p);
    if (!imgPt?.inside) return;

    // Interpolate dabs along the stroke
    interpolateCloneStroke(
      img,
      state.lastTarget,
      { x: imgPt.x, y: imgPt.y },
      state.offsetX,
      state.offsetY,
      state.size,
      state.flow
    );

    // Save latest target point
    state.lastTarget = { x: imgPt.x, y: imgPt.y };

    // Keep image active and redraw
    img.setCoords?.();
    canvas.setActiveObject?.(img);
    canvas.requestRenderAll?.();
  };

  // Finish heal stroke
  const handleMouseUp = () => {
    const state = canvas.__healState;
    if (!state) return;
    state.isPainting = false;
    state.lastTarget = null;
  };

  // Register handlers
  setToolHandler(canvas, "mouseDown", "mouse:down", handleMouseDown);
  setToolHandler(canvas, "mouseMove", "mouse:move", handleMouseMove);
  setToolHandler(canvas, "mouseUp", "mouse:up", handleMouseUp);

  // Redraw canvas
  canvas.requestRenderAll();
}

// Enable freehand brush mode
function enableBrushMode(canvas, options = {}) {
  // Read tool options with defaults
  const { color = "#ff3b30", size = 12, decimate = 0.2 } = options;

  // Disable selection
  canvas.selection = false;

  // Clear active object
  canvas.discardActiveObject();

  // Enable drawing mode
  canvas.isDrawingMode = true;

  // Use crosshair cursor
  canvas.defaultCursor = "crosshair";

  // Make all objects non-interactive
  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

  // Create Fabric pencil brush
  const brush = new PencilBrush(canvas);
  brush.width = size;
  brush.color = color;
  brush.decimate = decimate;
  canvas.freeDrawingBrush = brush;

  // Mark created paths as brush objects
  const handlePathCreated = (e) => {
    const path = e.path;
    path.set({
      selectable: false,
      evented: false,
      excludeFromExport: false,
    });
    path.data = { role: "brush" };
  };

  // Register path-created handler
  setToolHandler(canvas, "pathCreated", "path:created", handlePathCreated);

  // Redraw canvas
  canvas.requestRenderAll();
}

// Enable erase mode by drawing white mask paths
function enableEraseMode(canvas, options = {}) {
  // Read tool options with defaults
  const { size = 50, decimate = 0.4 } = options;

  // Disable selection
  canvas.selection = false;

  // Clear active object
  canvas.discardActiveObject();

  // Enable drawing mode
  canvas.isDrawingMode = true;

  // Use crosshair cursor
  canvas.defaultCursor = "crosshair";

  // Make all objects non-interactive
  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

  // Create Fabric pencil brush for erase mask
  const brush = new PencilBrush(canvas);
  brush.width = size;
  brush.color = "white";
  brush.decimate = decimate;
  canvas.freeDrawingBrush = brush;

  // Mark created paths as mask objects
  const handlePathCreated = (e) => {
    const path = e.path;
    path.set({
      selectable: false,
      evented: false,
      excludeFromExport: false,
    });
    path.data = { role: "mask" };
  };

  // Register path-created handler
  setToolHandler(canvas, "pathCreated", "path:created", handlePathCreated);

  // Redraw canvas
  canvas.requestRenderAll();
}

// Enable text insertion mode
function enableTextMode(canvas) {
  // Disable selection
  canvas.selection = false;

  // Clear active object
  canvas.discardActiveObject();

  // Disable drawing mode
  canvas.isDrawingMode = false;

  // Use text cursor
  canvas.defaultCursor = "text";

  // Make existing objects non-interactive
  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

  // Helper to get pointer position across Fabric versions
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

  // Prefer Textbox, otherwise use IText
  const TextClass = Textbox || IText;

  // Create a text object where user clicks
  const handleMouseDown = (opt) => {
    const p = getPoint(opt);
    if (!p) return;

    const textObj = new TextClass("Type here", {
      left: p.x,
      top: p.y,
      width: 260,
      fontSize: 36,
      fill: "#ffffff",
      selectable: true,
      evented: true,
      editable: true,
      originX: "left",
      originY: "top",
    });

    // Tag object role
    textObj.data = { role: "text" };

    // Add and activate text
    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    canvas.requestRenderAll();

    // Enter editing mode after render
    setTimeout(() => {
      textObj.enterEditing?.();
      textObj.hiddenTextarea?.focus?.();
    }, 0);
  };

  // Register mouse-down handler
  setToolHandler(canvas, "mouseDown", "mouse:down", handleMouseDown);

  // Redraw canvas
  canvas.requestRenderAll();
}

/* ------------------------------- Crop tool ------------------------------- */

// Enable crop mode by adding a movable crop rectangle on top of the image
function enableCropMode(canvas) {
  // Disable drawing mode
  canvas.isDrawingMode = false;

  // Disable selection box
  canvas.selection = false;

  // Use crosshair cursor
  canvas.defaultCursor = "crosshair";

  // Clear active object
  canvas.discardActiveObject();

  // Make all existing objects non-interactive
  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

  // Remove old crop helpers
  removeCropArtifacts(canvas);

  // Find image object
  const img = canvas.getObjects()?.find((o) => o?.type === "image");

  // Stop if no image exists
  if (!img) {
    console.warn("No image found for crop mode");
    return;
  }

  // Read image bounds on canvas
  const base = img.getBoundingRect(true, true);

  // Initial crop rectangle width
  const w = Math.max(100, base.width * 0.7);

  // Initial crop rectangle height
  const h = Math.max(100, base.height * 0.7);

  // Initial crop rectangle x
  const left = base.left + (base.width - w) / 2;

  // Initial crop rectangle y
  const top = base.top + (base.height - h) / 2;

  // Create crop rectangle object
  const cropRect = new Rect({
    left,
    top,
    width: w,
    height: h,
    fill: "rgba(0,0,0,0)",
    stroke: "#ffffff",
    strokeWidth: 2,
    strokeDashArray: [8, 6],
    cornerColor: "#ffffff",
    cornerStrokeColor: "#ffffff",
    cornerSize: 12,
    transparentCorners: false,
    hasRotatingPoint: false,
    objectCaching: false,
    selectable: true,
    evented: true,
    excludeFromExport: true,
  });

  // Tag object role
  cropRect.data = { role: "cropRect" };

  // Add crop rectangle to canvas
  canvas.add(cropRect);

  // Save crop rectangle reference
  canvas.__cropRect = cropRect;

  // Activate crop rectangle
  canvas.setActiveObject(cropRect);

  // Redraw canvas
  canvas.requestRenderAll();
}

// Apply the crop rectangle to the current image
export function applyCropToImage(canvas) {
  // Stop if canvas is missing
  if (!canvas) return null;

  // Read crop rectangle
  const cropRect = canvas.__cropRect;

  // Stop if missing
  if (!cropRect) return null;

  // Find image object
  const img = canvas.getObjects()?.find((o) => o?.type === "image");

  // Stop if missing
  if (!img) return null;

  // Read Fabric utilities
  const util = fabricNS.util || fabricNS.fabric?.util;
  const Point = fabricNS.Point || fabricNS.fabric?.Point;

  // Stop if helpers are unavailable
  if (!util || !Point) return null;

  // Read crop rectangle bounds
  const rect = cropRect.getBoundingRect(true, true);

  // Invert image transform
  const invImg = util.invertTransform(img.calcTransformMatrix());

  // Convert top-left crop point into image space
  const tl = util.transformPoint(new Point(rect.left, rect.top), invImg);

  // Convert bottom-right crop point into image space
  const br = util.transformPoint(
    new Point(rect.left + rect.width, rect.top + rect.height),
    invImg
  );

  // Helper for origin offset
  const originOffsetValue = (origin, size) => {
    if (origin === "left" || origin === "top") return 0;
    if (origin === "center") return size / 2;
    if (origin === "right" || origin === "bottom") return size;
    return 0;
  };

  // Image origin offsets
  const ox = originOffsetValue(img.originX, img.width);
  const oy = originOffsetValue(img.originY, img.height);

  // Translate crop bounds by origin offsets
  const tlx = tl.x + ox;
  const tly = tl.y + oy;
  const brx = br.x + ox;
  const bry = br.y + oy;

  // Order crop bounds
  const x1 = Math.min(tlx, brx);
  const y1 = Math.min(tly, bry);
  const x2 = Math.max(tlx, brx);
  const y2 = Math.max(tly, bry);

  // Existing crop offsets on image
  const baseCropX = img.cropX || 0;
  const baseCropY = img.cropY || 0;

  // Source dimensions from DOM element or fallback
  const sourceW =
    img._originalElement?.naturalWidth ||
    img._originalElement?.width ||
    img.width;
  const sourceH =
    img._originalElement?.naturalHeight ||
    img._originalElement?.height ||
    img.height;

  // Clamp local crop start point
  const cropXLocal = Math.max(0, Math.min(img.width, x1));
  const cropYLocal = Math.max(0, Math.min(img.height, y1));

  // Clamp crop width
  const cropW = Math.max(1, Math.min(img.width - cropXLocal, x2 - x1));

  // Clamp crop height
  const cropH = Math.max(1, Math.min(img.height - cropYLocal, y2 - y1));

  // Convert local crop x into source crop x
  const cropX = Math.max(0, Math.min(sourceW - 1, baseCropX + cropXLocal));

  // Convert local crop y into source crop y
  const cropY = Math.max(0, Math.min(sourceH - 1, baseCropY + cropYLocal));

  // Clamp final width
  const finalW = Math.max(1, Math.min(sourceW - cropX, cropW));

  // Clamp final height
  const finalH = Math.max(1, Math.min(sourceH - cropY, cropH));

  // Apply crop to image
  img.set({
    cropX,
    cropY,
    width: finalW,
    height: finalH,
    dirty: true,
    objectCaching: false,
  });

  // Disable caching
  img.objectCaching = false;

  // Update bounds
  img.setCoords?.();

  // Remove crop helpers
  removeCropArtifacts(canvas);

  // Keep image active
  canvas.setActiveObject?.(img);

  // Redraw canvas
  canvas.requestRenderAll?.();

  // Return updated image
  return img;
}

// Cancel crop mode by removing the crop helper
export function cancelCrop(canvas) {
  // Stop if canvas is missing
  if (!canvas) return;

  // Remove crop objects
  removeCropArtifacts(canvas);

  // Redraw canvas
  canvas.requestRenderAll();
}

// Remove crop helper objects and references
function removeCropArtifacts(canvas) {
  // Read crop rectangle reference
  const rect = canvas.__cropRect;

  // Remove crop rectangle if it exists
  if (rect) canvas.remove(rect);

  // Clear crop helper references
  canvas.__cropShade = null;
  canvas.__cropRect = null;
}

/* =========================================================
   Mask mode
========================================================= */

// Enable mask drawing mode
function enableMaskMode(canvas, options = {}) {
  // Read options with defaults
  const { size = 40, decimate = 0.4 } = options;

  // Disable selection
  canvas.selection = false;

  // Clear active object
  canvas.discardActiveObject();

  // Enable drawing mode
  canvas.isDrawingMode = true;

  // Use crosshair cursor
  canvas.defaultCursor = "crosshair";

  // Create pencil brush for masking
  const maskBrush = new PencilBrush(canvas);
  maskBrush.color = "rgba(255, 255, 255, 0.6)";
  maskBrush.width = size;
  maskBrush.decimate = decimate;
  canvas.freeDrawingBrush = maskBrush;

  // Mark created paths as mask objects
  const handlePathCreated = (e) => {
    const path = e?.path;
    if (!path) return;

    path.set({
      selectable: false,
      evented: false,
      stroke: "rgba(255, 255, 255, 0.6)",
      strokeWidth: size,
      excludeFromExport: false,
    });

    path.data = { role: "mask" };
    canvas.requestRenderAll();
  };

  // Register path-created handler
  setToolHandler(canvas, "pathCreated", "path:created", handlePathCreated);

  // Redraw canvas
  canvas.requestRenderAll();
}

/* =========================================================
   AI bridge utilities
========================================================= */

// Convert a data URL into a Blob
function dataURLToBlob(dataURL) {
  // Split header and base64 payload
  const [header, base64] = dataURL.split(",");

  // Detect MIME type
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/png";

  // Decode base64 string
  const bin = atob(base64);

  // Decoded length
  const len = bin.length;

  // Allocate byte array
  const bytes = new Uint8Array(len);

  // Fill byte array
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);

  // Return Blob
  return new Blob([bytes], { type: mime });
}

// Export the full canvas to a Blob
export async function exportPNGBlob(canvas, multiplier = 1, useOriginalSize = false) {
  // Stop if canvas is missing
  if (!canvas) return null;

  // Export at original size when requested
  if (useOriginalSize) {
    return await exportImageAtOriginalSize(canvas);
  }

  // Export canvas to data URL
  const dataURL = exportPNG(canvas, multiplier);

  // Convert to Blob if available
  return dataURL ? dataURLToBlob(dataURL) : null;
}

// Export the current image close to its original resolution
async function exportImageAtOriginalSize(canvas) {
  // Find base image
  const baseImage = getBaseImageObject(canvas);

  // Fallback if no base image exists
  if (!baseImage) {
    console.warn("No base image found, falling back to canvas export");
    return await exportPNGBlob(canvas, 1, false);
  }

  // Read original image dimensions
  const originalDims = getOriginalImageDimensions(baseImage);

  // Fallback if dimensions are missing
  if (!originalDims) {
    console.warn("Could not get original dimensions, falling back");
    return await exportPNGBlob(canvas, 1, false);
  }

  // Original width and height
  const { width: origW, height: origH } = originalDims;

  // Read DOM image element
  const element = baseImage._element || baseImage._originalElement;

  // Fallback through object.toDataURL if DOM element is missing
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

  // Create offscreen output canvas
  const out = document.createElement("canvas");
  out.width = origW;
  out.height = origH;

  // Read drawing context
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  // Draw full image at original size
  ctx.drawImage(element, 0, 0, origW, origH);

  // Export to PNG data URL
  const dataURL = out.toDataURL("image/png");

  // Convert to Blob
  return dataURL ? dataURLToBlob(dataURL) : null;
}

// Export only the mask layer to a Blob
export async function exportMaskBlob(canvas, multiplier = 1, useOriginalSize = false) {
  // Stop if canvas is missing
  if (!canvas) return null;

  // Export mask at original size when requested
  if (useOriginalSize) {
    return await exportMaskAtOriginalSize(canvas);
  }

  // Save original background color
  const originalBg = canvas.backgroundColor;

  // Store original object display settings
  const originals = [];

  // Count mask objects
  let maskObjectCount = 0;

  // Prepare canvas so only masks are visible and white on black
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

  // Warn if no mask objects exist
  if (maskObjectCount === 0) {
    console.warn("No mask objects found! (objects with data.role === 'mask')");
  }

  // Set solid black background
  canvas.backgroundColor = "black";
  canvas.requestRenderAll();

  try {
    // Export visible mask image
    const dataURL = canvas.toDataURL({
      format: "png",
      multiplier,
      enableRetinaScaling: false,
    });
    return dataURL ? dataURLToBlob(dataURL) : null;
  } finally {
    // Restore object properties
    originals.forEach(({ obj, visible, opacity, stroke, strokeWidth, fill, gco }) => {
      obj.visible = visible;
      obj.opacity = opacity;
      obj.stroke = stroke;
      obj.strokeWidth = strokeWidth;
      obj.fill = fill;
      obj.globalCompositeOperation = gco;
    });

    // Restore background
    canvas.backgroundColor = originalBg;
    canvas.requestRenderAll();
  }
}

// Export mask at original image size
async function exportMaskAtOriginalSize(canvas) {
  // Stop if canvas is missing
  if (!canvas) return null;

  // Find base image
  const baseImage = getBaseImageObject(canvas);

  // Fallback if missing
  if (!baseImage) {
    console.warn("No base image found for mask export");
    return await exportMaskBlob(canvas, 1, false);
  }

  // Read original dimensions
  const originalDims = getOriginalImageDimensions(baseImage);

  // Fallback if missing
  if (!originalDims) {
    console.warn("Could not get original dimensions for mask");
    return await exportMaskBlob(canvas, 1, false);
  }

  // Original width and height
  const { width: origW, height: origH } = originalDims;

  // Image bounds on canvas
  const imageBounds = baseImage.getBoundingRect();

  // Bounds width and height
  const boundsW = Math.max(1, imageBounds.width);
  const boundsH = Math.max(1, imageBounds.height);

  // Compute export multiplier from original size
  const multiplierW = origW / boundsW;
  const multiplierH = origH / boundsH;
  const multiplier = (multiplierW + multiplierH) / 2;

  // Save original background color
  const originalBg = canvas.backgroundColor;

  // Store original object settings
  const originals = [];

  // Count masks
  let maskObjectCount = 0;

  // Prepare canvas for mask-only export
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

  // Set black background
  canvas.backgroundColor = "black";
  canvas.requestRenderAll();

  try {
    // Export only the image-bounds area
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
    // Restore original object properties
    originals.forEach(({ obj, visible, opacity, stroke, strokeWidth, fill, gco }) => {
      obj.visible = visible;
      obj.opacity = opacity;
      obj.stroke = stroke;
      obj.strokeWidth = strokeWidth;
      obj.fill = fill;
      obj.globalCompositeOperation = gco;
    });

    // Restore background
    canvas.backgroundColor = originalBg;
    canvas.requestRenderAll();
  }
}

// Apply an AI-generated result image back onto the canvas
export async function applyResultBlob(
  canvas,
  blob,
  { mode = "replace", padding = 32 } = {}
) {
  // Stop if inputs are missing
  if (!canvas || !blob) return;

  // Convert blob into data URL
  const dataUrl = await blobToDataURL(blob);

  // Create Fabric image from data URL
  const img = await fabricImageFromURL(dataUrl, {
    selectable: true,
    evented: true,
  });

  // Disable caching for stability
  img.objectCaching = false;
  img.set?.({ objectCaching: false });

  // Replace current image completely
  if (mode === "replace") {
    clearCanvas(canvas);
    canvas.add(img);
    fitObjectToCanvas(canvas, img, padding);
    canvas.setActiveObject(img);
  } else if (mode === "newLayer") {
    // Add as a new layer
    canvas.add(img);
    fitObjectToCanvas(canvas, img, padding);
    canvas.setActiveObject(img);
  } else {
    // Default behavior also adds as new object
    canvas.add(img);
    fitObjectToCanvas(canvas, img, padding);
    canvas.setActiveObject(img);
  }

  // Redraw canvas
  canvas.requestRenderAll();
}