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
  fitImageToView,
  zoomImage,
  getZoomPercent,
  setCanvasSize,
  applyCropToImage,
  cancelCrop,
  applyImageAdjustments,
  getOriginalSizeMultiplier,
} from "./canvasUtils";

const HISTORY_LIMIT = 50;

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

function isHistoryTransientObject(obj) {
  const role = obj?.data?.role;
  return (
    role === "cropRect" ||
    role === "cropShade" ||
    role === "healSourceMarker"
  );
}

function serializeCanvasSnapshot(canvas) {
  const full = canvas.toJSON(["data"]);
  const filteredObjects = (full.objects || []).filter(
    (obj) => !isHistoryTransientObject(obj)
  );

  return JSON.stringify({
    version: 1,
    meta: {
      fitScale: canvas?.__fitScale ?? 1,
      zoomLevel: canvas?.__zoomLevel ?? 1,
      adjustments: canvas?.__adjustments ?? {
        brightness: 0,
        contrast: 0,
        saturation: 0,
      },
    },
    json: {
      ...full,
      objects: filteredObjects,
    },
  });
}

export function useCanvas({
  activeTool,
  brushColor,
  brushSize,
  healFlow = 0.45,
  adjustments,
  onToolChangeRequest,
} = {}) {
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const adjustmentsRef = useRef(
    adjustments ?? { brightness: 0, contrast: 0, saturation: 0 }
  );
  const activeToolRef = useRef(activeTool || "select");

  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const suppressHistoryRef = useRef(false);
  const isRestoringRef = useRef(false);

  const adjustCommitTimerRef = useRef(null);
  const textAddedRef = useRef(false);

  useEffect(() => {
    adjustmentsRef.current =
      adjustments ?? { brightness: 0, contrast: 0, saturation: 0 };
  }, [adjustments]);

  useEffect(() => {
    activeToolRef.current = activeTool || "select";
  }, [activeTool]);

  const updateHistoryFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

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

  const pushHistorySnapshot = useCallback(
    ({ force = false } = {}) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      if (suppressHistoryRef.current) return;
      if (isRestoringRef.current) return;

      const currentTool = activeToolRef.current;

      if (!force && currentTool === "crop") return;

      const snapshot = serializeCanvasSnapshot(canvas);
      const undoStack = undoStackRef.current;
      const last = undoStack[undoStack.length - 1];

      if (last === snapshot) return;

      undoStack.push(snapshot);
      if (undoStack.length > HISTORY_LIMIT) {
        undoStack.shift();
      }

      redoStackRef.current = [];
      updateHistoryFlags();
    },
    [updateHistoryFlags]
  );

  const restoreSnapshot = useCallback(
    async (snapshotString) => {
      const canvas = fabricRef.current;
      if (!canvas || !snapshotString) return;

      suppressHistoryRef.current = true;
      isRestoringRef.current = true;

      try {
        const snapshot = JSON.parse(snapshotString);

        canvas.discardActiveObject?.();
        await canvas.loadFromJSON(snapshot.json);

        canvas.__cropRect = null;
        canvas.__cropShade = null;
        canvas.__healSourceMarker = null;

        canvas.__fitScale = snapshot?.meta?.fitScale ?? 1;
        canvas.__zoomLevel = snapshot?.meta?.zoomLevel ?? 1;
        canvas.__adjustments =
          snapshot?.meta?.adjustments ?? {
            brightness: 0,
            contrast: 0,
            saturation: 0,
          };

        canvas.renderAll?.();
        setZoomPercent(getZoomPercent(canvas));

        setToolMode(canvas, "select");
        onToolChangeRequest?.("select");

        canvas.requestRenderAll?.();
      } finally {
        isRestoringRef.current = false;
        suppressHistoryRef.current = false;
      }
    },
    [onToolChangeRequest]
  );

  const undo = useCallback(async () => {
    const undoStack = undoStackRef.current;
    const redoStack = redoStackRef.current;

    if (undoStack.length <= 1) return;

    const current = undoStack.pop();
    redoStack.push(current);

    const previous = undoStack[undoStack.length - 1];
    updateHistoryFlags();
    await restoreSnapshot(previous);
  }, [restoreSnapshot, updateHistoryFlags]);

  const redo = useCallback(async () => {
    const undoStack = undoStackRef.current;
    const redoStack = redoStackRef.current;

    if (!redoStack.length) return;

    const next = redoStack.pop();
    undoStack.push(next);

    updateHistoryFlags();
    await restoreSnapshot(next);
  }, [restoreSnapshot, updateHistoryFlags]);

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
    canvas.__adjustments = { brightness: 0, contrast: 0, saturation: 0 };

    fabricRef.current = canvas;
    window.canvas = canvas;

    undoStackRef.current = [];
    redoStackRef.current = [];
    setReady(true);
    setZoomPercent(100);

    pushHistorySnapshot({ force: true });

    return () => {
      if (adjustCommitTimerRef.current) {
        clearTimeout(adjustCommitTimerRef.current);
      }

      canvas.dispose();
      fabricRef.current = null;
      window.canvas = null;
      setReady(false);
      setCanUndo(false);
      setCanRedo(false);
    };
  }, [pushHistorySnapshot]);

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
      setToolMode(canvas, "select");
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
  }, [activeTool, brushColor, brushSize, healFlow, ready]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!ready || !canvas) return;

    const handlePathCreated = () => {
      if (suppressHistoryRef.current) return;

      const tool = activeToolRef.current;
      if (tool === "crop") return;

      if (tool === "brush" || tool === "mask" || tool === "erase") {
        pushHistorySnapshot();
      }
    };

    const handleObjectModified = () => {
      if (suppressHistoryRef.current) return;

      const tool = activeToolRef.current;
      if (tool === "crop") return;
      if (tool === "brush" || tool === "mask" || tool === "erase") return;

      pushHistorySnapshot();
    };

    const handleTextEditingExited = () => {
      if (suppressHistoryRef.current) return;
      pushHistorySnapshot();
    };

    const handleObjectAdded = (event) => {
      if (suppressHistoryRef.current) return;

      const obj = event?.target;
      const tool = activeToolRef.current;

      if (tool === "crop") return;

      if (tool === "text" && obj?.data?.role === "text" && !textAddedRef.current) {
        textAddedRef.current = true;
        pushHistorySnapshot();
      }
    };

    const handleMouseUp = () => {
      if (suppressHistoryRef.current) return;

      const tool = activeToolRef.current;

      if (tool === "heal") {
        pushHistorySnapshot();
      }
    };

    canvas.on("path:created", handlePathCreated);
    canvas.on("object:modified", handleObjectModified);
    canvas.on("text:editing:exited", handleTextEditingExited);
    canvas.on("object:added", handleObjectAdded);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("path:created", handlePathCreated);
      canvas.off("object:modified", handleObjectModified);
      canvas.off("text:editing:exited", handleTextEditingExited);
      canvas.off("object:added", handleObjectAdded);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [ready, pushHistorySnapshot]);

  useEffect(() => {
    textAddedRef.current = false;
  }, [activeTool]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!ready || !canvas) return;

    safeApplyAdjustments(canvas);

    if (suppressHistoryRef.current) return;
    if (activeTool === "crop") return;

    if (adjustCommitTimerRef.current) {
      clearTimeout(adjustCommitTimerRef.current);
    }

    adjustCommitTimerRef.current = setTimeout(() => {
      pushHistorySnapshot();
    }, 250);

    return () => {
      if (adjustCommitTimerRef.current) {
        clearTimeout(adjustCommitTimerRef.current);
      }
    };
  }, [ready, adjustments, activeTool, safeApplyAdjustments, pushHistorySnapshot]);

  const setSize = useCallback(
    (w, h) => {
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
    },
    [safeApplyAdjustments]
  );

  const importFile = useCallback(
    async (file) => {
      const c = fabricRef.current;
      if (!c) return;

      const dataURL = await loadImageFromFile(file, { normalize: true });
      const img = await fabricImageFromURL(dataURL, { selectable: true });

      suppressHistoryRef.current = true;
      try {
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
      } finally {
        suppressHistoryRef.current = false;
      }

      pushHistorySnapshot({ force: true });
    },
    [safeApplyAdjustments, pushHistorySnapshot]
  );

  const importFromURL = useCallback(
    async (url) => {
      const c = fabricRef.current;
      if (!c) return;

      const img = await fabricImageFromURL(url, { selectable: true });

      suppressHistoryRef.current = true;
      try {
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
      } finally {
        suppressHistoryRef.current = false;
      }

      pushHistorySnapshot({ force: true });
    },
    [safeApplyAdjustments, pushHistorySnapshot]
  );

  const reset = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    suppressHistoryRef.current = true;
    try {
      clearCanvas(c);
      setZoomPercent(100);
    } finally {
      suppressHistoryRef.current = false;
    }

    pushHistorySnapshot({ force: true });
  }, [pushHistorySnapshot]);

  const clearMask = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    suppressHistoryRef.current = true;
    try {
      clearMaskObjects(c);
    } finally {
      suppressHistoryRef.current = false;
    }

    pushHistorySnapshot({ force: true });
  }, [pushHistorySnapshot]);

  const exportAsPNG = useCallback((multiplier = 1) => {
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

  const applyBlobResult = useCallback(
    async (blob, opts) => {
      const c = fabricRef.current;
      if (!c) return;

      suppressHistoryRef.current = true;
      try {
        await applyResultBlob(c, blob, opts);
        safeApplyAdjustments(c);
        c.requestRenderAll?.();
        setZoomPercent(getZoomPercent(c));
      } finally {
        suppressHistoryRef.current = false;
      }

      pushHistorySnapshot({ force: true });
    },
    [pushHistorySnapshot, safeApplyAdjustments]
  );

  const getExportMultiplier = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return 1;
    return getOriginalSizeMultiplier(c);
  }, []);

  const applyCrop = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    suppressHistoryRef.current = true;
    try {
      const img = applyCropToImage(c);
      if (!img) return;

      img.objectCaching = false;
      img.set?.({ objectCaching: false });

      c.__cropRect = null;
      c.__cropShade = null;

      fitObjectToCanvas(c, img, 32);
      c.setActiveObject?.(img);
      safeApplyAdjustments(c);
      c.requestRenderAll?.();
      setZoomPercent(getZoomPercent(c));

      setToolMode(c, "select");
    } finally {
      suppressHistoryRef.current = false;
    }

    onToolChangeRequest?.("select");
    pushHistorySnapshot({ force: true });
  }, [safeApplyAdjustments, pushHistorySnapshot, onToolChangeRequest]);

  const cancelCropAction = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    cancelCrop(c);
    setToolMode(c, "select");
    onToolChangeRequest?.("select");
  }, [onToolChangeRequest]);

  const actions = useMemo(
    () => ({
      setSize,
      importFile,
      importFromURL,
      reset,
      exportAsPNG,
      clearMask,
      exportAsPNGBlob,
      exportAsMaskBlob,
      applyBlobResult,
      getExportMultiplier,
      zoomIn,
      zoomOut,
      fitToView,
      applyCrop,
      cancelCrop: cancelCropAction,
      undo,
      redo,
      canUndo,
      canRedo,
    }),
    [
      setSize,
      importFile,
      importFromURL,
      reset,
      exportAsPNG,
      clearMask,
      exportAsPNGBlob,
      exportAsMaskBlob,
      applyBlobResult,
      getExportMultiplier,
      zoomIn,
      zoomOut,
      fitToView,
      applyCrop,
      cancelCropAction,
      undo,
      redo,
      canUndo,
      canRedo,
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