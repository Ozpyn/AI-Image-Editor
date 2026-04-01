import { Layers, SlidersHorizontal, Brush, Wand2, Sparkles } from "lucide-react";

export default function PropertiesPanel({
  open,
  onToggle,

  activeTool,

  brushColor,
  onBrushColorChange,
  brushSize,
  onBrushSizeChange,

  healFlow,
  onHealFlowChange,

  brightness,
  onBrightnessChange,
  contrast,
  onContrastChange,
  saturation,
  onSaturationChange,

  ai,
  aiPrompt,
  onAiPromptChange,
  aiGuidanceScale,
  onAiGuidanceScaleChange,
  aiSteps,
  onAiStepsChange,
  aiSeed,
  onAiSeedChange,
  outpaintDirections,
  onOutpaintDirectionsChange,
}) {
  const isBrushTool = activeTool === "brush";
  const isHealTool = activeTool === "heal";
  const isAdjustTool = activeTool === "adjust";
  const isInpaintTool = activeTool === "ai.inpaint";
  const isOutpaintTool = activeTool === "ai.outpaint";
  const isDeblurTool = activeTool === "ai.deblur";
  const isDescribeTool = activeTool === "ai.describe";
  const isBackgroundMagicTool = activeTool === "ai.backgroundmagic";

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
          <div className="text-sm font-semibold text-gray-800">Properties</div>
        </div>

        <button
          onClick={onToggle}
          className="rounded-lg px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
          type="button"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      <div className="space-y-3 px-3 pb-3">
        {isBrushTool && (
          <PanelCard title="Brush Settings" icon={<Brush className="h-4 w-4" />}>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-600">Color</div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={brushColor || "#ff3b30"}
                    onChange={(e) => onBrushColorChange?.(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200 bg-transparent"
                    aria-label="Brush color"
                  />
                  <div className="text-xs text-gray-600">{brushColor || "#ff3b30"}</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Size</span>
                  <span>{brushSize ?? 12}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="80"
                  value={brushSize ?? 12}
                  onChange={(e) => onBrushSizeChange?.(Number(e.target.value))}
                  className="mt-2 w-full accent-sky-500"
                  aria-label="Brush size"
                />
              </div>

              <div className="text-[11px] text-gray-500">
                Tip: Switch to Select to move objects. Brush draws paths on the canvas.
              </div>
            </div>
          </PanelCard>
        )}

        {isHealTool && (
          <PanelCard title="Heal Settings" icon={<Wand2 className="h-4 w-4" />}>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Stamp Size</span>
                  <span>{brushSize ?? 24}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="80"
                  value={brushSize ?? 24}
                  onChange={(e) => onBrushSizeChange?.(Number(e.target.value))}
                  className="mt-2 w-full accent-sky-500"
                  aria-label="Heal size"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Flow</span>
                  <span>{Math.round((healFlow ?? 0.45) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={healFlow ?? 0.45}
                  onChange={(e) => onHealFlowChange?.(parseFloat(e.target.value))}
                  className="mt-2 w-full accent-sky-500"
                  aria-label="Heal flow"
                />
              </div>

              <div className="text-[11px] text-gray-500">
                Hold <span className="font-semibold">Alt</span> (or Option on Mac) and click to set
                the source point, then paint to softly clone nearby pixels.
              </div>
            </div>
          </PanelCard>
        )}

        {isAdjustTool && (
          <PanelCard
            title="Image Adjustments"
            icon={<SlidersHorizontal className="h-4 w-4 text-sky-500" />}
          >
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
            <div className="mt-2 text-[11px] text-gray-500">
              Range: -1 to 1 (matches Fabric filter inputs). 0 = no change.
            </div>
          </PanelCard>
        )}

        {isInpaintTool && (
          <PanelCard title="Inpaint Settings" icon={<Wand2 className="h-4 w-4" />}>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-600">Prompt</div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => onAiPromptChange?.(e.target.value)}
                  placeholder="Describe what to generate in the masked area..."
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-600">Guidance Scale</div>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="0.5"
                    value={aiGuidanceScale}
                    onChange={(e) => onAiGuidanceScaleChange?.(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-600">Steps</div>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={aiSteps}
                    onChange={(e) => onAiStepsChange?.(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Seed (-1 for random)</div>
                <input
                  type="number"
                  value={aiSeed}
                  onChange={(e) => onAiSeedChange?.(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={() => ai?.inpaintFromCanvas({ prompt: aiPrompt, guidance_scale: aiGuidanceScale, steps: aiSteps, seed: aiSeed })}
                disabled={ai?.loading}
                className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {ai?.loading ? "Processing..." : "Apply Inpaint"}
              </button>
            </div>
          </PanelCard>
        )}

        {isOutpaintTool && (
          <PanelCard title="Outpaint Settings" icon={<Wand2 className="h-4 w-4" />}>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-600">Prompt</div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => onAiPromptChange?.(e.target.value)}
                  placeholder="Describe the extended area..."
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              <div>
                <div className="text-xs text-gray-600">Directions to Expand</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { key: "top", label: "Top" },
                    { key: "bottom", label: "Bottom" },
                    { key: "left", label: "Left" },
                    { key: "right", label: "Right" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={outpaintDirections[key]}
                        onChange={(e) => onOutpaintDirectionsChange?.({ ...outpaintDirections, [key]: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-600">Guidance Scale</div>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="0.5"
                    value={aiGuidanceScale}
                    onChange={(e) => onAiGuidanceScaleChange?.(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-600">Steps</div>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={aiSteps}
                    onChange={(e) => onAiStepsChange?.(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Seed (-1 for random)</div>
                <input
                  type="number"
                  value={aiSeed}
                  onChange={(e) => onAiSeedChange?.(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={() => {
                  const directions = {};
                  if (outpaintDirections.left) directions.left = 256;
                  if (outpaintDirections.right) directions.right = 256;
                  if (outpaintDirections.top) directions.top = 256;
                  if (outpaintDirections.bottom) directions.bottom = 256;
                  ai?.outpaintFromCanvas({ prompt: aiPrompt, guidance_scale: aiGuidanceScale, steps: aiSteps, seed: aiSeed, directions });
                }}
                disabled={ai?.loading || !Object.values(outpaintDirections).some(Boolean)}
                className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {ai?.loading ? "Processing..." : "Apply Outpaint"}
              </button>
            </div>
          </PanelCard>
        )}

        {isDeblurTool && (
          <PanelCard title="Deblur Settings" icon={<Wand2 className="h-4 w-4" />}>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-600">Optional Prompt</div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => onAiPromptChange?.(e.target.value)}
                  placeholder="Optional: describe the image for better results..."
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
              <button
                onClick={() => ai?.deblurFromCanvas({ prompt: aiPrompt || undefined })}
                disabled={ai?.loading}
                className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {ai?.loading ? "Processing..." : "Apply Deblur"}
              </button>
            </div>
          </PanelCard>
        )}

        {isDescribeTool && (
          <PanelCard title="Describe Image" icon={<Wand2 className="h-4 w-4" />}>
            <div className="space-y-4">
              <div className="text-xs text-gray-600">
                Generate a description of the current image.
              </div>
              <button
                onClick={async () => {
                  try {
                    const description = await ai?.describeFromCanvas();
                    alert(`Image Description: ${description}`);
                  } catch (err) {
                    alert(`Error: ${err.message}`);
                  }
                }}
                disabled={ai?.loading}
                className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {ai?.loading ? "Processing..." : "Describe Image"}
              </button>
            </div>
          </PanelCard>
        )}

        
{isBackgroundMagicTool && (
  <PanelCard title="Background Magic" icon={<Sparkles className="h-4 w-4" />}>
    <div className="space-y-4">
      {/* Remove Background Section */}
      <div className="border-b border-gray-200 pb-3">
        <div className="text-xs font-semibold text-gray-700 mb-2">Remove Background</div>

          <button
            onClick={async () => {
              try {
                const canvas = window.canvas;
                if (!canvas) throw new Error("Canvas not initialized");
                
                const img = canvas.getObjects().find((o) => o.type === "image");
                if (!img) throw new Error("No image on canvas!");
                
                const dataUrl = img.toDataURL({ format: "png" });
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                
                // Call removeBackground with the blob
                await ai?.removeBackground({
                  imageBlob: blob,
                  apply: true,
                  applyMode: "replace"
                });
              } catch (err) {
                alert(`Error: ${err.message}`);
              }
            }}
            disabled={ai?.loading}
            className="w-full rounded-lg bg-purple-500 px-3 py-2 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
          >
            {ai?.loading ? "Processing..." : "Remove Background"}
          </button>
      </div>

      {/* Replace Background Section */}
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-2">Replace Background</div>
        <div className="text-xs text-gray-600 mb-2">Prompt</div>
        <textarea
          value={aiPrompt}
          onChange={(e) => onAiPromptChange?.(e.target.value)}
          placeholder="Describe the new background (e.g., 'beach at sunset', 'modern office', 'forest path')..."
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          rows={3}
        />
        <button
          onClick={async () => {
            if (!aiPrompt?.trim()) {
              alert("Please enter a prompt for the new background");
              return;
            }
            
            try {
              const canvas = window.canvas;
              if (!canvas) throw new Error("Canvas not initialized");
              
              const img = canvas.getObjects().find((o) => o.type === "image");
              if (!img) throw new Error("No image on canvas!");
              
              const dataUrl = img.toDataURL({ format: "png" });
              const res = await fetch(dataUrl);
              const blob = await res.blob();
              
              // First remove background
              const result = await ai?.removeBackground({
                imageBlob: blob,
                apply: false, // Don't apply yet, we'll apply after replacement
                applyMode: "replace"
              });
              
              if (result?.blob) {
                // TODO: Add replace background API endpoint
                // For now, just apply the background-removed image
                await ai?.canvasActions?.applyBlobResult(result.blob, { mode: "replace" });
                alert("Background removed! Replace with AI-generated background coming soon!");
              }
            } catch (err) {
              alert(`Error: ${err.message}`);
            }
          }}
          disabled={ai?.loading || !aiPrompt?.trim()}
          className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {ai?.loading ? "Processing..." : "Remove & Replace Background"}
        </button>
      </div>
      
      <div className="text-[11px] text-gray-500 mt-2">
        Remove background completely, or replace it with an AI-generated background based on your prompt.
      </div>
    </div>
  </PanelCard>
)}

        <PanelCard title="Layers" icon={<Layers className="h-4 w-4" />}>
          <div className="text-xs text-gray-600">
            Placeholder for layers. Later you can render real canvas objects here.
          </div>
          <div className="mt-3 space-y-2">
            <LayerRow name="Background" active />
            <LayerRow name="Image 1" />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="w-1/2 rounded-lg bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
              type="button"
            >
              + Add
            </button>
            <button
              className="w-1/2 rounded-lg bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
              type="button"
            >
              − Remove
            </button>
          </div>
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
        active ? "bg-sky-100 text-gray-900" : "text-gray-700 hover:bg-gray-100",
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
      <div className="flex items-center justify-between text-xs text-gray-700">
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
        className="mt-2 w-full accent-sky-500"
      />
    </div>
  );
}