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
  VenetianMask,
} from "lucide-react";
import { useAiFeatures } from "../../features/aiFeatures/useAiFeatures";
import * as fabric from "fabric";
import { useState, useEffect } from "react";

const tools = [
  { key: "select", label: "Select", icon: MousePointer2 },
  { key: "crop", label: "Crop", icon: Crop },
  { key: "brush", label: "Brush", icon: Brush },
  { key: "mask", label: "Mask", icon: VenetianMask },
  { key: "brush", label: "Brush", icon: Brush },
  { key: "mask", label: "Mask", icon: VenetianMask },
  { key: "erase", label: "Erase", icon: Eraser },
  { key: "text", label: "Text", icon: Type },
  { key: "heal", label: "Heal", icon: Wand2 },
  { key: "cutout", label: "Cutout", icon: Scissors },
  { key: "adjust", label: "Adjust", icon: SlidersHorizontal },
  { key: "ai", label: "AI Remove", icon: Sparkles },
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
  canvas,
  canvasActions, // Add this prop to pass canvas actions
}) {
  const { removeBackground, loading, error, cleanup } = useAiFeatures({
    canvasActions, // Pass canvasActions to the hook if needed
  });
  
  const [localError, setLocalError] = useState(null);

  // Clean up URLs when component unmounts
  useEffect(() => {
    return () => {
      if (cleanup) cleanup();
    };
  }, [cleanup]);

  const handleRemoveBackground = async () => {
    if (!canvas) {
      setLocalError("Canvas not initialized");
      return;
    }

    setLocalError(null);

    try {
      // Get the first image on the canvas
      const img = canvas.getObjects().find((o) => o.type === "image");
      if (!img) {
        setLocalError("No image found on canvas");
        return;
      }

      // Convert Fabric image to Blob
      const dataUrl = img.toDataURL({ 
        format: "png",
        quality: 1,
        multiplier: 1 
      });
      
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      // Call the AI remove background function
      // Note: removeBackground returns a URL string, not an object with blob property
      const resultUrl = await removeBackground(blob);
      
      if (!resultUrl) {
        throw new Error("No result received from background removal");
      }

      // Create a new image from the result URL
      const newImgObj = new Image();
      newImgObj.crossOrigin = "anonymous";
      
      newImgObj.onload = () => {
        // Calculate dimensions to maintain aspect ratio
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        const imgAspect = newImgObj.width / newImgObj.height;
        const canvasAspect = canvasWidth / canvasHeight;
        
        let width, height;
        
        if (imgAspect > canvasAspect) {
          // Image is wider than canvas
          width = canvasWidth;
          height = canvasWidth / imgAspect;
        } else {
          // Image is taller than canvas
          height = canvasHeight;
          width = canvasHeight * imgAspect;
        }
        
        // Create Fabric image object
        const newFabricImg = new fabric.Image(newImgObj, {
          selectable: true,
          hasControls: true,
          hasBorders: true,
          left: (canvasWidth - width) / 2,
          top: (canvasHeight - height) / 2,
          scaleX: width / newImgObj.width,
          scaleY: height / newImgObj.height,
        });
        
        // Clear canvas and add new image
        canvas.clear();
        canvas.add(newFabricImg);
        canvas.setActiveObject(newFabricImg);
        canvas.requestRenderAll();
        
        // Clean up the URL
        URL.revokeObjectURL(resultUrl);
      };

      newImgObj.onerror = () => {
        setLocalError("Failed to load processed image");
        URL.revokeObjectURL(resultUrl);
      };

      newImgObj.src = resultUrl;
      
    } catch (err) {
      console.error("Background removal failed:", err);
      setLocalError(err.message || "Failed to remove background");
    }
  };

  // Handle tool click
  const handleToolClick = (key) => {
    onToolSelect(key);
    if (key === "ai") {
      handleRemoveBackground();
    }
  };

  // Show loading state
  if (loading) {
    return (
      <aside className="h-full border-r border-white/10 bg-panel/60 backdrop-blur supports-backdrop-filter:bg-panel/40 w-64 shrink-0">
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-400">
            <div className="flex flex-col items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
              <span>Processing...</span>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={[
        "h-full border-r border-white/10 bg-panel/60 backdrop-blur supports-backdrop-filter:bg-panel/90",
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

      <div className="px-2 pb-3">
        <div className="space-y-1">
          {tools.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={[
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2",
                "hover:bg-white/10 active:bg-white/15",
                "text-left transition-colors",
                activeTool === key 
                  ? "bg-accent text-white" 
                  : "text-gray-200 hover:text-white",
                loading && key === "ai" && "opacity-50 cursor-not-allowed",
              ].join(" ")}
              onClick={() => handleToolClick(key)}
              disabled={loading && key === "ai"}
              type="button"
            >
              <Icon className="h-4 w-4 text-gray-200" />
              {!collapsed && (
                <span className="text-sm text-gray-200 group-hover:text-white">
                  {label}
                </span>
              )}
            </button>
        ))}
        </div>

        {/* Brush options panel */}
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
                <span>{brushSize}px</span>
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

        {/* Mask options panel */}
        {!collapsed && activeTool === "mask" && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/10 p-3">
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
              <div className="text-xs font-semibold text-gray-400">Tip</div>
              <div className="mt-1 text-xs text-gray-400">
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