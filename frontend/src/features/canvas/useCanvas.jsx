// Import React hooks used by the custom hook
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

// Import Fabric Canvas class
import { Canvas } from "fabric";

// Import image loading helpers
import { fabricImageFromURL, loadImageFromFile } from "./loadImage";

// Import canvas utility functions
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
  rotateImageBy,
  resetImageRotation,
} from "./canvasUtils";

// Maximum number of history states stored for undo/redo
const HISTORY_LIMIT = 50;

// Check whether the canvas has a usable width and height
function hasRealSize(canvas) {
  // Return false if canvas is missing
  if (!canvas) return false;

  // Read width from Fabric API or fallback property
  const w = typeof canvas.getWidth === "function" ? canvas.getWidth() : canvas.width;

  // Read height from Fabric API or fallback property
  const h = typeof canvas.getHeight === "function" ? canvas.getHeight() : canvas.height;

  // Return whether both dimensions are meaningful
  return w > 2 && h > 2;
}

// Return the first image on the canvas
function getFirstImage(canvas) {
  // Return null if canvas is missing
  if (!canvas) return null;

  // Prefer currently active image object
  const active = canvas.getActiveObject?.();
  if (active && active.type === "image") return active;

  // Otherwise return first image object
  return canvas.getObjects?.().find((o) => o?.type === "image") || null;
}

// Ignore temporary helper objects when saving history snapshots
function isHistoryTransientObject(obj) {
  // Read helper role
  const role = obj?.data?.role;

  // Return true for temporary objects that should not go into history
  return role === "cropRect" || role === "cropShade" || role === "healSourceMarker";
}

// Serialize the current canvas state for undo/redo history
function serializeCanvasSnapshot(canvas) {
  // Convert Fabric canvas to JSON and include custom "data" field
  const full = canvas.toJSON(["data"]);

  // Remove temporary helper objects from history snapshot
  const filteredObjects = (full.objects || []).filter(
    (obj) => !isHistoryTransientObject(obj)
  );

  // Return JSON string containing metadata and filtered canvas content
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

// Custom hook that manages the Fabric canvas and all its actions
export function useCanvas({
  // Active tool selected by the user
  activeTool,

  // Brush color
  brushColor,

  // Brush size
  brushSize,

  // Heal flow value
  healFlow = 0.45,

  // Current image adjustments
  adjustments,

  // Parent callback used when tool needs to change
  onToolChangeRequest,
} = {}) {
  // Ref to the actual HTML canvas element
  const canvasElRef = useRef(null);

  // Ref to the Fabric canvas instance
  const fabricRef = useRef(null);

  // Whether Fabric is ready
  const [ready, setReady] = useState(false);

  // UI zoom percentage display
  const [zoomPercent, setZoomPercent] = useState(100);

  // Undo button availability
  const [canUndo, setCanUndo] = useState(false);

  // Redo button availability
  const [canRedo, setCanRedo] = useState(false);

  // Keep latest adjustments available inside callbacks
  const adjustmentsRef = useRef(
    adjustments ?? { brightness: 0, contrast: 0, saturation: 0 }
  );

  // Keep latest tool available inside callbacks
  const activeToolRef = useRef(activeTool || "select");

  // Undo stack
  const undoStackRef = useRef([]);

  // Redo stack
  const redoStackRef = useRef([]);

  // Prevent history writes during internal updates
  const suppressHistoryRef = useRef(false);

  // Prevent overlapping restore operations
  const isRestoringRef = useRef(false);

  // Timer used to debounce adjustment history saves
  const adjustCommitTimerRef = useRef(null);

  // Guard to avoid duplicate history pushes when creating text
  const textAddedRef = useRef(false);

  // Update adjustments ref when props change
  useEffect(() => {
    adjustmentsRef.current =
      adjustments ?? { brightness: 0, contrast: 0, saturation: 0 };
  }, [adjustments]);

  // Update active tool ref when props change
  useEffect(() => {
    activeToolRef.current = activeTool || "select";
  }, [activeTool]);

  // Refresh canUndo / canRedo flags from history stacks
  const updateHistoryFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  // Safely apply current adjustments to the first image
  const safeApplyAdjustments = useCallback((canvas) => {
    // Stop if canvas is missing
    if (!canvas) return;

    // Stop if canvas size is not usable yet
    if (!hasRealSize(canvas)) return;

    // Find current image
    const img = getFirstImage(canvas);

    // Stop if image is missing
    if (!img) return;

    // Read latest adjustments
    const nextAdj =
      adjustmentsRef.current ?? { brightness: 0, contrast: 0, saturation: 0 };

    // Store adjustments on canvas
    canvas.__adjustments = nextAdj;

    // Keep image active
    canvas.setActiveObject?.(img);

    // Apply filters
    applyImageAdjustments(canvas, nextAdj);
  }, []);

  // Save the current canvas state into history
  const pushHistorySnapshot = useCallback(
    ({ force = false } = {}) => {
      // Read current Fabric canvas
      const canvas = fabricRef.current;

      // Stop if canvas is missing
      if (!canvas) return;

      // Stop if history writing is temporarily suppressed
      if (suppressHistoryRef.current) return;

      // Stop while restoring history
      if (isRestoringRef.current) return;

      // Read current tool
      const currentTool = activeToolRef.current;

      // While crop is active, do not save every crop rectangle move unless forced
      if (!force && currentTool === "crop") return;

      // Serialize current state
      const snapshot = serializeCanvasSnapshot(canvas);

      // Read current undo stack
      const undoStack = undoStackRef.current;

      // Read last snapshot in stack
      const last = undoStack[undoStack.length - 1];

      // Stop if snapshot is unchanged
      if (last === snapshot) return;

      // Push new snapshot
      undoStack.push(snapshot);

      // Enforce history limit
      if (undoStack.length > HISTORY_LIMIT) {
        undoStack.shift();
      }

      // Clear redo stack after new action
      redoStackRef.current = [];

      // Refresh undo/redo UI flags
      updateHistoryFlags();
    },
    [updateHistoryFlags]
  );

  // Restore one saved history snapshot
  const restoreSnapshot = useCallback(
    async (snapshotString) => {
      // Read Fabric canvas
      const canvas = fabricRef.current;

      // Stop if missing
      if (!canvas || !snapshotString) return;

      // Suppress history writes while restoring
      suppressHistoryRef.current = true;
      isRestoringRef.current = true;

      try {
        // Parse snapshot JSON
        const snapshot = JSON.parse(snapshotString);

        // Clear active object before loading
        canvas.discardActiveObject?.();

        // Load Fabric objects from JSON
        await canvas.loadFromJSON(snapshot.json);

        // Reset helper references
        canvas.__cropRect = null;
        canvas.__cropShade = null;
        canvas.__healSourceMarker = null;

        // Restore view metadata
        canvas.__fitScale = snapshot?.meta?.fitScale ?? 1;
        canvas.__zoomLevel = snapshot?.meta?.zoomLevel ?? 1;
        canvas.__adjustments =
          snapshot?.meta?.adjustments ?? {
            brightness: 0,
            contrast: 0,
            saturation: 0,
          };

        // Render loaded state
        canvas.renderAll?.();

        // Refresh zoom display
        setZoomPercent(getZoomPercent(canvas));

        // Return to select mode after restore for stability
        setToolMode(canvas, "select");
        onToolChangeRequest?.("select");

        // Final redraw
        canvas.requestRenderAll?.();
      } finally {
        // Re-enable history writes
        isRestoringRef.current = false;
        suppressHistoryRef.current = false;
      }
    },
    [onToolChangeRequest]
  );

  // Undo one step
  const undo = useCallback(async () => {
    // Read stacks
    const undoStack = undoStackRef.current;
    const redoStack = redoStackRef.current;

    // Stop if there is nothing meaningful to undo
    if (undoStack.length <= 1) return;

    // Move current snapshot to redo stack
    const current = undoStack.pop();
    redoStack.push(current);

    // Restore previous snapshot
    const previous = undoStack[undoStack.length - 1];
    updateHistoryFlags();
    await restoreSnapshot(previous);
  }, [restoreSnapshot, updateHistoryFlags]);

  // Redo one step
  const redo = useCallback(async () => {
    // Read stacks
    const undoStack = undoStackRef.current;
    const redoStack = redoStackRef.current;

    // Stop if redo stack is empty
    if (!redoStack.length) return;

    // Move next redo snapshot into undo stack
    const next = redoStack.pop();
    undoStack.push(next);

    // Restore next snapshot
    updateHistoryFlags();
    await restoreSnapshot(next);
  }, [restoreSnapshot, updateHistoryFlags]);

  // Create Fabric canvas on mount
  useEffect(() => {
    // Stop if HTML canvas element is not ready yet
    if (!canvasElRef.current) return;

    // Create Fabric canvas instance
    const canvas = new Canvas(canvasElRef.current, {
      backgroundColor: "transparent",
      preserveObjectStacking: true,
      selection: true,
    });

    // Ensure DOM canvas fills its container
    canvasElRef.current.style.width = "100%";
    canvasElRef.current.style.height = "100%";
    canvasElRef.current.style.display = "block";

    // Initialize view metadata
    canvas.__fitScale = 1;
    canvas.__zoomLevel = 1;
    canvas.__adjustments = { brightness: 0, contrast: 0, saturation: 0 };

    // Store Fabric instance refs
    fabricRef.current = canvas;
    window.canvas = canvas;

    // Reset history
    undoStackRef.current = [];
    redoStackRef.current = [];

    // Mark ready and reset zoom display
    setReady(true);
    setZoomPercent(100);

    // Save initial empty history snapshot
    pushHistorySnapshot({ force: true });

    // Cleanup on unmount
    return () => {
      // Clear adjustment timer if running
      if (adjustCommitTimerRef.current) {
        clearTimeout(adjustCommitTimerRef.current);
      }

      // Dispose Fabric canvas
      canvas.dispose();
      fabricRef.current = null;
      window.canvas = null;
      setReady(false);
      setCanUndo(false);
      setCanRedo(false);
    };
  }, [pushHistorySnapshot]);

  // Reconfigure canvas behavior whenever the active tool changes
  useEffect(() => {
    // Read Fabric canvas
    const canvas = fabricRef.current;

    // Stop if canvas is not ready
    if (!ready || !canvas) return;

    // Configure brush mode
    if (activeTool === "brush") {
      setToolMode(canvas, "brush", {
        color: brushColor ?? "#ff3b30",
        size: brushSize ?? 12,
      });
    } else if (activeTool === "heal") {
      // Configure heal mode
      setToolMode(canvas, "heal", {
        size: brushSize ?? 24,
        flow: healFlow ?? 0.45,
      });
    } else if (activeTool === "adjust") {
      // Adjust tool keeps normal select behavior
      setToolMode(canvas, "select");
    } else if (activeTool === "rotate") {
      // Configure rotate mode
      setToolMode(canvas, "rotate");
    } else if (activeTool === "mask") {
      // Configure mask mode
      setToolMode(canvas, "mask", {
        size: brushSize ?? 40,
      });
    } else if (activeTool === "erase") {
      // Configure erase mode
      setToolMode(canvas, "erase", {
        size: brushSize ?? 40,
      });
    } else {
      // Default to selected tool or select mode
      setToolMode(canvas, activeTool || "select");
    }
  }, [activeTool, brushColor, brushSize, healFlow, ready]);

  // Register Fabric events that should push history snapshots
  useEffect(() => {
    // Read Fabric canvas
    const canvas = fabricRef.current;

    // Stop if canvas is not ready
    if (!ready || !canvas) return;

    // Save history after drawing paths for brush/mask/erase
    const handlePathCreated = () => {
      if (suppressHistoryRef.current) return;

      const tool = activeToolRef.current;
      if (tool === "crop") return;

      if (tool === "brush" || tool === "mask" || tool === "erase") {
        pushHistorySnapshot();
      }
    };

    // Save history after normal object modification
    const handleObjectModified = () => {
      if (suppressHistoryRef.current) return;

      const tool = activeToolRef.current;
      if (tool === "crop") return;
      if (tool === "brush" || tool === "mask" || tool === "erase") return;

      pushHistorySnapshot();
    };

    // Save history after finishing text editing
    const handleTextEditingExited = () => {
      if (suppressHistoryRef.current) return;
      pushHistorySnapshot();
    };

    // Save history once after adding a new text object
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

    // Save history after interactive heal or rotate actions
    const handleMouseUp = () => {
      if (suppressHistoryRef.current) return;

      const tool = activeToolRef.current;

      if (tool === "heal" || tool === "rotate") {
        pushHistorySnapshot();
      }
    };

    // Attach Fabric event listeners
    canvas.on("path:created", handlePathCreated);
    canvas.on("object:modified", handleObjectModified);
    canvas.on("text:editing:exited", handleTextEditingExited);
    canvas.on("object:added", handleObjectAdded);
    canvas.on("mouse:up", handleMouseUp);

    // Remove listeners on cleanup
    return () => {
      canvas.off("path:created", handlePathCreated);
      canvas.off("object:modified", handleObjectModified);
      canvas.off("text:editing:exited", handleTextEditingExited);
      canvas.off("object:added", handleObjectAdded);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [ready, pushHistorySnapshot]);

  // Reset text-added guard whenever tool changes
  useEffect(() => {
    textAddedRef.current = false;
  }, [activeTool]);

  // Reapply adjustments and commit them to history after a short delay
  useEffect(() => {
    // Read Fabric canvas
    const canvas = fabricRef.current;

    // Stop if canvas is not ready
    if (!ready || !canvas) return;

    // Reapply adjustments immediately
    safeApplyAdjustments(canvas);

    // Stop if updates are suppressed
    if (suppressHistoryRef.current) return;

    // Avoid saving interim crop helper movement
    if (activeTool === "crop") return;

    // Reset old timer
    if (adjustCommitTimerRef.current) {
      clearTimeout(adjustCommitTimerRef.current);
    }

    // Save adjustment state after small delay
    adjustCommitTimerRef.current = setTimeout(() => {
      pushHistorySnapshot();
    }, 250);

    // Cleanup timer on dependency change
    return () => {
      if (adjustCommitTimerRef.current) {
        clearTimeout(adjustCommitTimerRef.current);
      }
    };
  }, [ready, adjustments, activeTool, safeApplyAdjustments, pushHistorySnapshot]);

  // Resize the Fabric canvas and refit the current image
  const setSize = useCallback(
    (w, h) => {
      // Read Fabric canvas
      const c = fabricRef.current;

      // Stop if missing
      if (!c) return;

      // Resize canvas
      setCanvasSize(c, w, h);

      // Find image
      const img = getFirstImage(c);

      // Stop if no image exists
      if (!img) return;

      // Refit image and reapply adjustments
      fitImageToView(c, 32);
      c.setActiveObject?.(img);
      safeApplyAdjustments(c);
      c.requestRenderAll?.();
      setZoomPercent(getZoomPercent(c));
    },
    [safeApplyAdjustments]
  );

  // Import an image file and place it onto the canvas
  const importFile = useCallback(
    async (file) => {
      // Read Fabric canvas
      const c = fabricRef.current;

      // Stop if missing
      if (!c) return;

      // Load file into data URL
      const dataURL = await loadImageFromFile(file, { normalize: true });

      // Create Fabric image from data URL
      const img = await fabricImageFromURL(dataURL, { selectable: true });

      // Suppress internal history events during import
      suppressHistoryRef.current = true;
      try {
        // Clear old canvas contents
        clearCanvas(c);

        // Add imported image
        c.add(img);

        // Disable caching
        img.objectCaching = false;
        img.set?.({ objectCaching: false });

        // Fit image only after canvas has a real size
        if (hasRealSize(c)) {
          fitObjectToCanvas(c, img, 32);
          c.setActiveObject(img);
          safeApplyAdjustments(c);
          c.requestRenderAll?.();
          setZoomPercent(getZoomPercent(c));
        }
      } finally {
        // Re-enable history writes
        suppressHistoryRef.current = false;
      }

      // Save import into history
      pushHistorySnapshot({ force: true });
    },
    [safeApplyAdjustments, pushHistorySnapshot]
  );

  // Import an image from a URL
  const importFromURL = useCallback(
    async (url) => {
      // Read Fabric canvas
      const c = fabricRef.current;

      // Stop if missing
      if (!c) return;

      // Create Fabric image from URL
      const img = await fabricImageFromURL(url, { selectable: true });

      // Suppress internal history events during import
      suppressHistoryRef.current = true;
      try {
        // Clear old contents
        clearCanvas(c);

        // Add imported image
        c.add(img);

        // Disable caching
        img.objectCaching = false;
        img.set?.({ objectCaching: false });

        // Fit only when canvas size is valid
        if (hasRealSize(c)) {
          fitObjectToCanvas(c, img, 32);
          c.setActiveObject(img);
          safeApplyAdjustments(c);
          c.requestRenderAll?.();
          setZoomPercent(getZoomPercent(c));
        }
      } finally {
        // Re-enable history writes
        suppressHistoryRef.current = false;
      }

      // Save import into history
      pushHistorySnapshot({ force: true });
    },
    [safeApplyAdjustments, pushHistorySnapshot]
  );

  // Clear the entire canvas
  const reset = useCallback(() => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return;

    // Suppress internal history events during reset
    suppressHistoryRef.current = true;
    try {
      // Clear all canvas contents
      clearCanvas(c);

      // Reset zoom display
      setZoomPercent(100);
    } finally {
      // Re-enable history writes
      suppressHistoryRef.current = false;
    }

    // Save reset into history
    pushHistorySnapshot({ force: true });
  }, [pushHistorySnapshot]);

  // Remove all mask objects
  const clearMask = useCallback(() => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return;

    // Suppress internal history events during mask clearing
    suppressHistoryRef.current = true;
    try {
      // Remove mask objects
      clearMaskObjects(c);
    } finally {
      // Re-enable history writes
      suppressHistoryRef.current = false;
    }

    // Save result into history
    pushHistorySnapshot({ force: true });
  }, [pushHistorySnapshot]);

  // Export the canvas as a PNG data URL
  const exportAsPNG = useCallback((multiplier = 1) => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return null;

    // Export PNG data URL
    return exportPNG(c, multiplier);
  }, []);

  // Zoom in
  const zoomIn = useCallback(() => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return;

    // Apply zoom
    const percent = zoomImage(c, 1.2);

    // Update UI
    setZoomPercent(percent);
  }, []);

  // Zoom out
  const zoomOut = useCallback(() => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return;

    // Apply zoom
    const percent = zoomImage(c, 1 / 1.2);

    // Update UI
    setZoomPercent(percent);
  }, []);

  // Fit image back to view
  const fitToView = useCallback(() => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return;

    // Fit image into viewport
    const percent = fitImageToView(c, 32);

    // Update zoom display
    setZoomPercent(percent);

    // Reapply adjustments and redraw
    safeApplyAdjustments(c);
    c.requestRenderAll?.();
  }, [safeApplyAdjustments]);

  // Rotate image 90 degrees left and save history
  const rotateLeft = useCallback(() => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return;

    // Suppress internal history during rotate
    suppressHistoryRef.current = true;
    try {
      // Rotate image
      rotateImageBy(c, -90);
    } finally {
      // Re-enable history writes
      suppressHistoryRef.current = false;
    }

    // Save rotation into history
    pushHistorySnapshot({ force: true });
  }, [pushHistorySnapshot]);

  // Rotate image 90 degrees right and save history
  const rotateRight = useCallback(() => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return;

    // Suppress internal history during rotate
    suppressHistoryRef.current = true;
    try {
      // Rotate image
      rotateImageBy(c, 90);
    } finally {
      // Re-enable history writes
      suppressHistoryRef.current = false;
    }

    // Save rotation into history
    pushHistorySnapshot({ force: true });
  }, [pushHistorySnapshot]);

  // Reset image rotation and save history
  const resetRotation = useCallback(() => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return;

    // Suppress internal history during reset
    suppressHistoryRef.current = true;
    try {
      // Reset image rotation
      resetImageRotation(c);
    } finally {
      // Re-enable history writes
      suppressHistoryRef.current = false;
    }

    // Save reset into history
    pushHistorySnapshot({ force: true });
  }, [pushHistorySnapshot]);

  // Export full canvas as Blob
  const exportAsPNGBlob = useCallback(async (multiplier = 1, useOriginalSize = false) => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return null;

    // Export canvas Blob
    return await exportPNGBlob(c, multiplier, useOriginalSize);
  }, []);

  // Export mask as Blob
  const exportAsMaskBlob = useCallback(async (multiplier = 1, useOriginalSize = false) => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return null;

    // Export mask Blob
    return await exportMaskBlob(c, multiplier, useOriginalSize);
  }, []);

  // Apply an AI-generated image result back to the canvas
  const applyBlobResult = useCallback(
    async (blob, opts) => {
      // Read Fabric canvas
      const c = fabricRef.current;

      // Stop if missing
      if (!c) return;

      // Suppress internal history during AI apply
      suppressHistoryRef.current = true;
      try {
        // Apply AI result
        await applyResultBlob(c, blob, opts);

        // Reapply adjustments and refresh zoom text
        safeApplyAdjustments(c);
        c.requestRenderAll?.();
        setZoomPercent(getZoomPercent(c));
      } finally {
        // Re-enable history writes
        suppressHistoryRef.current = false;
      }

      // Save result into history
      pushHistorySnapshot({ force: true });
    },
    [pushHistorySnapshot, safeApplyAdjustments]
  );

  // Get export multiplier near original size
  const getExportMultiplier = useCallback(() => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return 1;

    // Compute export multiplier
    return getOriginalSizeMultiplier(c);
  }, []);

  // Apply crop, then return to select mode, then save history
  const applyCrop = useCallback(() => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return;

    // Suppress internal history during crop application
    suppressHistoryRef.current = true;
    try {
      // Apply crop to image
      const img = applyCropToImage(c);

      // Stop if crop failed
      if (!img) return;

      // Disable caching
      img.objectCaching = false;
      img.set?.({ objectCaching: false });

      // Clear crop helper references
      c.__cropRect = null;
      c.__cropShade = null;

      // Refit image and reapply adjustments
      fitObjectToCanvas(c, img, 32);
      c.setActiveObject?.(img);
      safeApplyAdjustments(c);
      c.requestRenderAll?.();
      setZoomPercent(getZoomPercent(c));

      // Return to select mode
      setToolMode(c, "select");
    } finally {
      // Re-enable history writes
      suppressHistoryRef.current = false;
    }

    // Update parent tool state and save history
    onToolChangeRequest?.("select");
    pushHistorySnapshot({ force: true });
  }, [safeApplyAdjustments, pushHistorySnapshot, onToolChangeRequest]);

  // Cancel crop and return to select mode
  const cancelCropAction = useCallback(() => {
    // Read Fabric canvas
    const c = fabricRef.current;

    // Stop if missing
    if (!c) return;

    // Remove crop helper
    cancelCrop(c);

    // Return to select mode
    setToolMode(c, "select");
    onToolChangeRequest?.("select");
  }, [onToolChangeRequest]);

  // Public actions returned to the rest of the app
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
      rotateLeft,
      rotateRight,
      resetRotation,
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
      rotateLeft,
      rotateRight,
      resetRotation,
      applyCrop,
      cancelCropAction,
      undo,
      redo,
      canUndo,
      canRedo,
    ]
  );

  // Small helper exposing the Fabric instance if ever needed elsewhere
  const api = useMemo(() => {
    return {
      get canvas() {
        return fabricRef.current;
      },
    };
  }, []);

  // Return refs, state, helper API, and action methods
  return {
    canvasElRef,
    ready,
    zoomPercent,
    api,
    actions,
  };
}