import { useState, useEffect } from "react";
import MenuBar from "./components/layout/menuBar";
import ToolBox from "./components/layout/toolBox";
import CanvasArea from "./components/layout/canvasArea";
import PropertiesPanel from "./components/layout/propertiesPanel";
import Footer from "./components/layout/footer";
import ProgressBar from "./components/progressBar";
import { useAiFeatures } from "./features/aiFeatures/useAiFeatures";

export default function App() {
  const [toolboxCollapsed, setToolboxCollapsed] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [activeTool, setActiveTool] = useState("select");

  const [brushColor, setBrushColor] = useState("#ff3b30");
  const [brushSize, setBrushSize] = useState(12);

  // Heal options
  const [healFlow, setHealFlow] = useState(0.45);

  // Image adjustment options (Fabric filters expect -1..1)
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);

  const [canvasActions, setCanvasActions] = useState(null);

  const handleToolSelect = (tool) => setActiveTool(tool);

  // Create AI hook; it can run only after canvasActions are available
  const ai = useAiFeatures({
    canvasActions,
  });

  const onAiTest = async () => {
    setActiveTool("ai.inpaint");

    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    await ai.inpaintFromCanvas({
      prompt: "remove the object, realistic background",
      apply: true,
      applyMode: "replace",
    });
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      <MenuBar
        activeTool={activeTool}
        onToolSelect={handleToolSelect}
        onAiTest={onAiTest}
      />

      <div className="flex min-h-0 flex-1">
        <ToolBox
          collapsed={toolboxCollapsed}
          onToggle={() => setToolboxCollapsed((v) => !v)}
          activeTool={activeTool}
          onToolSelect={handleToolSelect}
          brushColor={brushColor}
          brushSize={brushSize}
          onBrushColorChange={setBrushColor}
          onBrushSizeChange={setBrushSize}
          canvas={canvasActions?.canvas}
          canvasActions={canvasActions}
        />

        <CanvasArea
          activeTool={activeTool}
          brushColor={brushColor}
          brushSize={brushSize}
          healFlow={healFlow}
          adjustments={{ brightness, contrast, saturation }}
          onCanvasActionsReady={setCanvasActions}
        />

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
            
            // Props for ExtendPanel
            onExtend={executeAiOutpaint}
            isAiProcessing={ai.loading}
            externalPrompt={pendingExtendParams?.prompt}
          />
        </div>
      </div>

      <Footer />
    </div>
  );
}
