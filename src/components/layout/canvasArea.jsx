/* We'll use fabric.js 7.0, check dependencies in package.json, for canvas; it turns the image into objects instead of just pixels
   and supports our graphic editing features. We'll control it using React. */

import { useEffect, useRef } from "react";
import { useCanvas } from "../../features/canvas/useCanvas";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export default function CanvasArea() {
  
  const fileRef = useRef(null);
  const stageRef = useRef(null);
  const { canvasElRef, ready, actions } = useCanvas();

  useEffect(() => {
    if (!ready || !stageRef.current) return;
    const stageArea = stageRef.current;

    const resizeUsingResizeObserver = () =>{
      const rect = stageArea.getBoundingClientRect();
      actions.setSize(rect.width, rect.height);
    };
    resizeUsingResizeObserver();//to initialize size on mount

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
      // allow re-uploading same file again
      e.target.value = "";
    }
  };

  return (
    <main className="relative flex min-w-0 flex-1 flex-col">
      {/* Top canvas toolbar */}
      <div className="flex h-12 items-center justify-between border-b border-white/10 bg-panel/30 px-3 backdrop-blur">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span className="hidden md:inline">Project:</span>
          <span className="rounded-md bg-white/5 px-2 py-1 text-gray-200">
            Untitled
          </span>
        </div>

        <div className="flex items-center gap-1">
          <IconBtn label="Zoom out" icon={<ZoomOut className="h-4 w-4" />} />
          <div className="rounded-md bg-white/5 px-2 py-1 text-sm text-gray-200">
            100%
          </div>
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

          {/* Fabric canvas   */}
          <div className="relative z-10 flex h-full w-full items-center justify-center p-3">
            <div ref={stageRef} className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <canvas ref={canvasElRef} className="block" />

              {/* Empty-state overlay */}
              {!ready && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-gray-200">
                      Initializing canvas…
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      Fabric is mounting
                    </div>
                  </div>
                </div>
              )}

              {/* Import overlay button (always available) */}
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
                >
                  Import Image
                </button>

                <button
                  onClick={() => actions.reset()}
                  className="rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10"
                >
                  Clear
                </button>
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
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10"
      aria-label={label}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );
}
