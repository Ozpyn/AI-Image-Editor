

/** Will have all canvas related utility functions like fitting objects, clearing canvas, exporting, zoom
 * Fit a fabric object (typically an image) into the canvas bounds with padding.
 */
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

