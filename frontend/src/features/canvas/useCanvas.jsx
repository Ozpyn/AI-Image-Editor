import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas } from "fabric";

import { fabricImageFromURL, loadImageFromFile } from "./loadImage";
import {
  clearCanvas,
  clearMaskObjects,
  setToolMode,
  exportPNG,
  exportPNGBlob,
  exportMaskBlob,
  applyResultBlob,
  fitObjectToCanvas,
  setCanvasSize,
  applyCropToImage,
  cancelCrop,
  applyImageAdjustments,
  getOriginalSizeMultiplier,
} from "./canvasUtils";

export function useCanvas({ activeTool, brushColor, brushSize, adjustments } = {}) {
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasElRef.current) return;

    const canvas = new Canvas(canvasElRef.current, {
      backgroundColor: "transparent",
      preserveObjectStacking: true,
      selection: true,
    });

    fabricRef.current = canvas;
    window.canvas = canvas;
    setReady(true);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      window.canvas = null;
      setReady(false);
    };
  }, []);

  // Canvas listens to activeTool (and brush options) and sets mode accordingly
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!ready || !canvas) return;

    if ((activeTool || "select") === "brush") {
      setToolMode(canvas, "brush", {
        color: brushColor ?? "#ff3b30",
        size: brushSize ?? 12,
      });
    } else if (activeTool === "mask") {
      setToolMode(canvas, "mask", {
        size: brushSize ?? 40,
      });
    } else if (activeTool === "erase") {
      setToolMode(canvas, "erase", {
        size: brushSize ?? 40,
      });
    } else {
      setToolMode(canvas, activeTool || "select");
    }
  }, [activeTool, brushColor, brushSize, ready]);

  // Apply image adjustments whenever they change
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!ready || !canvas) return;
    if (!adjustments) return;
    applyImageAdjustments(canvas, adjustments);
  }, [adjustments, ready]);

  // api object to expose canvas instance
  const api = useMemo(() => {
    return {
      get canvas() {
        return fabricRef.current;
      },
    };
  }, []);

  const setSize = useCallback((w, h) => {
    const c = fabricRef.current;
    if (!c) return;
    setCanvasSize(c, w, h);
  }, []);

  const importFile = useCallback(async (file) => {
    const c = fabricRef.current;
    if (!c) return;

    const dataURL = await loadImageFromFile(file);
    const img = await fabricImageFromURL(dataURL, { selectable: true });

    clearCanvas(c);
    c.add(img);
    fitObjectToCanvas(c, img, 32);
    c.setActiveObject(img);
    c.requestRenderAll();
  }, []);

  const importFromURL = useCallback(async (url) => {
    const c = fabricRef.current;
    if (!c) return;

    const img = await fabricImageFromURL(url, { selectable: true });
    clearCanvas(c);
    c.add(img);
    fitObjectToCanvas(c, img, 32);
    c.setActiveObject(img);
    c.requestRenderAll();
  }, []);

  const reset = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    clearCanvas(c);
  }, []);

  const clearMask = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    clearMaskObjects(c);
  }, []);

  const exportAsPNG = useCallback((multiplier = 1) => {
    const c = fabricRef.current;
    if (!c) return null;
    return exportPNG(c, multiplier);
  }, []);

  const exportAsPNGBlob = useCallback(async (multiplier = 1, useOriginalSize = false) => {
    const c = fabricRef.current;
    if (!c) return null;
    return await exportPNGBlob(c, multiplier, useOriginalSize);
  }, []);

  const exportAsMaskBlob = useCallback(async (multiplier = 1, useOriginalSize = false) => {
    const c = fabricRef.current;
    if (!c) return null;
    return await exportMaskBlob(c, multiplier, useOriginalSize);
  }, []);

  const applyBlobResult = useCallback(async (blob, opts) => {
    const c = fabricRef.current;
    if (!c) return;
    await applyResultBlob(c, blob, opts);
  }, []);

  const getExportMultiplier = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return 1;
    return getOriginalSizeMultiplier(c);
  }, []);

  const applyCrop = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    const img = applyCropToImage(c);
    if (!img) return;

    img.objectCaching = false;

    fitObjectToCanvas(c, img, 32);
    c.setActiveObject?.(img);
    c.requestRenderAll?.();

    setToolMode(c, "select");
  }, []);

  const cancelCropAction = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    cancelCrop(c);
    setToolMode(c, "select");
  }, []);

  const actions = useMemo(() => {
    return {
      setSize,
      importFile,
      importFromURL,
      reset,
      clearMask,
      exportAsPNG,
      exportAsPNGBlob,
      exportAsMaskBlob,
      applyBlobResult,
      getExportMultiplier,
      applyCrop,
      cancelCrop: cancelCropAction,
    };
  }, [
    setSize,
    importFile,
    importFromURL,
    reset,
    clearMask,
    exportAsPNG,
    exportAsPNGBlob,
    exportAsMaskBlob,
    applyBlobResult,
    getExportMultiplier,
    applyCrop,
    cancelCropAction,
  ]);

  return {
    canvasElRef,
    ready,
    api,
    actions,
  };
}
