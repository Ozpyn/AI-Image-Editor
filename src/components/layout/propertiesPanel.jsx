import { Layers, SlidersHorizontal } from "lucide-react";

export default function PropertiesPanel({ open, onToggle }) {
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
        <PanelCard
          title="Layers"
          icon={<Layers className="h-4 w-4 text-sky-500" />}
        >
          <div className="text-xs text-gray-600">
            Footer will later become the layer timeline. For now, this is a
            placeholder.
          </div>

          <div className="mt-3 space-y-2">
            <LayerRow name="Background" active />
            <LayerRow name="Image 1" />
          </div>

          <button className="mt-3 w-full rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 hover:shadow-md">
            + Add Layer
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
