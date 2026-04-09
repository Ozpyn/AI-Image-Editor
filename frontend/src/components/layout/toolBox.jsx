// Import toolbox icons
import {
  MousePointer2,
  Crop,
  Eraser,
  Type,
  Brush,
  Wand2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  VenetianMask,
  RotateCw,
  RotateCcw,
} from "lucide-react";

// List of tools shown in the toolbox
const tools = [
  // Selection tool
  { key: "select", label: "Select", icon: MousePointer2 },

  // Crop tool
  { key: "crop", label: "Crop", icon: Crop },

  // Rotate tool
  { key: "rotate", label: "Rotate", icon: RotateCw },

  // Freehand brush tool
  { key: "brush", label: "Brush", icon: Brush },

  // Mask drawing tool
  { key: "mask", label: "Mask", icon: VenetianMask },

  // Eraser tool
  { key: "erase", label: "Erase", icon: Eraser },

  // Text insertion tool
  { key: "text", label: "Text", icon: Type },

  // Heal / clone tool
  { key: "heal", label: "Heal", icon: Wand2 },

  // Adjustment tool
  { key: "adjust", label: "Adjust", icon: SlidersHorizontal },
];

// Define the toolbox component
export default function ToolBox({
  // Whether the toolbox is collapsed
  collapsed,

  // Callback to toggle collapsed state
  onToggle,

  // Currently active tool
  activeTool,

  // Callback to select a tool
  onToolSelect,

  // Current brush color
  brushColor,

  // Current brush size
  brushSize,

  // Callback to update brush color
  onBrushColorChange,

  // Callback to update brush size
  onBrushSizeChange,

  // Canvas action methods
  canvasActions,
}) {
  // Render the toolbox
  return (
    <aside
      className={[
        // Base layout and background styling
        "h-full min-h-0 flex flex-col overflow-hidden border-r border-white/10 bg-panel/60 backdrop-blur supports-backdrop-filter:bg-panel/40",

        // Width based on collapsed state
        collapsed ? "w-16" : "w-64",

        // Animated width change
        "transition-[width] duration-200 ease-out",

        // Prevent flexbox shrinking
        "shrink-0",
      ].join(" ")}
    >
      {/* Toolbox top bar */}
      <div className="flex h-12 items-center justify-between px-2">
        {/* Left side of top bar */}
        <div className="flex items-center gap-2 px-2">
          {/* Decorative square */}
          <div className="h-7 w-7 rounded-lg bg-white/10" />

          {/* Toolbox title only when expanded */}
          {!collapsed && <div className="text-sm font-semibold">Tools</div>}
        </div>

        {/* Collapse / expand button */}
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

      {/* Scrollable toolbox body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3">
        {/* Main list of tools */}
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
                onToolSelect(tool.key);
              }}
              type="button"
            >
              {/* Tool icon */}
              <tool.icon className="h-4 w-4 text-gray-200" />

              {/* Tool label when expanded */}
              {!collapsed && (
                <span className="text-sm text-gray-200 group-hover:text-white">
                  {tool.label}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Brush options panel */}
        {!collapsed && activeTool === "brush" && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            {/* Panel title */}
            <div className="text-xs font-semibold text-gray-200">Brush Options</div>

            {/* Brush color picker */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <label className="text-xs text-gray-300">Color</label>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => onBrushColorChange?.(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded-md border border-white/10 bg-transparent"
              />
            </div>

            {/* Brush size slider */}
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

        {/* Rotate options panel */}
        {!collapsed && activeTool === "rotate" && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            {/* Panel title */}
            <div className="text-xs font-semibold text-gray-200">Rotate Options</div>

            {/* Helper text */}
            <div className="mt-2 text-xs text-gray-400">
              Use these buttons or drag the rotation handle on the image.
            </div>

            {/* Left / right rotate buttons */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => canvasActions?.rotateLeft?.()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10"
              >
                <RotateCcw className="h-4 w-4" />
                Left
              </button>

              <button
                type="button"
                onClick={() => canvasActions?.rotateRight?.()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10"
              >
                <RotateCw className="h-4 w-4" />
                Right
              </button>
            </div>

            {/* Reset rotation button */}
            <button
              type="button"
              onClick={() => canvasActions?.resetRotation?.()}
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10"
            >
              Reset Rotation
            </button>
          </div>
        )}

        {/* Mask options panel */}
        {!collapsed && activeTool === "mask" && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            {/* Panel title */}
            <div className="text-xs font-semibold text-gray-200">Mask Options</div>

            {/* Helper text */}
            <div className="mt-2 text-xs text-gray-400">
              Draw white areas to mark regions for AI inpainting
            </div>

            {/* Mask size slider */}
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

        {/* Eraser options panel */}
        {!collapsed && activeTool === "erase" && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            {/* Panel title */}
            <div className="text-xs font-semibold text-gray-200">Eraser Options</div>

            {/* Eraser size slider */}
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

        {/* Bottom tip panel */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          {!collapsed ? (
            <>
              {/* Tip title */}
              <div className="text-xs font-semibold text-gray-600">Tip</div>

              {/* Tip text */}
              <div className="mt-1 text-xs text-gray-600">
                Pick a tool on the left. Our canvas is centered and scalable.
              </div>
            </>
          ) : (
            // Small spacer when collapsed
            <div className="h-10" />
          )}
        </div>
      </div>
    </aside>
  );
}