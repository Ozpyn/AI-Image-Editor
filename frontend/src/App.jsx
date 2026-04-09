// Import React state hook
import { useState } from "react";

// Import layout components
import MenuBar from "./components/layout/menuBar";
import ToolBox from "./components/layout/toolBox";
import CanvasArea from "./components/layout/canvasArea";
import PropertiesPanel from "./components/layout/propertiesPanel";
import Footer from "./components/layout/footer";

// Import AI feature hook
import { useAiFeatures } from "./features/aiFeatures/useAiFeatures";

// Define the main application component
export default function App() {
  // Controls whether the toolbox is collapsed
  const [toolboxCollapsed, setToolboxCollapsed] = useState(false);

  // Controls whether the properties panel is open
  const [propertiesOpen, setPropertiesOpen] = useState(true);

  // Stores the currently selected tool
  const [activeTool, setActiveTool] = useState("select");

  // Brush options
  const [brushColor, setBrushColor] = useState("#ff3b30");
  const [brushSize, setBrushSize] = useState(12);

  // Heal options
  const [healFlow, setHealFlow] = useState(0.45);

  // Image adjustment options (Fabric filters expect -1..1)
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);

  // AI options
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGuidanceScale, setAiGuidanceScale] = useState(6.5);
  const [aiSteps, setAiSteps] = useState(30);
  const [aiSeed, setAiSeed] = useState(-1);
  const [outpaintDirections, setOutpaintDirections] = useState({
    left: false,
    right: false,
    top: false,
    bottom: false,
  });

  // Stores methods exposed by the canvas hook
  const [canvasActions, setCanvasActions] = useState(null);

  // Change the current active tool
  const handleToolSelect = (tool) => setActiveTool(tool);

  // Create AI helpers and pass canvas actions into them
  const ai = useAiFeatures({
    canvasActions,
  });

  // Export trigger counter
  const [exportRequestId, setExportRequestId] = useState(0);

  // Request a new export by increasing the counter
  const handleExport = () => {
    setExportRequestId((prev) => prev + 1);
  };

  // Run undo through canvas actions
  const handleUndo = () => {
    canvasActions?.undo?.();
  };

  // Run redo through canvas actions
  const handleRedo = () => {
    canvasActions?.redo?.();
  };

  // Import selected file through canvas actions
  const handleOpenFile = async (file) => {
    await canvasActions?.importFile?.(file);
  };

  // Render the app layout
  return (
    <div className="flex h-screen w-screen flex-col">
      {/* Top menu bar */}
      <MenuBar
        activeTool={activeTool}
        onToolSelect={handleToolSelect}
        onExport={handleExport}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenFile={handleOpenFile}
        canUndo={canvasActions?.canUndo ?? false}
        canRedo={canvasActions?.canRedo ?? false}
      />

      {/* Main horizontal content area */}
      <div className="flex min-h-0 flex-1">
        {/* Left toolbox */}
        <ToolBox
          collapsed={toolboxCollapsed}
          onToggle={() => setToolboxCollapsed((v) => !v)}
          activeTool={activeTool}
          onToolSelect={handleToolSelect}
          brushColor={brushColor}
          brushSize={brushSize}
          onBrushColorChange={setBrushColor}
          onBrushSizeChange={setBrushSize}
          canvasActions={canvasActions}
        />

        {/* Central canvas area */}
        <CanvasArea
          activeTool={activeTool}
          brushColor={brushColor}
          brushSize={brushSize}
          healFlow={healFlow}
          adjustments={{ brightness, contrast, saturation }}
          exportRequestId={exportRequestId}
          onCanvasActionsReady={setCanvasActions}
          onToolChangeRequest={setActiveTool}
        />

        {/* Right properties panel, shown only on large screens */}
        <div className="hidden lg:block">
          <PropertiesPanel
            open={propertiesOpen}
            onToggle={() => setPropertiesOpen((v) => !v)}
            activeTool={activeTool}
            brushColor={brushColor}
            onBrushColorChange={setBrushColor}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            healFlow={healFlow}
            onHealFlowChange={setHealFlow}
            brightness={brightness}
            onBrightnessChange={setBrightness}
            contrast={contrast}
            onContrastChange={setContrast}
            saturation={saturation}
            onSaturationChange={setSaturation}
            ai={ai}
            aiPrompt={aiPrompt}
            onAiPromptChange={setAiPrompt}
            aiGuidanceScale={aiGuidanceScale}
            onAiGuidanceScaleChange={setAiGuidanceScale}
            aiSteps={aiSteps}
            onAiStepsChange={setAiSteps}
            aiSeed={aiSeed}
            onAiSeedChange={setAiSeed}
            outpaintDirections={outpaintDirections}
            onOutpaintDirectionsChange={setOutpaintDirections}
          />
        </div>
      </div>

      {/* Bottom footer */}
      <Footer />
    </div>
  );
}