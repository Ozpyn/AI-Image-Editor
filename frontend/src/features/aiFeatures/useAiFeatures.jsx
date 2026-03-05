import { useCallback, useEffect, useRef, useState } from "react";

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

  // Keep track of last preview URL to revoke it (avoid memory leaks)
  const lastUrlRef = useRef(null);
  useEffect(() => {
    return () => {
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    };
  }, []);

  const createFormData = useCallback(
    (
      prompt,
      imageBlob,
      maskBlob,
      { guidance_scale = 6.5, steps = 30, seed = -1 } = {}
    ) => {
      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("image", imageBlob, "image.png");
      if (maskBlob) formData.append("mask", maskBlob, "mask.png");
      formData.append("guidance_scale", String(guidance_scale));
      formData.append("steps", String(steps));
      formData.append("seed", String(seed));
      return formData;
    },
    []
  );

  const pollTaskResult = useCallback(
    async (taskId, maxWaitTime = 300000) => {
      // Poll every 5 seconds, max wait time 5 minutes
      const start = Date.now();
      while (Date.now() - start < maxWaitTime) {
        try {
          const res = await fetch(`${apiBase}/task/${taskId}`);
          
          if (res.status === 202) {
            // Still processing
            await new Promise((resolve) => setTimeout(resolve, 5000));
            continue;
          }
          
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || `Task failed: ${res.status}`);
          }
          
          return await res.blob();
        } catch (err) {
          throw new Error(`Poll error: ${err.message}`);
        }
      }
      throw new Error("Task polling timeout (5 minutes exceeded)");
    },
    [apiBase]
  );

  const fetchBlob = useCallback(
    async (endpoint, formData) => {
      const res = await fetch(`${apiBase}${endpoint}`, {
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
        const imageBlob = await canvasActions.exportAsPNGBlob(exportMultiplier);
        if (!imageBlob) throw new Error("Failed to export canvas image");

        const fd = createFormData(prompt, imageBlob, null, {
          guidance_scale,
          steps,
          seed,
        });

        const outBlob = await fetchBlob("/outpaint", fd);

        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
        const url = URL.createObjectURL(outBlob);
        lastUrlRef.current = url;

        if (apply && canvasActions?.applyBlobResult) {
          await canvasActions.applyBlobResult(outBlob, { mode: applyMode });
        }

        return { blob: outBlob, url };
      } catch (err) {
        const msg = err?.message || "Outpainting failed";
        setError(msg);
        console.error("Outpainting error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [canvasActions, createFormData, fetchBlob]
  );

  return {
    inpaintFromCanvas,
    outpaintFromCanvas,
    loading,
    error,
  };
  
}