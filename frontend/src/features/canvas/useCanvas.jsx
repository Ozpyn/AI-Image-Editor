import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas } from "fabric";

import { fabricImageFromURL, loadImageFromFile } from "./loadImage";
import {
  clearCanvas,
  setToolMode,
  exportPNG,
  fitObjectToCanvas,
  fitImageToView,
  zoomImage,
  getZoomPercent,
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

export function useCanvas({ activeTool, brushColor, brushSize, healFlow = 0.45, adjustments } = {}) {
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);

  const adjustmentsRef = useRef(adjustments ?? { brightness: 0, contrast: 0, saturation: 0 });

  useEffect(() => {
    adjustmentsRef.current =
      adjustments ?? { brightness: 0, contrast: 0, saturation: 0 };
  }, [adjustments]);

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

    canvas.__fitScale = 1;
    canvas.__zoomLevel = 1;

    fabricRef.current = canvas;
    setReady(true);
    setZoomPercent(100);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!ready || !canvas) return;

    if (activeTool === "brush") {
      setToolMode(canvas, "brush", {
        color: brushColor ?? "#ff3b30",
        size: brushSize ?? 12,
      });
    } else if (activeTool === "heal") {
      setToolMode(canvas, "heal", {
        size: brushSize ?? 24,
        flow: healFlow ?? 0.45,
      });
    } else if (activeTool === "adjust") {
      // Adjustments should keep the canvas in a neutral/select state
      setToolMode(canvas, "select");
    } else {
      setToolMode(canvas, activeTool || "select");
    }
  }, [activeTool, brushColor, brushSize, healFlow, ready]);

  const safeApplyAdjustments = useCallback((canvas) => {
    if (!canvas) return;
    if (!hasRealSize(canvas)) return;

    const img = getFirstImage(canvas);
    if (!img) return;

    const nextAdj =
      adjustmentsRef.current ?? { brightness: 0, contrast: 0, saturation: 0 };

    canvas.__adjustments = nextAdj;
    canvas.setActiveObject?.(img);
    applyImageAdjustments(canvas, nextAdj);
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!ready || !canvas) return;
    safeApplyAdjustments(canvas);
  }, [ready, adjustments, safeApplyAdjustments]);

  const setSize = useCallback((w, h) => {
    const c = fabricRef.current;
    if (!c) return;

    setCanvasSize(c, w, h);

    const img = getFirstImage(c);
    if (!img) return;

    fitImageToView(c, 32);
    c.setActiveObject?.(img);
    safeApplyAdjustments(c);
    c.requestRenderAll?.();
    setZoomPercent(getZoomPercent(c));
  }, [safeApplyAdjustments]);

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
        c.requestRenderAll?.();
        setZoomPercent(getZoomPercent(c));
      }
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
        c.requestRenderAll?.();
        setZoomPercent(getZoomPercent(c));
      }
    },
    [safeApplyAdjustments]
  );

  const reset = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    clearCanvas(c);
    setZoomPercent(100);
  }, []);

  const exportAsPNG = useCallback((multiplier = 2) => {
    const c = fabricRef.current;
    if (!c) return null;
    return exportPNG(c, multiplier);
  }, []);

  const zoomIn = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const percent = zoomImage(c, 1.2);
    setZoomPercent(percent);
  }, []);

  const zoomOut = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const percent = zoomImage(c, 1 / 1.2);
    setZoomPercent(percent);
  }, []);

  const fitToView = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const percent = fitImageToView(c, 32);
    setZoomPercent(percent);
    safeApplyAdjustments(c);
    c.requestRenderAll?.();
  }, [safeApplyAdjustments]);

  const applyCrop = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    const img = applyCropToImage(c);
    if (!img) return;

    img.objectCaching = false;
    img.set?.({ objectCaching: false });

    fitObjectToCanvas(c, img, 32);
    c.setActiveObject?.(img);
    safeApplyAdjustments(c);
    c.requestRenderAll?.();
    setZoomPercent(getZoomPercent(c));

    setToolMode(c, "select");
  }, [safeApplyAdjustments]);

  const cancelCropAction = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    cancelCrop(c);
    setToolMode(c, "select");
  }, []);

  const actions = useMemo(
    () => ({
      setSize,
      importFile,
      importFromURL,
      reset,
      exportAsPNG,
      zoomIn,
      zoomOut,
      fitToView,
      applyCrop,
      cancelCrop: cancelCropAction,
    }),
    [
      setSize,
      importFile,
      importFromURL,
      reset,
      exportAsPNG,
      zoomIn,
      zoomOut,
      fitToView,
      applyCrop,
      cancelCropAction,
    ]
  );

  const api = useMemo(() => {
    return {
      get canvas() {
        return fabricRef.current;
      },
    };
  }, []);

  return {
    canvasElRef,
    ready,
    zoomPercent,
    api,
    actions,
  };
}