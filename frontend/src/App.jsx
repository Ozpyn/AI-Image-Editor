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

  // Image adjustment options (Fabric filters expect -1..1)
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);

  const [canvasActions, setCanvasActions] = useState(null);

  // Progress bar visibility - directly controlled
  const [showProgress, setShowProgress] = useState(false);

  const handleToolSelect = (tool) => setActiveTool(tool);

  // Create AI hook
  const ai = useAiFeatures({
    canvasActions,
  });

  const onAiTest = async () => {
    setActiveTool("ai.inpaint");

  // Directly control progress bar visibility based on ai.loading
  useEffect(() => {
    console.log("AI Loading state changed:", ai.loading, "Progress:", ai.progress);
    
    if (ai.loading) {
      setShowProgress(true);
    } else if (!ai.loading && ai.progress === 100) {
      // When loading is false and progress is 100, keep showing for a moment then hide
      const timer = setTimeout(() => {
        setShowProgress(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (!ai.loading) {
      // If loading is false but progress isn't 100 (maybe error or cancelled), hide immediately
      setShowProgress(false);
    }
  }, [ai.loading, ai.progress]);

  // Handle manual close of progress bar
  const handleProgressComplete = () => {
    setShowProgress(false);
  };

  const handleAiRemove = async (prompt) => {
    setActiveTool("ai.remove");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    try {
      // Progress bar will show via useEffect when ai.loading becomes true
      await ai.inpaint({
        prompt: prompt || "remove the object, realistic background",
        apply: true,
        applyMode: "inpaint",
      });
    } catch (error) {
      console.error("AI Remove failed:", error);
      // Error will be shown in progress bar, but we need to ensure it hides after error
      setTimeout(() => {
        setShowProgress(false);
      }, 3000);
    }
  };

  const handleAiInpaint = async (prompt) => {
    setActiveTool("ai.inpaint");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    try {
      await ai.inpaint({
        prompt: prompt || "fill with realistic content",
        apply: true,
        applyMode: "inpaint",
      });
    } catch (error) {
      console.error("AI Inpaint failed:", error);
      setTimeout(() => {
        setShowProgress(false);
      }, 3000);
    }
  };

  const handleAiOutpaint = async (prompt) => {
    setActiveTool("ai.outpaint");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    await ai.inpaintFromCanvas({
      prompt: "remove the object, realistic background",
      apply: true,
      applyMode: "replace",
    });
    try {
      await ai.outpaint({
        prompt: prompt || "extend the image realistically",
        left: 100,
        right: 100,
        top: 100,
        bottom: 100,
        apply: true,
        applyMode: "replace",
      });
    } catch (error) {
      console.error("AI Outpaint failed:", error);
      setTimeout(() => {
        setShowProgress(false);
      }, 3000);
    }
  };

  const handleAiRemovebg = async () => {
    setActiveTool("ai.removebg");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    try {
      const imageBlob = await canvasActions.exportAsPNGBlob(1, true);
      
      if (!imageBlob) {
        throw new Error("No image to process");
      }

      const resultUrl = await ai.removeBackground(imageBlob);
      
      if (resultUrl && canvasActions?.applyBlobResult) {
        const response = await fetch(resultUrl);
        const blob = await response.blob();
        await canvasActions.applyBlobResult(blob, { mode: "replace" });
      }
    } catch (error) {
      console.error("AI Remove Background failed:", error);
      setTimeout(() => {
        setShowProgress(false);
      }, 3000);
    }
  };

  const handleAiReplacebg = async (prompt) => {
    setActiveTool("ai.replacebg");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    try {
      const imageBlob = await canvasActions.exportAsPNGBlob(1, true);
      
      if (!imageBlob) {
        throw new Error("No image to process");
      }

      const bgRemovedUrl = await ai.removeBackground(imageBlob);
      
      const response = await fetch(bgRemovedUrl);
      const blob = await response.blob();
      
      await canvasActions.applyBlobResult(blob, { mode: "replace" });
      
      if (prompt) {
        await ai.inpaint({
          prompt: prompt,
          apply: true,
          applyMode: "inpaint",
        });
      }
    } catch (error) {
      console.error("AI Replace Background failed:", error);
      setTimeout(() => {
        setShowProgress(false);
      }, 3000);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      <MenuBar
        activeTool={activeTool}
        onToolSelect={handleToolSelect}
        onAiTest={onAiTest}
        onAiRemove={handleAiRemove}
        onAiInpaint={handleAiInpaint}
        onAiOutpaint={handleAiOutpaint}
        onAiRemovebg={handleAiRemovebg}
        onAiReplacebg={handleAiReplacebg}
        aiLoading={ai.loading}
      />

      {/* Progress Bar */}
      <ProgressBar
        isProcessing={showProgress}
        progress={ai.progress}
        status={ai.status}
        error={ai.error}
        onComplete={handleProgressComplete}
        onCancel={() => {
          ai.cancel?.();
          setShowProgress(false);
        }}
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