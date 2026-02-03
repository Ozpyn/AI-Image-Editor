import { Layers, SlidersHorizontal } from "lucide-react";

export default function PropertiesPanel({ open, onToggle }) {
  return (
    <aside
      className={[
        "h-full border-l border-white/10 bg-panel/60 backdrop-blur supports-[backdrop-filter]:bg-panel/40",
        "shrink-0",
        open ? "w-80" : "w-0",
        "transition-[width] duration-200 ease-out",
        "overflow-hidden",
      ].join(" ")}
    >
      <div className="flex h-12 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-gray-200" />
          <div className="text-sm font-semibold">Properties</div>
        </div>
        <button
          onClick={onToggle}
          className="rounded-lg px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      <div className="space-y-3 px-3 pb-3">
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

        <PanelCard title="Image Adjustments" icon={<SlidersHorizontal className="h-4 w-4" />}>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
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
        "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
        active ? "bg-white/10 text-white" : "bg-white/0 text-gray-200 hover:bg-white/5",
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
      <div className="flex items-center justify-between text-xs text-gray-300">
        <span>{label}</span>
        <span>0</span>
      </div>
      <input type="range" className="mt-2 w-full accent-white" />
    </div>
  );
}
