import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas } from "fabric";

import { fabricImageFromURL, loadImageFromFile } from "./loadImage";
import {
  clearCanvas,
  setToolMode,
  exportPNG,
  fitObjectToCanvas,
  setCanvasSize,
  applyCropToImage, 
  cancelCrop,
  applyImageAdjustments,
} from "./canvasUtils";

function hasRealSize(canvas) {
  if (!canvas) return false;
  const w = typeof canvas.getWidth === "function" ? canvas.getWidth() : canvas.width;
  const h = typeof canvas.getHeight === "function" ? canvas.getHeight() : canvas.height;
  return w > 2 && h > 2;
}

function getFirstImage(canvas) {
  if (!canvas) return null;
  const active = canvas.getActiveObject?.();
  if (active && active.type === "image") return active;
  return canvas.getObjects?.().find((o) => o?.type === "image") || null;
}

export function useCanvas({ activeTool, brushColor, brushSize, adjustments } = {}) {
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasElRef.current) return;

    const canvas = new Canvas(canvasElRef.current, {
      backgroundColor: "transparent",
      preserveObjectStacking: true,
      selection: true,
    });

    canvasElRef.current.style.width = "100%";
    canvasElRef.current.style.height = "100%";
    canvasElRef.current.style.display = "block";

    fabricRef.current = canvas;
    setReady(true);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!ready || !canvas) return;

    if ((activeTool || "select") === "brush") {
      setToolMode(canvas, "brush", {
        color: brushColor ?? "#ff3b30",
        size: brushSize ?? 12,
      });
    } else {
      setToolMode(canvas, activeTool || "select");
    }
  }, [activeTool, brushColor, brushSize, ready]);

  const safeApplyAdjustments = useCallback(
    (canvas) => {
      if (!canvas) return;
      if (!hasRealSize(canvas)) return;

      const img = getFirstImage(canvas);
      if (!img) return;

      const nextAdj =
        adjustments ?? canvas.__adjustments ?? { brightness: 0, contrast: 0, saturation: 0 };
      canvas.__adjustments = nextAdj;

      canvas.setActiveObject?.(img);
      applyImageAdjustments(canvas, nextAdj);
    },
    [adjustments]
  );

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!ready || !canvas) return;
    safeApplyAdjustments(canvas);
  }, [safeApplyAdjustments, ready]);

  const api = useMemo(() => {
    return {
      get canvas() {
        return fabricRef.current;
      },
    };
  }, []);

  const setSize = useCallback(
    (w, h) => {
      const c = fabricRef.current;
      if (!c) return;

      setCanvasSize(c, w, h);

      const img = getFirstImage(c);
      if (img) {
        fitObjectToCanvas(c, img, 32);
        c.setActiveObject?.(img);
      }

      safeApplyAdjustments(c);

      requestAnimationFrame(() => {
        if (!hasRealSize(c)) return;
        const img2 = getFirstImage(c);
        if (!img2) return;
        fitObjectToCanvas(c, img2, 32);
        c.setActiveObject?.(img2);
        safeApplyAdjustments(c);
        c.requestRenderAll?.();
      });
    },
    [safeApplyAdjustments]
  );

  const importFile = useCallback(
    async (file) => {
      const c = fabricRef.current;
      if (!c) return;

      const dataURL = await loadImageFromFile(file);
      const img = await fabricImageFromURL(dataURL, { selectable: true });

      clearCanvas(c);
      c.add(img);

      
      img.objectCaching = false;
      img.set?.({ objectCaching: false });

      if (hasRealSize(c)) {
        fitObjectToCanvas(c, img, 32);
        c.setActiveObject(img);
        safeApplyAdjustments(c);
        c.requestRenderAll();
      }

      requestAnimationFrame(() => {
        if (!hasRealSize(c)) return;
        const i = getFirstImage(c);
        if (!i) return;

        i.objectCaching = false;
        i.set?.({ objectCaching: false });

        fitObjectToCanvas(c, i, 32);
        c.setActiveObject?.(i);
        safeApplyAdjustments(c);
        c.requestRenderAll?.();
      });
    },
    [safeApplyAdjustments]
  );

  const importFromURL = useCallback(
    async (url) => {
      const c = fabricRef.current;
      if (!c) return;

      const img = await fabricImageFromURL(url, { selectable: true });

      clearCanvas(c);
      c.add(img);

      img.objectCaching = false;
      img.set?.({ objectCaching: false });

      if (hasRealSize(c)) {
        fitObjectToCanvas(c, img, 32);
        c.setActiveObject(img);
        safeApplyAdjustments(c);
        c.requestRenderAll();
      }

      requestAnimationFrame(() => {
        if (!hasRealSize(c)) return;
        const i = getFirstImage(c);
        if (!i) return;

        i.objectCaching = false;
        i.set?.({ objectCaching: false });

        fitObjectToCanvas(c, i, 32);
        c.setActiveObject?.(i);
        safeApplyAdjustments(c);
        c.requestRenderAll?.();
      });
    },
    [safeApplyAdjustments]
  );

  const reset = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    clearCanvas(c);
  }, []);

  const exportAsPNG = useCallback((multiplier = 2) => {
    const c = fabricRef.current;
    if (!c) return null;
    return exportPNG(c, multiplier);
  }, []);

  /**
   * ✅ NEW APPLY CROP
   * Crops the existing image object in-place (best quality & best UX)
   * instead of exporting a dataURL and re-importing.
   */
  const applyCrop = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    const img = applyCropToImage(c);
    if (!img) return;

    
    img.objectCaching = false;
    img.set?.({ objectCaching: false });

    // Fit cropped image nicely into canvas
    fitObjectToCanvas(c, img, 32);
    c.setActiveObject?.(img);

    // Re-apply adjustments after crop
    safeApplyAdjustments(c);

    c.requestRenderAll?.();

    // Back to select after applying crop
    setToolMode(c, "select");
  }, [safeApplyAdjustments]);

  const cancelCropAction = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    cancelCrop(c);
    setToolMode(c, "select");
  }, []);

  return {
    canvasElRef,
    ready,
    api,
    actions: {
      setSize,
      importFile,
      importFromURL,
      reset,
      exportAsPNG,
      applyCrop,
      cancelCrop: cancelCropAction,
    },
  };
}