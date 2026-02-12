import { useState } from "react";
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
  { key: "select", label: "Select", icon: MousePointer2},
  { key: "crop", label: "Crop", icon: Crop },
  { key: "erase", label: "Erase", icon: Eraser },
  { key: "text", label: "Text", icon: Type },
  { key: "brush", label: "Brush", icon: Brush },
  { key: "heal", label: "Heal", icon: Wand2 },
  { key: "cutout", label: "Cutout", icon: Scissors },
  { key: "adjust", label: "Adjust", icon: SlidersHorizontal },
  { key: "ai", label: "AI Remove", icon: Sparkles },
];

export default function ToolBox({ collapsed, onToggle, onCanvasAction, activeTool, onToolSelect }) {
    //before return create ai feature hook  
    const { inpaint } = useAiFeatures();
    //

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
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10"
          aria-label={collapsed ? "Expand toolbox" : "Collapse toolbox"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
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
                //if the tool is active, highlight it
                activeTool === key ? "bg-accent text-white" : "text-gray-200",
              ].join(" ")}
              onClick={() => onToolSelect(key)}
            >
              <Icon className="h-4 w-4 text-gray-200" />
              {!collapsed && (
                <span className="text-sm text-gray-200 group-hover:text-white">{label}</span>
              )}
            </button>
          ))}
        </div>

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
