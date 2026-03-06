import { useState } from "react";
import MenuBar from "./components/layout/menuBar";
import ToolBox from "./components/layout/toolBox";
import CanvasArea from "./components/layout/canvasArea";
import PropertiesPanel from "./components/layout/propertiesPanel";
import Footer from "./components/layout/footer";

export default function App() {
  const [toolboxCollapsed, setToolboxCollapsed] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(true);

  const [activeTool, setActiveTool] = useState("select");

  // Brush options
  const [brushColor, setBrushColor] = useState("#ff3b30");
  const [brushSize, setBrushSize] = useState(12);

  // Image adjustment options (Fabric filters expect -1..1)
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);

  const handleToolSelect = (tool) => setActiveTool(tool);

  return (
    <div className="flex h-screen w-screen flex-col">
      <MenuBar />

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
          adjustments={{ brightness, contrast, saturation }}
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
          />
        </div>
      </div>

      <Footer />
    </div>
  );
}