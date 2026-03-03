/* We'll use fabric.js 7.0, for canvas; it turns the image into objects instead of just pixels
/* We'll use fabric.js 7.0, for canvas; it turns the image into objects instead of just pixels
   and supports our graphic editing features. We'll control it using React. */

import { useEffect, useRef } from "react";
import { useCanvas } from "../../features/canvas/useCanvas";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export default function CanvasArea({
  activeTool,
  brushColor,
  brushSize,
  onCanvasActionsReady, // ✅ NEW
}) {
  const fileRef = useRef(null);
  const stageRef = useRef(null);

  // forward the activeTool prop to useCanvas hook
  const { canvasElRef, ready, actions } = useCanvas({
    activeTool,
    brushColor,
    brushSize,
  });

  // ✅ NEW: expose actions upward (for AI features / panels / other UI)
  useEffect(() => {
    if (!ready) return;
    if (typeof onCanvasActionsReady === "function") {
      onCanvasActionsReady(actions);
    }
  }, [ready, actions, onCanvasActionsReady]);

  useEffect(() => {
    if (!ready || !stageRef.current) return;
    const stageArea = stageRef.current;

    const resizeUsingResizeObserver = () => {
      const rect = stageArea.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        actions.setSize(rect.width, rect.height);
      }
    };
    resizeUsingResizeObserver(); // to initialize size the canvas size using setSize in our useCanvas

    const theResizeObserver = new ResizeObserver(resizeUsingResizeObserver);
    theResizeObserver.observe(stageArea);

    return () => {
      theResizeObserver.disconnect();
    };
  }, [ready, actions]);

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await actions.importFile(file);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <main className="relative flex min-w-0 flex-1 flex-col">
      {/* Top canvas toolbar */}
      <div className="flex h-12 items-center justify-between border-b border-white/10 bg-panel/30 px-3 backdrop-blur">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="hidden md:inline">Project:</span>
          <span className="rounded-md bg-white/5 px-2 py-1 text-gray-400">
            Group 1 AI Image Editor
            Group 1 AI Image Editor
          </span>
        </div>

        <div className="flex items-center gap-1">
          <IconBtn label="Zoom out" icon={<ZoomOut className="h-4 w-4" />} />
          <div className="rounded-md bg-white/5 px-2 py-1 text-sm text-gray-600">100%</div>
          <div className="rounded-md bg-white/5 px-2 py-1 text-sm text-gray-600">100%</div>
          <IconBtn label="Zoom in" icon={<ZoomIn className="h-4 w-4" />} />
          <div className="mx-1 h-6 w-px bg-white/10" />
          <IconBtn label="Fit" icon={<Maximize2 className="h-4 w-4" />} />
        </div>
      </div>

      {/* Canvas stage */}
      <div className="flex flex-1 items-center justify-center p-3 md:p-6">
        <div className="relative aspect-4/3 w-full max-w-275 rounded-2xl border border-white/10 bg-linear-to-b from-white/5 to-white/0 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          {/* Checkerboard background */}
          <div
            className="absolute inset-0 rounded-2xl opacity-60"
            style={{
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%)",
              backgroundSize: "24px 24px",
              backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0px",
            }}
          />

          {/* Fabric canvas */}
          {/* Fabric canvas */}
          <div className="relative z-10 flex h-full w-full items-center justify-center p-3">
            <div
              ref={stageRef}
              className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 bg-black/20"
            >
              <canvas ref={canvasElRef} className="block" />

              {!ready && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-gray-200">Initializing canvas…</div>
                    <div className="mt-1 text-xs text-gray-400">Fabric is mounting</div>
                    <div className="text-sm font-semibold text-gray-200">Initializing canvas…</div>
                    <div className="mt-1 text-xs text-gray-400">Fabric is mounting</div>
                  </div>
                </div>
              )}

              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                />


                <button
                  onClick={onPickFile}
                  className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                  type="button"
                  type="button"
                >
                  Import Image
                </button>

                <button
                  onClick={() => actions.reset()}
                  className="rounded-lg bg-rose-800 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10"
                >
                  Clear
                </button>

                {/* Crop button only in crop mode */}
                {activeTool === "crop" && (
                  <button
                    onClick={() => actions.applyCrop?.()}
                    className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                    type="button"
                  >
                    Apply Crop
                  </button>
                )}

                {/* Crop button only in crop mode */}
                {activeTool === "crop" && (
                  <button
                    onClick={() => actions.applyCrop?.()}
                    className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                    type="button"
                  >
                    Apply Crop
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function IconBtn({ icon, label }) {
  return (
    <button
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-sky-600 transition hover:bg-indigo-50 hover:text-indigo-600"
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-sky-600 transition hover:bg-indigo-50 hover:text-indigo-600"
      aria-label={label}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );
}