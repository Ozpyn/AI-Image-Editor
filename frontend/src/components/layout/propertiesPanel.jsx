// components/layout/propertiesPanel.jsx (update)
import { Layers, SlidersHorizontal, Brush, ArrowUp } from "lucide-react";
import ExtendPanel from "../extendPanel";

export default function PropertiesPanel({
  open,
  onToggle,
  activeTool,
  brushColor,
  onBrushColorChange,
  brushSize,
  onBrushSizeChange,
  brightness,
  onBrightnessChange,
  contrast,
  onContrastChange,
  saturation,
  onSaturationChange,
  onExtend,
  isAiProcessing,
  externalPrompt, // ✅ Added this line
}) {
  return (
    <aside
      className={[
        "h-full border-l border-white/10 bg-panel/90 backdrop-blur",
        "shrink-0",
        open ? "w-80" : "w-0",
        "transition-[width] duration-200 ease-out",
        "overflow-hidden",
      ].join(" ")}
    >
      <div className="flex h-12 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-accent" />
          <div className="text-sm font-semibold text-gray-200">Properties</div>
        </div>

        <button
          onClick={onToggle}
          className="rounded-lg px-2 py-1 text-xs text-gray-400 transition hover:bg-white/10 hover:text-accent"
          type="button"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      <div className="space-y-3 px-3 pb-3 overflow-y-auto max-h-[calc(100vh-8rem)]">
        {/* Extend Panel - shown when extend tool is active */}
        {activeTool === "ai.outpaint" && (
          <PanelCard title="Extend Image" icon={<ArrowUp className="h-4 w-4" />}>
            <ExtendPanel 
              onExtend={onExtend}
              isProcessing={isAiProcessing}
              defaultValues={{ left: 100, right: 100, top: 100, bottom: 100 }}
              externalPrompt={externalPrompt} // ✅ Now this works!
            />
          </PanelCard>
        )}

        {/* Brush options only when brush tool is active */}
        {activeTool === "brush" && (
          <PanelCard title="Brush Settings" icon={<Brush className="h-4 w-4" />}>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-400">Color</div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={brushColor || "#ff3b30"}
                    onChange={(e) => onBrushColorChange?.(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                    aria-label="Brush color"
                  />
                  <div className="text-xs text-gray-400">{brushColor || "#ff3b30"}</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Size</span>
                  <span>{brushSize ?? 12}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="80"
                  value={brushSize ?? 12}
                  onChange={(e) => onBrushSizeChange?.(Number(e.target.value))}
                  className="mt-2 w-full accent-accent"
                  aria-label="Brush size"
                />
              </div>
            </div>
          </PanelCard>
        )}

        {/* Mask tool settings */}
        {activeTool === "mask" && (
          <PanelCard title="Mask Settings" icon={<Brush className="h-4 w-4" />}>
            <div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Brush Size</span>
                <span>{brushSize ?? 40}px</span>
              </div>
              <input
                type="range"
                min="5"
                max="200"
                value={brushSize ?? 40}
                onChange={(e) => onBrushSizeChange?.(Number(e.target.value))}
                className="mt-2 w-full accent-accent"
                aria-label="Mask brush size"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Draw white areas to define where AI should inpaint
            </p>
          </PanelCard>
        )}

        {/* Erase tool settings */}
        {activeTool === "erase" && (
          <PanelCard title="Eraser Settings" icon={<Brush className="h-4 w-4" />}>
            <div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Size</span>
                <span>{brushSize ?? 40}px</span>
              </div>
              <input
                type="range"
                min="5"
                max="200"
                value={brushSize ?? 40}
                onChange={(e) => onBrushSizeChange?.(Number(e.target.value))}
                className="mt-2 w-full accent-accent"
                aria-label="Eraser size"
              />
            </div>
          </PanelCard>
        )}

        {/* Always show layers panel */}
        <PanelCard title="Layers" icon={<Layers className="h-4 w-4" />}>
          <div className="text-xs text-gray-400">
            Manage your canvas layers
          </div>
          <div className="mt-3 space-y-2">
            <LayerRow name="Background" active />
            <LayerRow name="Image" />
          </div>
        </PanelCard>

        {/* Always show adjustments */}
        <PanelCard title="Image Adjustments" icon={<SlidersHorizontal className="h-4 w-4" />}>
          <AdjustSlider
            label="Brightness"
            value={brightness}
            onChange={onBrightnessChange}
          />
          <AdjustSlider
            label="Contrast"
            value={contrast}
            onChange={onContrastChange}
          />
          <AdjustSlider
            label="Saturation"
            value={saturation}
            onChange={onSaturationChange}
          />
        </PanelCard>
      </div>
    </aside>
  );
}

function PanelCard({ title, icon, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-200">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function LayerRow({ name, active }) {
  return (
    <div
      className={[
        "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition",
        active ? "bg-accent/20 text-white" : "text-gray-400 hover:bg-white/5",
      ].join(" ")}
    >
      <span>{name}</span>
      <span className="text-xs text-gray-500">100%</span>
    </div>
  );
}

function AdjustSlider({ label, value = 0, onChange }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="tabular-nums">{Number(value).toFixed(2)}</span>
      </div>

      <input
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange?.(parseFloat(e.target.value))}
        className="mt-2 w-full accent-accent"
      />
    </div>
  );
}