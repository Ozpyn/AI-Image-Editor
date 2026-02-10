import { useState } from "react";
import MenuBar from "./components/layout/menuBar";
import ToolBox from "./components/layout/toolBox";
import CanvasArea from "./components/layout/canvasArea";
import PropertiesPanel from "./components/layout/propertiesPanel";
import Footer from "./components/layout/footer";

export default function App() {
  const [toolboxCollapsed, setToolboxCollapsed] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(true);

  //a variable for active tool with a setter function to it, default select tool
  const [activeTool, setActiveTool] = useState("select");

  //when a tool is selected in the toolbox, it will call this function to set 
  // the app mode to say "Erase" mode and let the canvasArea handle the erasing
 const handleToolSelect = (tool) => {
  setActiveTool(tool);
};

  return (
    <div className="flex h-screen w-screen flex-col">
      <MenuBar />

      {/* In the App we will be using lucide-react icons */}
      <div className="flex min-h-0 flex-1">
        <ToolBox
          collapsed={toolboxCollapsed}
          onToggle={() => setToolboxCollapsed((v) => !v)}
          activeTool={activeTool}
          onToolSelect={handleToolSelect}
         
        />

        <CanvasArea activeTool={activeTool}/>

        {/* Right panel hidden on small screens by default */}
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
