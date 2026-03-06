import * as fabricNS from "fabric";

const { PencilBrush, Textbox, IText, Rect } = fabricNS;
const Filters = fabricNS.filters || fabricNS.fabric?.filters;

/**
 * Force 2D filter backend to avoid WebGL texture cropping/strips on some large images.
 /** */
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

/**
 * Canvas utility + tool-mode handlers.
 */

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

function resetCanvasState(canvas) {
  canvas.isDrawingMode = false;
  canvas.selection = false;
  canvas.defaultCursor = "default";

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
}

function enableSelectMode(canvas) {
  canvas.isDrawingMode = false;
  canvas.selection = true;
  canvas.defaultCursor = "default";

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

/* ------------------------------- Image utils ------------------------------ */

export function fitObjectToCanvas(canvas, obj, padding = 32) {
  if (!canvas || !obj) return;

  const cw = canvas.getWidth();
  const ch = canvas.getHeight();

  const availableW = Math.max(1, cw - padding * 2);
  const availableH = Math.max(1, ch - padding * 2);

  const rawW = Math.max(1, obj.width || 1);
  const rawH = Math.max(1, obj.height || 1);

  const scale = Math.min(availableW / rawW, availableH / rawH);

  obj.set({
    originX: "center",
    originY: "center",
    left: cw / 2,
    top: ch / 2,
    scaleX: scale,
    scaleY: scale,
  });

  obj.setCoords?.();
  canvas.requestRenderAll?.();
}

export function clearCanvas(canvas) {
  if (!canvas) return;
  canvas.getObjects().forEach((o) => canvas.remove(o));
  canvas.requestRenderAll();
}

export function exportPNG(canvas, multiplier = 2) {
  if (!canvas) return null;
  return canvas.toDataURL({
    format: "png",
    multiplier,
    enableRetinaScaling: true,
  });
}

export function setCanvasSize(canvas, width, height) {
  if (!canvas) return;

  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));

  if (typeof canvas.setDimensions === "function") {
    canvas.setDimensions({ width: w, height: h });
  } else {
    canvas.setWidth?.(w);
    canvas.setHeight?.(h);
  }

  canvas.calcOffset?.();
  canvas.requestRenderAll?.();
}

/* -------------------------- Image adjustment utils ------------------------- */

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
  img.set?.({ objectCaching: false });
  img.set?.("dirty", true);

  const nextFilters = [];
  if (Math.abs(brightness) > 1e-6) nextFilters.push(new Filters.Brightness({ brightness }));
  if (Math.abs(contrast) > 1e-6) nextFilters.push(new Filters.Contrast({ contrast }));
  if (Math.abs(saturation) > 1e-6) nextFilters.push(new Filters.Saturation({ saturation }));

  img.filters = nextFilters;

  const after = () => {
    img.setCoords?.();
    fitObjectToCanvas(canvas, img, 32);
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

/* ------------------------------- Tool modes ------------------------------ */

function enableBrushMode(canvas, options = {}) {
  const { color = "#ff3b30", size = 12, decimate = 0.2 } = options;

  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = true;
  canvas.defaultCursor = "crosshair";

  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

  const brush = new PencilBrush(canvas);
  brush.width = size;
  brush.color = color;
  brush.decimate = decimate;
  canvas.freeDrawingBrush = brush;

  canvas.on("path:created", (e) => {
    const path = e.path;
    path.set({ selectable: false, evented: false });
    path.data = { role: "brush" };
  });

  canvas.requestRenderAll();
}

function enableEraseMode(canvas) {
  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = true;
  canvas.defaultCursor = "crosshair";

  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

  const brush = new PencilBrush(canvas);
  brush.width = 50;
  brush.color = "white";
  brush.decimate = 0.4;
  canvas.freeDrawingBrush = brush;

  canvas.on("path:created", (e) => {
    const path = e.path;
    path.set({ selectable: false, evented: false });
    path.data = { role: "mask" };
  });

  canvas.requestRenderAll();
}

function enableTextMode(canvas) {
  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.isDrawingMode = false;
  canvas.defaultCursor = "text";

  canvas.forEachObject((obj) => {
    obj.selectable = false;
    obj.evented = false;
  });

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

  const TextClass = Textbox || IText;

  canvas.on("mouse:down", (opt) => {
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

    textObj.data = { role: "text" };

    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    canvas.requestRenderAll();

    setTimeout(() => {
      textObj.enterEditing?.();
      textObj.hiddenTextarea?.focus?.();
    }, 0);
  });

  canvas.requestRenderAll();
}

/* ------------------------------- Crop tool ------------------------------- */

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
    fill: "rgba(0,0,0,0)", // keep your current look
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

/**
 * ✅ NEW: Apply crop to the IMAGE OBJECT (high quality).
 */
export function applyCropToImage(canvas) {
  if (!canvas) return null;

  const cropRect = canvas.__cropRect;
  if (!cropRect) return null;

  const img = canvas.getObjects()?.find((o) => o?.type === "image");
  if (!img) return null;

  const util = fabricNS.util || fabricNS.fabric?.util;
  const Point = fabricNS.Point || fabricNS.fabric?.Point;
  if (!util || !Point) return null;

  // Crop rect bounds in world/canvas coords
  const rect = cropRect.getBoundingRect(true, true);

  // Convert world/canvas points -> image local coords
  const invImg = util.invertTransform(img.calcTransformMatrix());
  const tl = util.transformPoint(new Point(rect.left, rect.top), invImg);
  const br = util.transformPoint(new Point(rect.left + rect.width, rect.top + rect.height), invImg);

  // ✅ Convert from "origin-based local coords" to "top-left local coords"
  const originOffset = (origin, size) => {
    if (origin === "left" || origin === "top") return 0;
    if (origin === "center") return size / 2;
    if (origin === "right" || origin === "bottom") return size;
    return 0;
  };

  const ox = originOffset(img.originX, img.width);
  const oy = originOffset(img.originY, img.height);

  const tlx = tl.x + ox;
  const tly = tl.y + oy;
  const brx = br.x + ox;
  const bry = br.y + oy;

  // Normalize
  const x1 = Math.min(tlx, brx);
  const y1 = Math.min(tly, bry);
  const x2 = Math.max(tlx, brx);
  const y2 = Math.max(tly, bry);

  // Support repeated crops: add existing crop offsets
  const baseCropX = img.cropX || 0;
  const baseCropY = img.cropY || 0;

  // Use source image dimensions if available
  const sourceW =
    img._originalElement?.naturalWidth ||
    img._originalElement?.width ||
    img.width;
  const sourceH =
    img._originalElement?.naturalHeight ||
    img._originalElement?.height ||
    img.height;

  // Clamp within current visible window (img.width/img.height are current crop window)
  const cropXLocal = Math.max(0, Math.min(img.width, x1));
  const cropYLocal = Math.max(0, Math.min(img.height, y1));
  const cropW = Math.max(1, Math.min(img.width - cropXLocal, x2 - x1));
  const cropH = Math.max(1, Math.min(img.height - cropYLocal, y2 - y1));

  // Final crop in source coords
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

  // Remove crop UI
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