import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/**
 * Get dimensions of an image blob
 */
async function getSize(blob) {
  if (!blob || !(blob instanceof Blob)) {
    throw new Error("getSize: argument must be a Blob");
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for size measurement"));
    };
    
    img.src = url;
  });
}

/**
 * Download a blob as a file to the user's local machine
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * AI hook (client-side)
 * Requires canvas "actions" from useCanvas:
 *  - exportAsPNGBlob(multiplier)
 *  - exportAsMaskBlob(multiplier)
 *  - applyBlobResult(blob, { mode })
 */
export function useAiFeatures({
  apiBase = API_BASE_URL,
  canvasActions, // { exportAsPNGBlob, exportAsMaskBlob, applyBlobResult }
} = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // AI Action: Inpainting (remove objects)
  const inpaint = async (prompt, image, mask, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/inpaint`, {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        let detail = "";
        try {
          detail = await response.text();
          console.error("Error response:", detail.substring(0, 200));
        } catch {
          /* ignore */
        }
        throw new Error(detail || `Request failed: ${response.status}`);
      }

      setProgress(20);
      setStatus("Request sent, waiting for processing...");

      // Check if we got a task ID (202 Accepted response)
      if (response.status === 202) {
        const data = await response.json();
        if (data.task_id) {
          // Poll for the actual result
          return await pollTaskResult(data.task_id);
        }
      }

      setProgress(100);
      setStatus("Complete!");
      const blob = await response.blob();
      console.log("Received blob:", blob.type, blob.size);
      return blob;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error("Operation cancelled");
      }
      throw err;
    } finally {
      abortControllerRef.current = null;
    }
  }, [pollTaskResult]);

  /**
   * Resize a blob to match target dimensions
   */
  const resizeBlob = useCallback(async (blob, targetWidth, targetHeight) => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        canvas.toBlob((resizedBlob) => {
          resolve(resizedBlob);
        }, 'image/png');
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image for resizing"));
      };
      
      img.src = url;
    });
  }, []);

  /**
   * Inpaint using current Fabric canvas state:
   * - exports image blob and mask blob
   * - calls /inpaint
   * - optionally applies to canvas
   */
  const inpaint = useCallback(
    async ({
      prompt,
      guidance_scale = 7.5,
      steps = 40,
      seed = -1,
      exportMultiplier = 1,
      useOriginalSize = true,
      apply = true,
      applyMode = "inpaint", // "inpaint" | "replace" | "newLayer"
      autoResizeMask = true,
    } = {}) => { 
      console.log("Inpaint called with:", { exportMultiplier, useOriginalSize, applyMode });
      
      if (!canvasActions?.exportAsPNGBlob) {
        throw new Error("useAiFeatures: canvasActions.exportAsPNGBlob is missing");
      }
      if (!canvasActions?.exportAsMaskBlob) {
        throw new Error("useAiFeatures: canvasActions.exportAsMaskBlob is missing");
      }

      setLoading(true);
      setError(null);
      setProgress(0);
      setStatus("Starting inpainting...");

      try {
        setProgress(5);
        setStatus("Exporting canvas image...");
        
        const imageBlob = await canvasActions.exportAsPNGBlob(exportMultiplier, useOriginalSize);
        
        setProgress(10);
        setStatus("Exporting mask...");
        
        let maskBlob = await canvasActions.exportAsMaskBlob(exportMultiplier, useOriginalSize);

        if (!imageBlob) throw new Error("Failed to export canvas image");
        if (!maskBlob) throw new Error("Failed to export canvas mask");

        setProgress(15);
        setStatus("Validating dimensions...");

        const imageSize = await getSize(imageBlob);
        const maskSize = await getSize(maskBlob);
        
        console.log("Canvas Image exported:", imageSize);
        console.log("Canvas Mask exported:", maskSize);
        
        // Check for dimension mismatch and resize if needed
        if (imageSize.width !== maskSize.width || imageSize.height !== maskSize.height) {
          console.error("DIMENSION MISMATCH!", { imageSize, maskSize });
          
          if (autoResizeMask) {
            setStatus("Resizing mask to match image dimensions...");
            maskBlob = await resizeBlob(maskBlob, imageSize.width, imageSize.height);
            
            const newMaskSize = await getSize(maskBlob);
            console.log("Mask resized to:", newMaskSize);
            
            if (newMaskSize.width !== imageSize.width || newMaskSize.height !== imageSize.height) {
              throw new Error("Failed to resize mask to match image dimensions");
            }
          } else {
            throw new Error(`Dimension mismatch: Image ${imageSize.width}x${imageSize.height}, Mask ${maskSize.width}x${maskSize.height}`);
          }
        } else {
          console.log("Dimensions match!");
        }

        setProgress(25);
        setStatus("Preparing AI request...");

        // Determine composite based on applyMode
        // "inpaint" mode = composite=true (keep original outside mask)
        // "replace" mode = composite=false (use AI everywhere)
        const composite = applyMode === "inpaint";
        
        console.log(`Setting composite=${composite} based on applyMode=${applyMode}`);

        const fd = createFormData(prompt, imageBlob, maskBlob, {
          guidance_scale,
          steps,
          seed,
          composite,
        });

        setProgress(30);
        setStatus("Sending to AI server...");
        
        const outBlob = await fetchBlob("/inpaint", fd);

        // Create preview URL
        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
        const url = URL.createObjectURL(outBlob);
        lastUrlRef.current = url;

        if (apply && canvasActions?.applyBlobResult) {
          setProgress(95);
          setStatus("Applying result to canvas...");
          await canvasActions.applyBlobResult(outBlob, { mode: applyMode });
        }

        setProgress(100);
        setStatus("Inpainting complete!");

        return { blob: outBlob, url };
      } catch (err) {
        const msg = err?.message || "Inpainting failed";
        setError(msg);
        setStatus(`Error: ${msg}`);
        console.error("Inpainting error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [canvasActions, createFormData, fetchBlob, resizeBlob]
  );

  /**
   * Outpaint using current Fabric canvas state:
   * - exports image blob
   * - calls /outpaint
   * - optionally applies to canvas
   */
  const outpaint = useCallback(
    async ({
      prompt,
      guidance_scale = 7.5,
      steps = 40,
      seed = -1,
      exportMultiplier = 1,
      useOriginalSize = true,
      left = 100,
      right = 100,
      top = 100,
      bottom = 100,
      apply = true,
      applyMode = "replace",
    } = {}) => {
      if (!canvasActions?.exportAsPNGBlob) {
        throw new Error("useAiFeatures: canvasActions.exportAsPNGBlob is missing");
      }

      setLoading(true);
      setError(null);
      setProgress(0);
      setStatus("Starting outpainting...");

    try {
      const response = await fetch(`${API_BASE_URL}/api/outpaint`, {
        method: "POST",
        body: createFormData(prompt, image, null, options),
      });

      if (!response.ok) {
        throw new Error("Outpainting failed.");
      }

  /**
   * Deblur an image
   */
  const deblur = useCallback(
    async ({
      image,
      prompt,
      strength = 0.35,
      guidance_scale = 4.0,
      steps = 40,
    } = {}) => {
      setLoading(true);
      setError(null);
      setProgress(0);
      setStatus("Starting deblur...");

      try {
        setProgress(20);
        setStatus("Preparing request...");

        const formData = new FormData();
        if (image) formData.append("image", image);
        if (prompt) formData.append("prompt", prompt);
        formData.append("strength", strength.toString());
        formData.append("guidance_scale", guidance_scale.toString());
        formData.append("steps", steps.toString());

        setProgress(30);
        setStatus("Sending to AI server...");

        const outBlob = await fetchBlob("/deblur", formData);
        
        const url = URL.createObjectURL(outBlob);

        setProgress(100);
        setStatus("Deblur complete!");

        return { blob: outBlob, url };
      } catch (err) {
        const msg = err?.message || "Deblur failed";
        setError(msg);
        setStatus(`Error: ${msg}`);
        console.error("Deblur error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchBlob]
  );

  /**
   * Describe an image
   */
  const describe = useCallback(async (image) => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setStatus("Analyzing image...");

    try {
      setProgress(30);
      
      const formData = new FormData();
      formData.append("image", image);

      const response = await fetch(`${API_BASE_URL}/describeme`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Description failed");
      }

      const data = await response.json();
      
      setProgress(100);
      setStatus("Analysis complete!");

      return data.description;
    } catch (err) {
      const msg = err?.message || "Description failed";
      setError(msg);
      setStatus(`Error: ${msg}`);
      console.error("Description error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Remove background from an image
   */
  const removeBackground = useCallback(async (image) => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setStatus("Removing background...");

    try {
      setProgress(20);
      setStatus("Preparing image...");
      
      const formData = new FormData();
      formData.append("image", image);

      setProgress(30);
      setStatus("Sending to AI server...");

      const response = await fetch(`${API_BASE_URL}/removebg`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Background removal failed.");
      }

      setProgress(80);
      setStatus("Processing result...");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      setProgress(100);
      setStatus("Background removed!");

      return url;
    } catch (err) {
      const msg = err?.message || "Background removal failed";
      setError(msg);
      setStatus(`Error: ${msg}`);
      console.error("Background removal error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Cancel current operation
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setStatus("Cancelled");
    setProgress(0);
  }, []);

  /**
   * Cleanup function to revoke object URLs
   */
  const cleanup = useCallback(() => {
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
    }
  }, []);

  /**
   * Reset error state
   */
  const resetError = useCallback(() => {
    setError(null);
    setStatus("");
  }, []);

  return { 
    // Core functions
    inpaint, 
    outpaint, 
    deblur,
    describe,
    removeBackground,
    
    // Utility functions
    downloadBlob,
    getSize,
    cancel,
    cleanup,
    resetError,
    
    // State
    loading, 
    error,
    progress,
    status,
  };
}
