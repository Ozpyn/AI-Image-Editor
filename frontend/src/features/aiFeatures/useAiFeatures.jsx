import { useState, useCallback, useRef } from "react";

// Make sure this points to your backend server
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function useAiFeatures({
  apiBase = API_BASE_URL, // Use the constant, not window.location
  canvasActions,
} = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastUrlRef = useRef(null);

  // Helper function to poll for task results
  const pollTaskResult = useCallback(async (taskId) => {
    const maxAttempts = 30;
    const interval = 2000; // 2 seconds
    
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(`${API_BASE_URL}/task/${taskId}`);
      
      if (response.status === 200) {
        return await response.blob();
      }
      
      if (response.status !== 202) {
        throw new Error("Task failed");
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error("Task timeout");
  }, []);

  // Helper: creates formData for both inpainting and outpainting
  const createFormData = useCallback((prompt, image, mask, { guidance_scale = 6.5, steps = 30, seed = -1 }) => {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("image", image);
    if (mask) formData.append("mask", mask);
    formData.append("guidance_scale", guidance_scale);
    formData.append("steps", steps);
    formData.append("seed", seed);
    return formData;
  }, []);

  // Helper function to fetch blob with task polling support
  const fetchBlob = useCallback(async (endpoint, formData) => {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log("Fetching from:", url);
    
    const response = await fetch(url, {
      method: "POST",
      body: formData,
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

    // Check if we got a task ID (202 Accepted response)
    if (response.status === 202) {
      const data = await response.json();
      if (data.task_id) {
        // Poll for the actual result
        return await pollTaskResult(data.task_id);
      }
    }

    const blob = await response.blob();
    console.log("Received blob:", blob.type, blob.size);
    return blob;
  }, [pollTaskResult]);

  /**
   * Inpaint using current Fabric canvas state
   */
  const inpaint = useCallback(
    async ({
      prompt,
      guidance_scale,
      steps,
      seed,
      exportMultiplier = 1,
      useOriginalSize = true,
      apply = true,
      applyMode = "replace",
    } = {}) => { 
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

        // Get dimensions
        const imageSize = await getSize(imageBlob);
        const maskSize = await getSize(maskBlob);
        
        console.log("Canvas Image exported:", imageSize);
        console.log("Canvas Mask exported:", maskSize);
        
        if (imageSize.width !== maskSize.width || imageSize.height !== maskSize.height) {
          console.error("DIMENSION MISMATCH!", { imageSize, maskSize });
          // You might want to resize the mask here to match the image
        }

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
   * Outpaint using current Fabric canvas state
   */
  const outpaint = useCallback(
    async ({
      prompt,
      guidance_scale,
      steps,
      seed,
      exportMultiplier = 2,
      apply = true,
      applyMode = "replace",
    } = {}) => {
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

  // AI Action: Background Removal
  const removeBackground = useCallback(async (image) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", image);

      const response = await fetch(`${API_BASE_URL}/removebg`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Background removal failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      return url;
    } catch (err) {
      setError(err.message);
      console.error("Background removal error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Cleanup function to revoke object URLs
  const cleanup = useCallback(() => {
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
    }
  }, []);

  // Helper function to get image dimensions
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

  return { 
    inpaint, 
    outpaint, 
    removeBackground, 
    loading, 
    error,
    cleanup 
  };
}