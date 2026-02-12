import { Layers, SlidersHorizontal, Brush } from "lucide-react";

export default function PropertiesPanel({
  open,
  onToggle,

  // ✅ new props (added from App.jsx)
  activeTool,
  brushColor,
  setBrushColor,
  brushSize,
  setBrushSize,
}) {
  return (
    <aside
      className={[
        "h-full border-l border-gray-200 bg-white/80 backdrop-blur",
        "shrink-0",
        open ? "w-80" : "w-0",
        "transition-[width] duration-200 ease-out",
        "overflow-hidden",
      ].join(" ")}
    >
      <div className="flex h-12 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-sky-500" />
          <div className="text-sm font-semibold text-gray-800">
            Properties
          </div>
        </div>

        <button
          onClick={onToggle}
          className="rounded-lg px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      <div className="space-y-3 px-3 pb-3">
        {/*Brush options only when brush tool is active */}
        {activeTool === "brush" && (
          <PanelCard title="Brush Settings" icon={<Brush className="h-4 w-4" />}>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-300">Color</div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={brushColor || "#000000"}
                    onChange={(e) => setBrushColor?.(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                    aria-label="Brush color"
                  />
                  <div className="text-xs text-gray-300">{brushColor || "#000000"}</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>Size</span>
                  <span>{brushSize ?? 12}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="80"
                  value={brushSize ?? 12}
                  onChange={(e) => setBrushSize?.(Number(e.target.value))}
                  className="mt-2 w-full accent-white"
                  aria-label="Brush size"
                />
              </div>

              <div className="text-[11px] text-gray-400">
                Tip: Switch to Select to move objects. Brush draws paths on the canvas.
              </div>
            </div>
          </PanelCard>
        )}

        <PanelCard title="Layers" icon={<Layers className="h-4 w-4" />}>
          <div className="text-xs text-gray-300">
            Footer will later become the layer timeline. For now, this is a placeholder.
          </div>
          <div id="layers" className="mt-3 space-y-2">
            <LayerRow name="Background" active />
            <LayerRow name="Image 1" />
          </div>
          <button id="addLayer" className="mt-3 w-half rounded-lg bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
            + Add Layer
          </button>
          <button id="rmLayer" className="mt-3 w-half rounded-lg bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
            - Remove Layer
          </button>
        </PanelCard>

        <PanelCard
          title="Image Adjustments"
          icon={<SlidersHorizontal className="h-4 w-4 text-sky-500" />}
        >
          <Slider label="Brightness" />
          <Slider label="Contrast" />
          <Slider label="Saturation" />
        </PanelCard>
      </div>
    </aside>
  );
}

function PanelCard({ title, icon, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
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
        active
          ? "bg-sky-100 text-gray-900"
          : "text-gray-700 hover:bg-gray-100",
      ].join(" ")}
    >
      <span>{name}</span>
      <span className="text-xs text-gray-400">100%</span>
    </div>
  );
}

function Slider({ label }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span>0</span>
      </div>

      <input
        type="range"
        className="mt-2 w-full accent-sky-500"
      />
    </div>
  );
}
