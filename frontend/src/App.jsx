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

  const handleToolSelect = (tool) => {
    setActiveTool(tool);
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      <MenuBar />

      <div className="flex min-h-0 flex-1">
        <ToolBox
          collapsed={toolboxCollapsed}
          onToggle={() => setToolboxCollapsed((v) => !v)}
          activeTool={activeTool}
          onToolSelect={handleToolSelect}
          // pass brush controls to toolbox 
          brushColor={brushColor}
          brushSize={brushSize}
          onBrushColorChange={setBrushColor}
          onBrushSizeChange={setBrushSize}
        />

        <CanvasArea
          activeTool={activeTool}
          // pass brush options to canvas 
          brushColor={brushColor}
          brushSize={brushSize}
        />

        <div className="hidden lg:block">
          <PropertiesPanel
            open={propertiesOpen}
            onToggle={() => setPropertiesOpen((v) => !v)}
          />
        </div>
      </div>

      <Footer />
    </div>
  );
}
