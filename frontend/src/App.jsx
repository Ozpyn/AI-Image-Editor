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

  // AI Action Handlers
  const handleAiRemove = async (prompt) => {
    setActiveTool("ai.remove");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    try {
      // Use ai.inpaint (not inpaintFromCanvas)
      await ai.inpaint({
        prompt: prompt || "remove the object, realistic background",
        apply: true,
        applyMode: "replace",
      });
    } catch (error) {
      console.error("AI Remove failed:", error);
      alert("Failed to remove object: " + error.message);
    }
  };

  const handleAiInpaint = async (prompt) => {
    setActiveTool("ai.inpaint");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    try {
      // Use ai.inpaint
      await ai.inpaint({
        prompt: prompt || "fill with realistic content",
        apply: true,
        applyMode: "replace",
      });
    } catch (error) {
      console.error("AI Inpaint failed:", error);
      alert("Failed to inpaint: " + error.message);
    }
  };

  const handleAiOutpaint = async (prompt) => {
    setActiveTool("ai.outpaint");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    try {
      // Use ai.outpaint
      await ai.outpaint({
        prompt: prompt || "extend the image realistically",
        exportMultiplier: 2,
        apply: true,
        applyMode: "replace",
      });
    } catch (error) {
      console.error("AI Outpaint failed:", error);
      alert("Failed to extend image: " + error.message);
    }
  };

  const handleAiRemovebg = async () => {
    setActiveTool("ai.removebg");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    try {
      // Get the current canvas image
      const imageBlob = await canvasActions.exportAsPNGBlob(1, true);
      
      if (!imageBlob) {
        throw new Error("No image to process");
      }

      const resultUrl = await ai.removeBackground(imageBlob);
      
      if (resultUrl && canvasActions?.applyBlobResult) {
        // Fetch the blob from the URL
        const response = await fetch(resultUrl);
        const blob = await response.blob();
        await canvasActions.applyBlobResult(blob, { mode: "replace" });
      }
    } catch (error) {
      console.error("AI Remove Background failed:", error);
      alert("Failed to remove background: " + error.message);
    }
  };

  const handleAiReplacebg = async (prompt) => {
    setActiveTool("ai.replacebg");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    try {
      // First remove background
      const imageBlob = await canvasActions.exportAsPNGBlob(1, true);
      
      if (!imageBlob) {
        throw new Error("No image to process");
      }

      const bgRemovedUrl = await ai.removeBackground(imageBlob);
      
      // Create a blob from the URL
      const response = await fetch(bgRemovedUrl);
      const blob = await response.blob();
      
      // Apply the background removed image
      await canvasActions.applyBlobResult(blob, { mode: "replace" });
      
      // Then inpaint with new background prompt if needed
      if (prompt) {
        await ai.inpaint({
          prompt: prompt,
          apply: true,
          applyMode: "replace",
        });
      }
    } catch (error) {
      console.error("AI Replace Background failed:", error);
      alert("Failed to replace background: " + error.message);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      <MenuBar
        activeTool={activeTool}
        onToolSelect={handleToolSelect}
        onAiRemove={handleAiRemove}
        onAiInpaint={handleAiInpaint}
        onAiOutpaint={handleAiOutpaint}
        onAiRemovebg={handleAiRemovebg}
        onAiReplacebg={handleAiReplacebg}
        aiLoading={ai.loading}
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
          canvas={canvasActions?.canvas} // Pass canvas if needed
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
