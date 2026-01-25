/* we will use fabric so: npm i fabric */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas } from "fabric";

import { fabricImageFromURL, loadImageFromFile } from "./loadImage";
import { clearCanvas, exportPNG, fitObjectToCanvas, setCanvasSize } from "./canvasUtils";

export function useCanvas() {
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

    fabricRef.current = canvas;
    setReady(true);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setReady(false);
    };
  }, []);

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
