// components/extendPanel.jsx
import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Check } from "lucide-react";

export default function ExtendPanel({ 
  onExtend, 
  isProcessing = false,
  defaultValues = { left: 100, right: 100, top: 100, bottom: 100 },
  externalPrompt = "" // Receive the prompt from dropdown
}) {
  const [directions, setDirections] = useState(defaultValues);
  const [prompt, setPrompt] = useState(externalPrompt);

  // Update internal prompt when externalPrompt changes
  useEffect(() => {
    setPrompt(externalPrompt);
  }, [externalPrompt]);

  const handleDirectionChange = (direction, value) => {
    setDirections(prev => ({
      ...prev,
      [direction]: Math.max(0, Math.min(500, value)) // Limit to 0-500px
    }));
  };

  const handleExtend = () => {
    onExtend({
      ...directions,
      // Use the prompt from dropdown if available
      prompt: prompt
    });
  };

  const totalPixels = directions.left + directions.right + directions.top + directions.bottom;

  return (
    <div className="space-y-4">
      {/* Stage Icon with Direction Controls */}
      <div className="relative aspect-square w-full rounded-lg bg-gray-800 p-4 border border-gray-700">
        {/* Center rectangle (original image) */}
        <div className="absolute inset-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="h-20 w-20 rounded border-2 border-accent bg-gray-700 flex items-center justify-center shadow-lg">
            <span className="text-xs text-gray-300">Original</span>
          </div>
        </div>

        {/* Direction controls */}
        <div className="absolute left-0 right-0 top-0 flex justify-center -translate-y-6">
          <DirectionControl
            icon={<ArrowUp className="h-4 w-4" />}
            value={directions.top}
            onChange={(val) => handleDirectionChange('top', val)}
            label="Top"
          />
        </div>

        <div className="absolute left-0 right-0 bottom-0 flex justify-center translate-y-6">
          <DirectionControl
            icon={<ArrowDown className="h-4 w-4" />}
            value={directions.bottom}
            onChange={(val) => handleDirectionChange('bottom', val)}
            label="Bottom"
          />
        </div>

        <div className="absolute left-0 top-1/2 flex -translate-x-6 -translate-y-1/2">
          <DirectionControl
            icon={<ArrowLeft className="h-4 w-4" />}
            value={directions.left}
            onChange={(val) => handleDirectionChange('left', val)}
            label="Left"
            vertical
          />
        </div>

        <div className="absolute right-0 top-1/2 flex translate-x-6 -translate-y-1/2">
          <DirectionControl
            icon={<ArrowRight className="h-4 w-4" />}
            value={directions.right}
            onChange={(val) => handleDirectionChange('right', val)}
            label="Right"
            vertical
          />
        </div>

        {/* Preview overlay showing expansion areas */}
        <div className="absolute inset-0 pointer-events-none">
          {directions.left > 0 && (
            <div className="absolute left-0 top-0 bottom-0 bg-accent/20 border-r border-accent" 
                 style={{ width: `${Math.min(50, directions.left / 10)}%` }} />
          )}
          {directions.right > 0 && (
            <div className="absolute right-0 top-0 bottom-0 bg-accent/20 border-l border-accent"
                 style={{ width: `${Math.min(50, directions.right / 10)}%` }} />
          )}
          {directions.top > 0 && (
            <div className="absolute top-0 left-0 right-0 bg-accent/20 border-b border-accent"
                 style={{ height: `${Math.min(50, directions.top / 10)}%` }} />
          )}
          {directions.bottom > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-accent/20 border-t border-accent"
                 style={{ height: `${Math.min(50, directions.bottom / 10)}%` }} />
          )}
        </div>
      </div>

      {/* Prompt indicator - shows if external prompt is being used */}
      {prompt && (
        <div className="rounded-lg bg-gray-800/50 p-2 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Using prompt from dropdown:</div>
          <div className="text-sm text-accent truncate" title={prompt}>
            "{prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt}"
          </div>
        </div>
      )}

      {/* Direction values summary */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded bg-gray-800 p-2 border border-gray-700">
          <span className="text-gray-400">Left:</span>
          <span className="ml-2 font-mono text-accent">{directions.left}px</span>
        </div>
        <div className="rounded bg-gray-800 p-2 border border-gray-700">
          <span className="text-gray-400">Right:</span>
          <span className="ml-2 font-mono text-accent">{directions.right}px</span>
        </div>
        <div className="rounded bg-gray-800 p-2 border border-gray-700">
          <span className="text-gray-400">Top:</span>
          <span className="ml-2 font-mono text-accent">{directions.top}px</span>
        </div>
        <div className="rounded bg-gray-800 p-2 border border-gray-700">
          <span className="text-gray-400">Bottom:</span>
          <span className="ml-2 font-mono text-accent">{directions.bottom}px</span>
        </div>
      </div>

      {/* Total expansion info */}
      <div className="rounded-lg bg-gray-800 p-2 text-center text-xs border border-gray-700">
        <span className="text-gray-400">New dimensions: </span>
        <span className="font-mono text-accent">
          {800 + directions.left + directions.right} x {600 + directions.top + directions.bottom}px
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleExtend}
          disabled={isProcessing || totalPixels === 0}
          className={[
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition",
            isProcessing || totalPixels === 0
              ? "bg-gray-700 cursor-not-allowed opacity-50 text-gray-400"
              : "bg-accent hover:bg-accent/80 text-white"
          ].join(" ")}
          type="button"
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processing...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Extend Image
            </>
          )}
        </button>
      </div>

      {/* Info text */}
      <p className="text-center text-xs text-gray-500">
        The AI will extend your image in the selected directions, matching the existing style and content
        {prompt && " using your custom prompt"}
      </p>
    </div>
  );
}

function DirectionControl({ icon, value, onChange, label, vertical = false }) {
  const [localValue, setLocalValue] = useState(value);

  const handleChange = (e) => {
    const newValue = parseInt(e.target.value) || 0;
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className={[
      "flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1 border border-gray-700",
      vertical ? "flex-col" : "flex-row"
    ].join(" ")}>
      <div className="text-accent">{icon}</div>
      <input
        type="range"
        min="0"
        max="500"
        step="10"
        value={localValue}
        onChange={handleChange}
        className={[
          "h-1 accent-accent",
          vertical ? "w-16 rotate-90" : "w-16"
        ].join(" ")}
        aria-label={label}
      />
      <span className="min-w-[40px] text-center text-xs font-mono text-accent">
        {value}px
      </span>
    </div>
  );
}