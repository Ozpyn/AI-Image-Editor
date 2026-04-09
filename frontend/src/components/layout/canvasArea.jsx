// Import React hooks used in this component
import { useEffect, useRef } from "react";

// Import the custom canvas hook that manages Fabric canvas behavior
import { useCanvas } from "../../features/canvas/useCanvas";

// Import icons used for zoom and fit controls
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// Define the CanvasArea component
export default function CanvasArea({
  // The currently selected tool
  activeTool,

  // Current brush color
  brushColor,

  // Current brush size
  brushSize,

  // Current heal tool flow amount
  healFlow,

  // Current image adjustment values
  adjustments,

  // Value used to trigger export when it changes
  exportRequestId,

  // Callback used to expose canvas actions to the parent
  onCanvasActionsReady,

  // Callback used to request a tool change from the parent
  onToolChangeRequest,
}) {
  // Ref to the hidden file input used for image import
  const fileRef = useRef(null);

  // Ref to the visible stage container that wraps the Fabric canvas
  const stageRef = useRef(null);

  // Get canvas refs, readiness state, zoom text, and action methods from the custom hook
  const { canvasElRef, ready, zoomPercent, actions } = useCanvas({
    // Pass currently active tool into the hook
    activeTool,

    // Pass brush color into the hook
    brushColor,

    // Pass brush size into the hook
    brushSize,

    // Pass heal flow into the hook
    healFlow,

    // Pass current adjustments into the hook
    adjustments,

    // Pass parent tool-change callback into the hook
    onToolChangeRequest,
  });

  // Expose the latest canvas actions to the parent whenever actions change
  useEffect(() => {
    // Send actions object to parent if callback exists
    onCanvasActionsReady?.(actions);

    // Clear the parent reference on cleanup
    return () => onCanvasActionsReady?.(null);
  }, [actions, onCanvasActionsReady]);

  // Resize the Fabric canvas whenever the stage container changes size
  useEffect(() => {
    // Do nothing until the canvas is ready and the stage ref exists
    if (!ready || !stageRef.current) return;

    // Store the current stage element
    const stageArea = stageRef.current;

    // Function to measure the stage and update Fabric canvas size
    const resize = () => {
      // Read the current size of the stage element
      const rect = stageArea.getBoundingClientRect();

      // Only update when width and height are usable
      if (rect.width > 0 && rect.height > 0) {
        // Update canvas size through the hook action
        actions.setSize(rect.width, rect.height);
      }
    };

    // Run once immediately
    resize();

    // Watch the stage element for future size changes
    const ro = new ResizeObserver(resize);

    // Start observing the stage element
    ro.observe(stageArea);

    // Stop observing on cleanup
    return () => ro.disconnect();
  }, [ready, actions]);

  // Trigger export whenever exportRequestId changes
  useEffect(() => {
    // Do nothing until the canvas is ready
    if (!ready) return;

    // Do nothing if there is no export request yet
    if (!exportRequestId) return;

    // Ask the hook to export the canvas as a PNG data URL
    const dataUrl = actions.exportAsPNG?.(2);

    // Stop if export failed
    if (!dataUrl) return;

    // Create a temporary anchor element for download
    const link = document.createElement("a");

    // Set the file data URL on the anchor
    link.href = dataUrl;

    // Set the filename for the exported image
    link.download = `edited-image-${Date.now()}.png`;

    // Add anchor to the document
    document.body.appendChild(link);

    // Programmatically click it to start download
    link.click();

    // Remove the temporary anchor
    document.body.removeChild(link);
  }, [exportRequestId, ready, actions]);

  // Open the hidden file picker
  const onPickFile = () => fileRef.current?.click();

  // Handle image file selection
  const onFileChange = async (e) => {
    // Read the first selected file
    const file = e.target.files?.[0];

    // Stop if no file was selected
    if (!file) return;

    try {
      // Import the file into the canvas through the hook
      await actions.importFile(file);
    } finally {
      // Clear the input so the same file can be selected again later
      e.target.value = "";
    }
  };

  // Apply crop when the user clicks the crop button
  const handleApplyCrop = async () => {
    // Call crop action if it exists
    await actions.applyCrop?.();
  };

  // Render the canvas area UI
  return (
    // Main wrapper for the canvas section
    <main className="relative flex min-w-0 flex-1 flex-col">
      {/* Top toolbar above the canvas */}
      <div className="flex h-12 items-center justify-between border-b border-white/10 bg-panel/30 px-3 backdrop-blur">
        {/* Project title area */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {/* Show "Project:" only on medium screens and above */}
          <span className="hidden md:inline">Project:</span>

          {/* Project name badge */}
          <span className="rounded-md bg-white/5 px-2 py-1 text-gray-400">
            Group 1 AI Image Editor
          </span>
        </div>

        {/* Zoom and fit controls */}
        <div className="flex items-center gap-1">
          {/* Zoom out button */}
          <IconBtn
            // Accessible label for the button
            label="Zoom out"
            // Icon displayed inside the button
            icon={<ZoomOut className="h-4 w-4" />}
            // Click handler from canvas actions
            onClick={actions.zoomOut}
          />

          {/* Current zoom percentage display */}
          <div className="rounded-md bg-white/5 px-2 py-1 text-sm text-gray-600">
            {zoomPercent}%
          </div>

          {/* Zoom in button */}
          <IconBtn
            // Accessible label
            label="Zoom in"
            // Icon element
            icon={<ZoomIn className="h-4 w-4" />}
            // Click behavior
            onClick={actions.zoomIn}
          />

          {/* Small divider */}
          <div className="mx-1 h-6 w-px bg-white/10" />

          {/* Fit image to view button */}
          <IconBtn
            // Accessible label
            label="Fit"
            // Icon element
            icon={<Maximize2 className="h-4 w-4" />}
            // Click behavior
            onClick={actions.fitToView}
          />
        </div>
      </div>

      {/* Main content area holding the canvas */}
      <div className="flex flex-1 items-center justify-center p-3 md:p-6">
        {/* Decorative outer frame */}
        <div className="relative aspect-4/3 w-full max-w-275 rounded-2xl border border-white/10 bg-linear-to-b from-white/5 to-white/0 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          {/* Background checker-like pattern */}
          <div
            // Cover the whole frame
            className="absolute inset-0 rounded-2xl opacity-60"
            // Inline checker pattern styles
            style={{
              // Layered gradients used to create the pattern
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%)",
              // Size of the pattern grid
              backgroundSize: "24px 24px",
              // Pattern alignment offsets
              backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0px",
            }}
          />

          {/* Inner content wrapper */}
          <div className="relative z-10 flex h-full w-full items-center justify-center p-3">
            {/* Stage container that controls visible canvas size */}
            <div
              // Attach stage ref
              ref={stageRef}
              // Stage styling
              className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 bg-black/20"
            >
              {/* Actual HTML canvas used by Fabric */}
              <canvas ref={canvasElRef} className="block h-full w-full" />

              {/* Loading overlay shown before Fabric is ready */}
              {!ready && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    {/* Main loading text */}
                    <div className="text-sm font-semibold text-gray-200">
                      Initializing canvas…
                    </div>

                    {/* Secondary loading text */}
                    <div className="mt-1 text-xs text-gray-400">
                      Fabric is mounting
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom-right action buttons */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {/* Hidden file input for import */}
                <input
                  // Attach file input ref
                  ref={fileRef}
                  // This input selects files
                  type="file"
                  // Limit selection to images
                  accept="image/*"
                  // Keep it hidden
                  className="hidden"
                  // Handle file selection
                  onChange={onFileChange}
                />

                {/* Import image button */}
                <button
                  // Open the hidden file input
                  onClick={onPickFile}
                  // Button styling
                  className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                  // Explicit button type
                  type="button"
                >
                  Import Image
                </button>

                {/* Clear canvas button */}
                <button
                  // Reset canvas contents
                  onClick={actions.reset}
                  // Button styling
                  className="rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10"
                  // Explicit button type
                  type="button"
                >
                  Clear
                </button>

                {/* Show crop apply button only while crop tool is active */}
                {activeTool === "crop" && (
                  <button
                    // Apply crop
                    onClick={handleApplyCrop}
                    // Button styling
                    className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                    // Explicit button type
                    type="button"
                  >
                    Apply Crop
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Reusable icon-only toolbar button
function IconBtn({ icon, label, onClick }) {
  return (
    // Button element
    <button
      // Shared styling for icon buttons
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-sky-600 transition hover:bg-indigo-50 hover:text-indigo-600"
      // Accessibility label
      aria-label={label}
      // Browser tooltip
      title={label}
      // Explicit button type
      type="button"
      // Click handler
      onClick={onClick}
    >
      {/* Render icon passed as prop */}
      {icon}
    </button>
  );
}