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
  apiBase = `${window.location.origin}/api`,
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
      });

      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {
          /* ignore */
        }
        throw new Error(detail || `Request failed: ${res.status}`);
      }

      // Check if we got a task ID (202 Accepted response)
      if (res.status === 202) {
        const data = await res.json();
        if (data.task_id) {
          // Poll for the actual result
          return await pollTaskResult(data.task_id);
        }
      }

      return await res.blob();
    },
    [apiBase, pollTaskResult]
  );

  /**
   * Inpaint using current Fabric canvas state:
   * - exports image blob and mask blob
   * - calls /inpaint
   * - optionally applies to canvas
   */
  const inpaintFromCanvas = useCallback(
    async (
      {
        prompt,
        guidance_scale,
        steps,
        seed,
        exportMultiplier = 1,
        useOriginalSize = true, // Default to original image size
        apply = true,
        applyMode = "replace", // "replace" | "newLayer"
      } = {}
    ) => { 
      console.log("Inpaint called with:", { exportMultiplier, useOriginalSize });
      
      if (!canvasActions?.exportAsPNGBlob) {
        throw new Error("useAiFeatures: canvasActions.exportAsPNGBlob is missing");
      }
      if (!canvasActions?.exportAsMaskBlob) {
        throw new Error("useAiFeatures: canvasActions.exportAsMaskBlob is missing");
      }

      setLoading(true);
      setError(null);

      try {
        
        const imageBlob = await canvasActions.exportAsPNGBlob(exportMultiplier, useOriginalSize);
        const maskBlob = await canvasActions.exportAsMaskBlob(exportMultiplier, useOriginalSize);

        if (!imageBlob) throw new Error("Failed to export canvas image");
        if (!maskBlob) throw new Error("Failed to export canvas mask");

        //lets print the size to avoid mismatch with SDXL
        const imageSize = await getSize(imageBlob);
        const maskSize = await getSize(maskBlob);
        
        console.log("Canvas Image exported:", imageSize);
        console.log("Canvas Mask exported:", maskSize);
        
        if (imageSize.width !== maskSize.width || imageSize.height !== maskSize.height) {
          console.error("DIMENSION MISMATCH!", { imageSize, maskSize });
        } else {
          console.log("Dimensions match!");
        }

        // // Save mask and image locally for testing purposes only (Uncomment to use)
        // const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
        // downloadBlob(imageBlob, `test-image-${timestamp}.png`);
        // downloadBlob(maskBlob, `test-mask-${timestamp}.png`);
        // console.log("Test files saved locally:", { timestamp });

        const fd = createFormData(prompt, imageBlob, maskBlob, {
          guidance_scale,
          steps,
          seed,
        });

        const outBlob = await fetchBlob("/inpaint", fd);

        // preview url
        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
        const url = URL.createObjectURL(outBlob);
        lastUrlRef.current = url;

        if (apply && canvasActions?.applyBlobResult) {
          await canvasActions.applyBlobResult(outBlob, { mode: applyMode });
        }

        return { blob: outBlob, url };
      } catch (err) {
        const msg = err?.message || "Inpainting failed";
        setError(msg);
        console.error("Inpainting error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [canvasActions, createFormData, fetchBlob]
  );

  /**
   * Outpaint using current Fabric canvas state:
   * - exports image blob (mask not required)
   * - calls /outpaint
   * - optionally applies to canvas
   */
  const outpaintFromCanvas = useCallback(
    async (
      {
        prompt,
        guidance_scale,
        steps,
        seed,
        exportMultiplier = 2,
        apply = true,
        applyMode = "replace",
      } = {}
    ) => {
      if (!canvasActions?.exportAsPNGBlob) {
        throw new Error("useAiFeatures: canvasActions.exportAsPNGBlob is missing");
      }

      setLoading(true);
      setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/outpaint`, {
        method: "POST",
        body: createFormData(prompt, image, null, options),
      });

      if (!response.ok) {
        throw new Error("Outpainting failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      return url; // Returns the outpainted image URL
    } catch (err) {
      setError(err.message);
      console.error("Outpainting error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper: creates formData for both inpainting and outpainting
  const createFormData = (prompt, image, mask, { guidance_scale = 6.5, steps = 30, seed = -1 }) => {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("image", image);
    if (mask) formData.append("mask", mask);
    formData.append("guidance_scale", guidance_scale);
    formData.append("steps", steps);
    formData.append("seed", seed);
    return formData;
  };

  // AI Action: Background Removal
  const removeBackground = async (image) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", image);

      const response = await fetch(`${API_BASE_URL}/api/removebg`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Background removal failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      return url; // Returns the image URL with background removed

    } catch (err) {
      setError(err.message);
      console.error("Background removal error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { inpaint, outpaint, removeBackground, loading, error };
}


