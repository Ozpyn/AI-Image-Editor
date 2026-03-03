import { useMemo, useState } from "react";
import MenuBar from "./components/layout/menuBar";
import ToolBox from "./components/layout/toolBox";
import CanvasArea from "./components/layout/canvasArea";
import PropertiesPanel from "./components/layout/propertiesPanel";
import Footer from "./components/layout/footer";
import { useAiFeatures } from "./features/aiFeatures/useAiFeatures";

export default function App() {
  const [toolboxCollapsed, setToolboxCollapsed] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [activeTool, setActiveTool] = useState("select");

  const [brushColor, setBrushColor] = useState("#ff3b30");
  const [brushSize, setBrushSize] = useState(12);

  const [canvasActions, setCanvasActions] = useState(null);

  const handleToolSelect = (tool) => setActiveTool(tool);

  // Create AI hook; it can run only after canvasActions are available
  const ai = useAiFeatures({
    apiBase: "http://127.0.0.1:8000", // replace with http://VIPER_IP:8000 when ready
    canvasActions,
  });

  const onAiTest = async () => {
    // optional: switch tool label/state (not required for the test)
    setActiveTool("ai.inpaint");

    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    // IMPORTANT: this assumes you drew a mask (objects tagged role:'mask')
    // If you haven't built mask drawing yet, this call will still run but your mask may be empty/black.
    await ai.inpaintFromCanvas({
      prompt: "remove the object, realistic background",
      apply: true,
      applyMode: "replace",
      exportMultiplier: 2,
    });
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      <MenuBar
        activeTool={activeTool}
        onToolSelect={handleToolSelect}
        onAiTest={onAiTest} //just for testing using menubar
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
        />

        <CanvasArea
          activeTool={activeTool}
          brushColor={brushColor}
          brushSize={brushSize}
          onCanvasActionsReady={setCanvasActions} // ✅ gives App access
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
            brightness={brightness}
            onBrightnessChange={setBrightness}
            contrast={contrast}
            onContrastChange={setContrast}
            saturation={saturation}
            onSaturationChange={setSaturation}
            activeTool={activeTool}
            brushColor={brushColor}
            onBrushColorChange={setBrushColor}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            brightness={brightness}
            onBrightnessChange={setBrightness}
            contrast={contrast}
            onContrastChange={setContrast}
            saturation={saturation}
            onSaturationChange={setSaturation}
          />
        </div>
      </div>

      <Footer />
    </div>
  );
}