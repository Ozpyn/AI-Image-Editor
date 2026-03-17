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

  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);

  const [canvasActions, setCanvasActions] = useState(null);

  // Progress bar visibility - directly controlled
  const [showProgress, setShowProgress] = useState(false);

  // Store extend params for when user clicks from menu
  const [pendingExtendParams, setPendingExtendParams] = useState(null);

  const handleToolSelect = (tool) => {
    setActiveTool(tool);
    
    // If selecting extend tool, open properties panel
    if (tool === "ai.outpaint") {
      setPropertiesOpen(true);
    }
  };

  // Create AI hook
  const ai = useAiFeatures({
    canvasActions,
  });

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + E for Extend
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setActiveTool('ai.outpaint');
        setPropertiesOpen(true);
      }
      
      // Esc to cancel extend mode
      if (e.key === 'Escape' && activeTool === 'ai.outpaint') {
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool]);

  // ✅ FIXED: Remove Object - uses "inpaint" mode (composite=true)
  const handleAiRemove = async (prompt) => {
    setActiveTool("ai.remove");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    try {
      await ai.inpaint({
        prompt: prompt || "remove the object, realistic background",
        apply: true,
        applyMode: "inpaint", // Keeps original outside mask
      });
    } catch (error) {
      console.error("AI Remove failed:", error);
      setTimeout(() => {
        setShowProgress(false);
      }, 3000);
    }
  };

  // ✅ FIXED: Inpaint/Replace - uses "replace" mode (composite=false)
  const handleAiInpaint = async (prompt) => {
  setActiveTool("ai.inpaint");
  
  if (!canvasActions) {
    alert("Canvas not ready yet.");
    return;
  }

  try {
    await ai.inpaint({
      prompt: prompt || "a realistic red apple with stem, detailed texture", // Better default
      apply: true,
      applyMode: "inpaint", // Change back to "inpaint" to keep original outside mask
    });
  } catch (error) {
    console.error("AI Inpaint failed:", error);
    setTimeout(() => {
      setShowProgress(false);
    }, 3000);
  }
};

  // Handle extend tool - stores prompt and opens panel
  const handleAiOutpaint = async (promptFromDropdown) => {
    setActiveTool("ai.outpaint");
    
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    // Store the prompt from dropdown to use later
    setPendingExtendParams({ 
      prompt: promptFromDropdown || "extend the image realistically, seamless continuation"
    });
    
    // Open properties panel to show ExtendPanel
    setPropertiesOpen(true);
  };

  // Execute outpainting - called from ExtendPanel
  const executeAiOutpaint = async (params) => {
    if (!canvasActions) {
      alert("Canvas not ready yet.");
      return;
    }

    try {
      await ai.outpaint({
        prompt: params.prompt || "extend the image realistically, seamless continuation",
        left: params.left || 100,
        right: params.right || 100,
        top: params.top || 100,
        bottom: params.bottom || 100,
        apply: true,
        applyMode: "replace",
      });
      
      // After successful extension, switch back to select tool
      setActiveTool("select");
      setPendingExtendParams(null);
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

  // ✅ FIXED: Replace Background - uses "replace" mode for the inpaint part
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
          applyMode: "replace", // ✅ Changed from "inpaint" to "replace"
        });
      }
    } catch (error) {
      console.error("AI Replace Background failed:", error);
      setTimeout(() => {
        setShowProgress(false);
      }, 3000);
    }
  };



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
    <div className="flex h-screen w-screen flex-col bg-gradient-to-br from-gray-900 to-blue-800 text-white">
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