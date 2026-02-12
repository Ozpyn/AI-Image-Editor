
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas } from "fabric";

import { fabricImageFromURL, loadImageFromFile } from "./loadImage";
import {
  clearCanvas,
  setToolMode,
  exportPNG,
  fitObjectToCanvas,
  setCanvasSize,
} from "./canvasUtils";

export function useCanvas({ activeTool, brushColor, brushSize } = {}) {
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
    setReady(true);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
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
    } else {
      setToolMode(canvas, activeTool || "select");
    }
  }, [activeTool, brushColor, brushSize, ready]);

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

  const exportAsPNG = useCallback((multiplier = 2) => {
    const c = fabricRef.current;
    if (!c) return null;
    return exportPNG(c, multiplier);
  }, []);

  return {
    canvasElRef,
    ready,
    api,
    actions: { setSize, importFile, importFromURL, reset, exportAsPNG },
  };
}
