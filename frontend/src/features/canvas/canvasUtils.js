// canvasUtils.js
import { PencilBrush, Textbox, Rect } from "fabric";
import * as fabricNS from "fabric";
import { fabricImageFromURL } from "./loadImage";

const Filters = fabricNS.filters || fabricNS.fabric?.filters;

/**
 * Force 2D filter backend to avoid WebGL texture cropping/strips on some large images.
 */
let __forcedFilterBackend = false;
function ensure2DFilterBackend() {
  if (__forcedFilterBackend) return;

  try {
    const Canvas2dFilterBackend =
      fabricNS.Canvas2dFilterBackend || fabricNS.fabric?.Canvas2dFilterBackend;
    const config = fabricNS.config || fabricNS.fabric?.config;

    if (config && "enableGLFiltering" in config) {
      config.enableGLFiltering = false;
    }

    if (config && Canvas2dFilterBackend) {
      config.filterBackend = new Canvas2dFilterBackend();
      __forcedFilterBackend = true;
    } else {
      __forcedFilterBackend = true;
    }
  } catch {
    __forcedFilterBackend = true;
  }
}

/* =========================================================
   Core helpers
========================================================= */

const toolModes = {
  select: enableSelectMode,
  crop: enableCropMode,
  erase: enableEraseMode,
  text: enableTextMode,
  brush: enableBrushMode,
  heal: enableHealMode,
};

export function setCanvasSize(canvas, w, h) {
  if (!canvas) return;
  canvas.setDimensions({
    width: w,
    height: h,
  });
  canvas.calcOffset();
  canvas.requestRenderAll();
}

function resetCanvasState(canvas) {
  canvas.isDrawingMode = false;
  canvas.selection = false;
  canvas.defaultCursor = "default";

  removeCropArtifacts(canvas);
  removeHealArtifacts(canvas);

  canvas.off("mouse:down");
  canvas.off("mouse:move");
  canvas.off("mouse:up");
  canvas.off("path:created");

  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

export function clearMaskObjects(canvas) {
  if (!canvas) return;
  const maskObjects = canvas.getObjects().filter(obj => obj?.data?.role === "mask");
  maskObjects.forEach((obj) => canvas.remove(obj));
  canvas.requestRenderAll();
}

export function exportPNG(canvas, multiplier = 1) {
  if (!canvas) return null;
  return canvas.toDataURL({
    format: "png",
    multiplier,
    enableRetinaScaling: false,
  });
}

export function fitObjectToCanvas(canvas, obj, padding = 32) {
  if (!canvas || !obj) return 1;

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

  obj.setCoords?.();
  canvas.__fitScale = scale;
  canvas.__zoomLevel = 1;
  canvas.requestRenderAll?.();

  return scale;
}

export function zoomImage(canvas, factor = 1) {
  if (!canvas) return 100;

  const img = canvas.getObjects?.().find((o) => o?.type === "image");
  if (!img) return 100;

  const fitScale =
    canvas.__fitScale ||
    Math.min(
      Math.max(1, canvas.getWidth() - 64) / Math.max(1, img.width || 1),
      Math.max(1, canvas.getHeight() - 64) / Math.max(1, img.height || 1)
    );

  const currentZoom = canvas.__zoomLevel || 1;
  const nextZoom = Math.max(0.1, Math.min(8, currentZoom * factor));
  const nextScale = fitScale * nextZoom;

  img.set({
    originX: "center",
    originY: "center",
    left: canvas.getWidth() / 2,
    top: canvas.getHeight() / 2,
    scaleX: nextScale,
    scaleY: nextScale,
  });

 img.setCoords?.();
  canvas.__zoomLevel = nextZoom;
  canvas.setActiveObject?.(img);
  canvas.requestRenderAll?.();

  return Math.round(nextZoom * 100);
}

export function fitImageToView(canvas, padding = 32) {
  if (!canvas) return 100;

  const img = canvas.getObjects?.().find((o) => o?.type === "image");
  if (!img) return 100;

  fitObjectToCanvas(canvas, img, padding);
  return 100;
}

export function getZoomPercent(canvas) {
  if (!canvas) return 100;
  return Math.round((canvas.__zoomLevel || 1) * 100);
}

export function clearCanvas(canvas) {
  if (!canvas) return;
  canvas.getObjects().forEach((o) => canvas.remove(o));
  canvas.__fitScale = 1;
  canvas.__zoomLevel = 1;
  canvas.requestRenderAll();
}

export function getBaseImageObject(canvas) {
  if (!canvas) return null;
  
  const objects = canvas.getObjects();
  for (const obj of objects) {
    const isMask = obj?.data?.role === "mask";
    const isPath = obj.type === "path";
    if (!isMask && !isPath && obj.width && obj.height) {
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
  
  const imageScaledW = baseImage.getScaledWidth();
  const imageScaledH = baseImage.getScaledHeight();
  
  const multiplierW = originalW / imageScaledW;
  const multiplierH = originalH / imageScaledH;
  
  return (multiplierW + multiplierH) / 2;
}

/* =========================================================
   Image adjustment utils (from main branch)
========================================================= */

export function applyImageAdjustments(canvas, adjustments = {}) {
  if (!canvas) return;

  if (!Filters) {
    console.warn("Fabric filters are not available in this build. Skipping adjustments.");
    return;
  }

  ensure2DFilterBackend();

  const active = canvas.getActiveObject?.();
  const img =
    active && active.type === "image"
      ? active
      : canvas.getObjects()?.find((o) => o?.type === "image");

  if (!img) return;

  const { brightness = 0, contrast = 0, saturation = 0 } = adjustments;
  canvas.__adjustments = { brightness, contrast, saturation };

  img.objectCaching = false;
  img.set?.("dirty", true);

  const nextFilters = [];
  if (Math.abs(brightness) > 1e-6) nextFilters.push(new Filters.Brightness({ brightness }));
  if (Math.abs(contrast) > 1e-6) nextFilters.push(new Filters.Contrast({ contrast }));
  if (Math.abs(saturation) > 1e-6) nextFilters.push(new Filters.Saturation({ saturation }));

  img.filters = nextFilters;
  img.applyFilters?.();

  const after = () => {
    img.setCoords?.();
    canvas.setActiveObject?.(img);
    canvas.requestRenderAll?.();
  };

  try {
    if (typeof img.applyFilters === "function" && img.applyFilters.length >= 1) {
      img.applyFilters(after);
    } else {
      img.applyFilters?.();
      after();
    }
  } catch {
    img.applyFilters?.();
    after();
  }
}

/* ------------------------------ Heal helpers ------------------------------ */

function getCanvasPoint(canvas, opt) {
  const e = opt?.e;
  return (
    (typeof canvas.getScenePoint === "function" && e ? canvas.getScenePoint(e) : null) ||
    (typeof canvas.getViewportPoint === "function" && e ? canvas.getViewportPoint(e) : null) ||
    opt?.absolutePointer ||
    opt?.pointer ||
    null
  );
}

function originOffset(origin, size) {
  if (origin === "left" || origin === "top") return 0;
  if (origin === "center") return size / 2;
  if (origin === "right" || origin === "bottom") return size;
  return 0;
}

function canvasPointToImagePixel(img, canvasPoint) {
  const util = fabricNS.util || fabricNS.fabric?.util;
  const Point = fabricNS.Point || fabricNS.fabric?.Point;
  if (!util || !Point || !img || !canvasPoint) return null;

  const invImg = util.invertTransform(img.calcTransformMatrix());
  const local = util.transformPoint(new Point(canvasPoint.x, canvasPoint.y), invImg);

  const ox = originOffset(img.originX, img.width);
  const oy = originOffset(img.originY, img.height);

  const x = local.x + ox;
  const y = local.y + oy;

  return {
    x,
    y,
    inside: x >= 0 && y >= 0 && x <= img.width && y <= img.height,
  };
}

function getImageObject(canvas) {
  if (!canvas) return null;
  const active = canvas.getActiveObject?.();
  if (active && active.type === "image") return active;
  return canvas.getObjects()?.find((o) => o?.type === "image") || null;
}

function initHealBitmapFromImage(img) {
  const visibleW = Math.max(1, Math.round(img.width || 1));
  const visibleH = Math.max(1, Math.round(img.height || 1));

  if (
    img.__healBitmap &&
    img.__healBitmap.width === visibleW &&
    img.__healBitmap.height === visibleH
  ) {
    return img.__healBitmap;
  }

  const sourceEl = img._originalElement || img._element;
  if (!sourceEl) return null;

  const bitmap = document.createElement("canvas");
  bitmap.width = visibleW;
  bitmap.height = visibleH;

  const ctx = bitmap.getContext("2d", { alpha: true });
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const sx = Math.max(0, Math.round(img.cropX || 0));
  const sy = Math.max(0, Math.round(img.cropY || 0));
  const sw = visibleW;
  const sh = visibleH;

  ctx.drawImage(sourceEl, sx, sy, sw, sh, 0, 0, visibleW, visibleH);

  img.__healBitmap = bitmap;
  return bitmap;
}

function updateImageFromHealBitmap(img, bitmap) {
  if (!img || !bitmap) return;

  if (typeof img.setElement === "function") {
    img.setElement(bitmap);
  } else {
    img._element = bitmap;
    img._originalElement = bitmap;
  }

  img.set({
    cropX: 0,
    cropY: 0,
    width: bitmap.width,
    height: bitmap.height,
    dirty: true,
    objectCaching: false,
  });
  img.objectCaching = false;
}

function createSoftBrushMask(size, hardness = 0.28) {
  const diameter = Math.max(1, Math.round(size));
  const radius = diameter / 2;

  const mask = document.createElement("canvas");
  mask.width = diameter;
  mask.height = diameter;

  const ctx = mask.getContext("2d", { alpha: true });
  if (!ctx) return mask;

  const inner = Math.max(0, radius * hardness);
  const gradient = ctx.createRadialGradient(radius, radius, inner, radius, radius, radius);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  return mask;
}

function createFeatheredSample(bitmap, sourceX, sourceY, size) {
  const diameter = Math.max(1, Math.round(size));
  const radius = diameter / 2;

  const sample = document.createElement("canvas");
  sample.width = diameter;
  sample.height = diameter;

  const sctx = sample.getContext("2d", { alpha: true });
  if (!sctx) return sample;

  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";

  const sx = Math.round(sourceX - radius);
  const sy = Math.round(sourceY - radius);

  sctx.drawImage(bitmap, sx, sy, diameter, diameter, 0, 0, diameter, diameter);

  const mask = createSoftBrushMask(diameter);
  sctx.globalCompositeOperation = "destination-in";
  sctx.drawImage(mask, 0, 0);

  return sample;
}

function stampCloneDab(img, targetX, targetY, sourceX, sourceY, size, flow = 0.45) {
  const bitmap = initHealBitmapFromImage(img);
  if (!bitmap) return;

  const ctx = bitmap.getContext("2d", { alpha: true });
  if (!ctx) return;

  const diameter = Math.max(1, Math.round(size));
  const radius = diameter / 2;

  const sample = createFeatheredSample(bitmap, sourceX, sourceY, diameter);

  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1, flow));
  ctx.drawImage(sample, Math.round(targetX - radius), Math.round(targetY - radius), diameter, diameter);
  ctx.restore();

  updateImageFromHealBitmap(img, bitmap);
}

function interpolateCloneStroke(img, lastPt, nextPt, offsetX, offsetY, size, flow) {
  if (!lastPt || !nextPt) return;

  const dx = nextPt.x - lastPt.x;
  const dy = nextPt.y - lastPt.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = Math.max(1, size / 6);
  const steps = Math.max(1, Math.ceil(dist / step));

  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const tx = lastPt.x + dx * t;
    const ty = lastPt.y + dy * t;
    const sx = tx + offsetX;
    const sy = ty + offsetY;
    stampCloneDab(img, tx, ty, sx, sy, size, flow);
  }
}

function setHealSourceMarker(canvas, canvasPoint) {
  if (!canvas || !canvasPoint) return;

  if (canvas.__healSourceMarker) {
    canvas.remove(canvas.__healSourceMarker);
    canvas.__healSourceMarker = null;
  }

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

  marker.data = { role: "healSourceMarker" };
  canvas.__healSourceMarker = marker;
  canvas.add(marker);
  canvas.requestRenderAll();
}

function removeHealArtifacts(canvas) {
  if (!canvas) return;

  if (canvas.__healSourceMarker) {
    canvas.remove(canvas.__healSourceMarker);
    canvas.__healSourceMarker = null;
  }

  canvas.__healState = null;
}

function enableHealMode(canvas, options = {}) {
  const { size = 24, flow = 0.45, decimate = 0.2 } = options;

  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = false;
  canvas.defaultCursor = "crosshair";

  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

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

  canvas.on("mouse:down", (opt) => {
    const p = getCanvasPoint(canvas, opt);
    if (!p) return;

    const img = getImageObject(canvas);
    if (!img) return;

    const imgPt = canvasPointToImagePixel(img, p);
    if (!imgPt?.inside) return;

    const state = canvas.__healState;
    if (!state) return;

    if (opt?.e?.altKey || opt?.e?.metaKey) {
      state.sourcePixel = { x: imgPt.x, y: imgPt.y };
      state.sourceCanvasPoint = { x: p.x, y: p.y };
      setHealSourceMarker(canvas, p);
      return;
    }

    if (!state.sourcePixel) return;

    state.isPainting = true;
    state.offsetX = state.sourcePixel.x - imgPt.x;
    state.offsetY = state.sourcePixel.y - imgPt.y;
    state.lastTarget = { x: imgPt.x, y: imgPt.y };

    stampCloneDab(
      img,
      imgPt.x,
      imgPt.y,
      imgPt.x + state.offsetX,
      imgPt.y + state.offsetY,
      state.size,
      state.flow
    );

    img.setCoords?.();
    canvas.setActiveObject?.(img);
    canvas.requestRenderAll?.();
  });

  canvas.on("mouse:move", (opt) => {
    const state = canvas.__healState;
    if (!state?.isPainting) return;

    const p = getCanvasPoint(canvas, opt);
    if (!p) return;

    const img = getImageObject(canvas);
    if (!img) return;

    const imgPt = canvasPointToImagePixel(img, p);
    if (!imgPt?.inside) return;

    interpolateCloneStroke(
      img,
      state.lastTarget,
      { x: imgPt.x, y: imgPt.y },
      state.offsetX,
      state.offsetY,
      state.size,
      state.flow
    );

    state.lastTarget = { x: imgPt.x, y: imgPt.y };

    img.setCoords?.();
    canvas.setActiveObject?.(img);
    canvas.requestRenderAll?.();
  });

  canvas.on("mouse:up", () => {
    const state = canvas.__healState;
    if (!state) return;
    state.isPainting = false;
    state.lastTarget = null;
  });

  canvas.requestRenderAll();
}

function resetCanvasState(canvas) {
  if (!canvas) return;

  canvas.isDrawingMode = false;
  canvas.selection = false;

  removeCropArtifacts(canvas);

  canvas.off("mouse:down");
  canvas.off("mouse:move");
  canvas.off("mouse:up");
  canvas.off("path:created");

  canvas.discardActiveObject();

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
    const isMask = obj?.data?.role === "mask";
    obj.selectable = !isMask;
    obj.evented = !isMask;
  });

  canvas.requestRenderAll();
}

/* =========================================================
   Crop mode
========================================================= */

function enableCropMode(canvas) {
  canvas.isDrawingMode = false;
  canvas.selection = false;
  canvas.defaultCursor = "crosshair";
  canvas.discardActiveObject();

  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

  removeCropArtifacts(canvas);

  const cw = canvas.getWidth();
  const ch = canvas.getHeight();

  const img = canvas.getObjects()?.find((o) => o?.type === "image");
  const base = img?.getBoundingRect?.(true, true) || { left: 0, top: 0, width: cw, height: ch };

  const w = Math.max(140, Math.min(base.width * 0.7, cw * 0.9));
  const h = Math.max(140, Math.min(base.height * 0.7, ch * 0.9));
  const left = Math.max(0, base.left + (base.width - w) / 2);
  const top = Math.max(0, base.top + (base.height - h) / 2);

  const shade = new Rect({
    left: 0,
    top: 0,
    width: cw,
    height: ch,
    fill: "rgba(0,0,0,0)",
    selectable: false,
    evented: false,
    excludeFromExport: true,
    objectCaching: false,
  });

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
  });

  cropRect.data = { role: "cropRect" };

  canvas.add(shade);
  canvas.add(cropRect);

  canvas.__cropShade = shade;
  canvas.__cropRect = cropRect;

  canvas.setActiveObject(cropRect);
  canvas.requestRenderAll();
}

export function applyCropToImage(canvas) {
  if (!canvas) return null;

  const cropRect = canvas.__cropRect;
  if (!cropRect) return null;

  const img = canvas.getObjects()?.find((o) => o?.type === "image");
  if (!img) return null;

  const util = fabricNS.util || fabricNS.fabric?.util;
  const Point = fabricNS.Point || fabricNS.fabric?.Point;
  if (!util || !Point) return null;

  const rect = cropRect.getBoundingRect(true, true);

  const invImg = util.invertTransform(img.calcTransformMatrix());
  const tl = util.transformPoint(new Point(rect.left, rect.top), invImg);
  const br = util.transformPoint(new Point(rect.left + rect.width, rect.top + rect.height), invImg);

  const ox = originOffset(img.originX, img.width);
  const oy = originOffset(img.originY, img.height);

  const tlx = tl.x + ox;
  const tly = tl.y + oy;
  const brx = br.x + ox;
  const bry = br.y + oy;

  const x1 = Math.min(tlx, brx);
  const y1 = Math.min(tly, bry);
  const x2 = Math.max(tlx, brx);
  const y2 = Math.max(tly, bry);

  const baseCropX = img.cropX || 0;
  const baseCropY = img.cropY || 0;

  const sourceW =
    img._originalElement?.naturalWidth ||
    img._originalElement?.width ||
    img.width;
  const sourceH =
    img._originalElement?.naturalHeight ||
    img._originalElement?.height ||
    img.height;

  const cropXLocal = Math.max(0, Math.min(img.width, x1));
  const cropYLocal = Math.max(0, Math.min(img.height, y1));
  const cropW = Math.max(1, Math.min(img.width - cropXLocal, x2 - x1));
  const cropH = Math.max(1, Math.min(img.height - cropYLocal, y2 - y1));

  const cropX = Math.max(0, Math.min(sourceW - 1, baseCropX + cropXLocal));
  const cropY = Math.max(0, Math.min(sourceH - 1, baseCropY + cropYLocal));

  const finalW = Math.max(1, Math.min(sourceW - cropX, cropW));
  const finalH = Math.max(1, Math.min(sourceH - cropY, cropH));

  img.set({
    cropX,
    cropY,
    width: finalW,
    height: finalH,
    dirty: true,
    objectCaching: false,
  });
  img.objectCaching = false;

  removeCropArtifacts(canvas);

  img.setCoords?.();
  canvas.setActiveObject?.(img);
  canvas.requestRenderAll?.();

  return img;
}

export function cancelCrop(canvas) {
  if (!canvas) return;
  removeCropArtifacts(canvas);
  canvas.requestRenderAll();
}

function removeCropArtifacts(canvas) {
  const shade = canvas.__cropShade;
  const rect = canvas.__cropRect;

  if (shade) canvas.remove(shade);
  if (rect) canvas.remove(rect);

  canvas.__cropShade = null;
  canvas.__cropRect = null;
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

  canvas.off("path:created");
  canvas.on("path:created", (e) => {
    if (!e?.path) return;
    e.path.set({ selectable: false, evented: false });
  });

  canvas.requestRenderAll();
}

/* =========================================================
   Mask mode (draws white strokes for AI inpainting)
   Creates paths tagged with data.role = "mask"
========================================================= */

function enableMaskMode(canvas, options = {}) {
  const { size = 40, decimate = 0.4 } = options;

  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = true;
  canvas.defaultCursor = "crosshair";

  const maskBrush = new PencilBrush(canvas);
  maskBrush.color = "rgba(255, 255, 255, 0.6)";
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
      stroke: "rgba(255, 255, 255, 0.6)",
      strokeWidth: size,
    });
    
    path.data = { role: "mask" };
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

  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = true;
  canvas.defaultCursor = "crosshair";

  const eraser = new PencilBrush(canvas);
  eraser.width = size;
  eraser.color = "rgba(0,0,0,1)";
  eraser.decimate = decimate;
  canvas.freeDrawingBrush = eraser;

  canvas.off("path:created");
  canvas.on("path:created", (e) => {
    const path = e?.path;
    if (!path) return;

    path.set({
      selectable: false,
      evented: false,
      globalCompositeOperation: "destination-out",
    });

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

  if (useOriginalSize) {
    return await exportMaskAtOriginalSize(canvas);
  }

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
  
  if (maskObjectCount === 0) {
    console.warn("No mask objects found! (objects with data.role === 'mask')");
  }

  canvas.backgroundColor = "black";
  canvas.requestRenderAll();

  try {
    const dataURL = canvas.toDataURL({
      format: "png",
      multiplier,
      enableRetinaScaling: false,
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
