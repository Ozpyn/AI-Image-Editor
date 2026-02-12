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
} from "lucide-react";

const tools = [
  { key: "select", label: "Select", icon: MousePointer2 },
  { key: "crop", label: "Crop", icon: Crop },
  { key: "erase", label: "Erase", icon: Eraser },
  { key: "text", label: "Text", icon: Type },
  { key: "brush", label: "Brush", icon: Brush },
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
  // ✅ NEW brush props
  brushColor,
  brushSize,
  onBrushColorChange,
  onBrushSizeChange,
}) {
  const { inpaint } = useAiFeatures(); // (unused for now, fine)

  return (
    <aside
      className={[
        "h-full border-r border-white/10 bg-panel/60 backdrop-blur supports-backdrop-filter:bg-panel/40",
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
                "text-left",
                activeTool === key ? "bg-accent text-white" : "text-gray-200",
              ].join(" ")}
              onClick={() => onToolSelect(key)}
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
