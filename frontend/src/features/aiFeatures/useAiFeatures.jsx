import { useState } from "react";

// For managing loading, errors, etc.
export function useAiFeatures() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // AI Action: Inpainting (remove objects)
  const inpaint = async (prompt, image, mask, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://VIPER_IP:8000/inpaint", {
        method: "POST",
        body: createFormData(prompt, image, mask, options),
      });

      if (!response.ok) {
        throw new Error("Inpainting failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      return url; // Returns the image URL after inpainting
    } catch (err) {
      setError(err.message);
      console.error("Inpainting error:", err);
    } finally {
      setLoading(false);
    }
  };

  // AI Action: Outpainting (expand canvas)
  const outpaint = async (prompt, image, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://VIPER_IP:8000/outpaint", {
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

  return { inpaint, outpaint, loading, error };
}
