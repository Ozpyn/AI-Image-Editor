import { useState } from "react";
import * as fabric from "fabric";
import { useAiFeatures } from "../../features/aiFeatures/useAiFeatures";
import {
  MousePointer2,
  Crop,
  Eraser,
  Type,
  Brush,
  Wand2,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  VenetianMask,
} from "lucide-react";

const tools = [
  { key: "select", label: "Select", icon: MousePointer2 },
  { key: "crop", label: "Crop", icon: Crop },
  { key: "brush", label: "Brush", icon: Brush },
  { key: "mask", label: "Mask", icon: VenetianMask },
  { key: "erase", label: "Erase", icon: Eraser },
  { key: "text", label: "Text", icon: Type },
  { key: "heal", label: "Heal", icon: Wand2 },
  { key: "cutout", label: "Cutout", icon: Scissors },
  { key: "adjust", label: "Adjust", icon: SlidersHorizontal },
  { key: "ai", label: "AI Remove", icon: Sparkles },
  { key: "replacebg", label: "AI BG Replace", icon: Wand2 },
];

export default function ToolBox({
  collapsed,
  onToggle,
  activeTool,
  onToolSelect,
  brushColor,
  brushSize,
  onBrushColorChange,
  onBrushSizeChange,
  canvasActions,
  canvasActions,
}) {
  const [bgPrompt, setBgPrompt] = useState("a bright modern interior behind the subject");
  const [bgPrompt, setBgPrompt] = useState("a bright modern interior behind the subject");

  const { inpaintFromCanvas, removeBackground, replaceBackground, loading, error } = useAiFeatures({
    canvasActions,
  });
  const { inpaintFromCanvas, removeBackground, replaceBackground, loading, error } = useAiFeatures({
    canvasActions,
  });
  
  const handleRemoveBackground = async () => {
    // Make sure you have access to the canvas (pass it as prop or get from parent)
    if (!window.canvas) return alert("Canvas not initialized");

    // Get the first image on the canvas
    const img = window.canvas.getObjects().find((o) => o.type === "image");
    if (!img) return alert("No image on canvas!");

    // Convert Fabric image to Blob
    const dataUrl = img.toDataURL({ format: "png" });
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    // Call the AI remove background function
    const bgRemovedUrl = await removeBackground(blob);
    if (!bgRemovedUrl) return;

    // Replace the image in the canvas
    const newImgObj = new Image();
    newImgObj.src = bgRemovedUrl;
    newImgObj.onload = () => {
      const newFabricImg = new fabric.Image(newImgObj, { selectable: true });
      window.canvas.clear();
      window.canvas.add(newFabricImg);
      window.canvas.requestRenderAll();
    };
  };

  const handleReplaceBackground = async () => {
    if (!canvasActions) {
      return alert("Canvas is not ready yet.");
    }
    if (!bgPrompt.trim()) {
      return alert("Please enter a background prompt.");
    }

    try {
      await replaceBackground({
        prompt: bgPrompt,
        apply: true,
        applyMode: "replace",
      });
      alert("Background replacement applied.");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Background replacement failed.");
    }
  };

  return (
    <aside
      className={[
        "h-full min-h-0 flex flex-col overflow-hidden border-r border-white/10 bg-panel/60 backdrop-blur supports-backdrop-filter:bg-panel/40",
        "h-full min-h-0 flex flex-col overflow-hidden border-r border-white/10 bg-panel/60 backdrop-blur supports-backdrop-filter:bg-panel/40",
        collapsed ? "w-16" : "w-64",
        "transition-[width] duration-200 ease-out",
        "shrink-0",
      ].join(" ")}
    >
      <div className="flex h-12 items-center justify-between px-2">
        <div className="flex items-center gap-2 px-2">
          <div className="h-7 w-7 rounded-lg bg-white/10" />
          {!collapsed && <div className="text-sm font-semibold">Tools</div>}
        </div>

        <button
          onClick={onToggle}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10"
          aria-label={collapsed ? "Expand toolbox" : "Collapse toolbox"}
          type="button"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3">
        <div className="space-y-1">
          {tools.map((tool) => (
            <button
              key={tool.key}
              className={[
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2",
                "hover:bg-white/10 active:bg-white/15",
                "text-left",
                activeTool === tool.key ? "bg-accent text-white" : "text-gray-200",
              ].join(" ")}
              onClick={() => {
                onToolSelect(key);
                if (key === "ai") handleRemoveBackground();
              }}
              type="button"
            >
              <tool.icon className="h-4 w-4 text-gray-200" />
              {!collapsed && (
                <span className="text-sm text-gray-200 group-hover:text-white">
                  {tool.label}
                </span>
              )}
            </button>
          ))}
          ))}
        </div>

        {/* Brush options panel  */}
        {!collapsed && activeTool === "brush" && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold text-gray-200">Brush Options</div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <label className="text-xs text-gray-300">Color</label>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => onBrushColorChange?.(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded-md border border-white/10 bg-transparent"
              />
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span>Size</span>
                <span>{brushSize}</span>
              </div>
              <input
                type="range"
                min={1}
                max={80}
                value={brushSize}
                onChange={(e) => onBrushSizeChange?.(Number(e.target.value))}
                className="mt-2 w-full accent-white"
              />
            </div>
          </div>
        )}

        {/* Background replacement panel */}
        {!collapsed && activeTool === "replacebg" && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold text-gray-500">Background Replace</div>
            <div className="mt-3 text-xs text-gray-500">
              Enter a prompt describing the background you want behind the subject.
            </div>
            <textarea
              value={bgPrompt}
              onChange={(e) => setBgPrompt(e.target.value)}
              className="mt-3 w-full rounded-lg border border-white/10 bg-black/70 p-2 text-sm text-gray-100 focus:border-white focus:outline-none"
              rows={3}
            />
            <button
              type="button"
              onClick={handleReplaceBackground}
              disabled={loading}
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Applying…" : "Replace Background"}
            </button>
            {error && (
              <div className="mt-2 text-xs text-red-300">{error}</div>
            )}
          </div>
        )}

        {/* Mask options panel */}
        {!collapsed && activeTool === "mask" && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold text-gray-200">Mask Options</div>
            <div className="mt-2 text-xs text-gray-400">
              Draw white areas to mark regions for AI inpainting
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span>Brush Size</span>
                <span>{brushSize}px</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={brushSize}
                onChange={(e) => onBrushSizeChange?.(Number(e.target.value))}
                className="mt-2 w-full accent-white"
              />
            </div>
          </div>
        )}

        {/* Erase options panel */}
        {!collapsed && activeTool === "erase" && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold text-gray-200">Eraser Options</div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span>Size</span>
                <span>{brushSize}px</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={brushSize}
                onChange={(e) => onBrushSizeChange?.(Number(e.target.value))}
                className="mt-2 w-full accent-white"
              />
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          {!collapsed ? (
            <>
              <div className="text-xs font-semibold text-gray-600">Tip</div>
              <div className="mt-1 text-xs text-gray-600">
                Pick a tool on the left. Our canvas is centered and scalable.
              </div>
            </>
          ) : (
            <div className="h-10" />
          )}
        </div>
      </div>
    </aside>
  );
}
