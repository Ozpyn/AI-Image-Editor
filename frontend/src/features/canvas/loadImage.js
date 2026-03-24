import { FabricImage } from "fabric";

/**
 * Reads a file as a DataURL (base64).
 */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/**
 * Loads a DataURL into an HTMLImageElement.
 */
function loadHtmlImage(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = dataURL;
  });
}

/**
 * Normalize an image by drawing it to a canvas.
 * - Bakes in EXIF orientation as the browser renders it
 * - Stabilizes pixel dimensions (prevents Fabric cutout/white edges)
 * - Optional downscale to avoid huge images causing weird behavior
 */
function normalizeToDataURL(htmlImg, {
  maxDim = 5000,          // avoid extremely huge images
  outputType = "image/png",
  quality = 0.92,
} = {}) {
  const srcW = htmlImg.naturalWidth || htmlImg.width;
  const srcH = htmlImg.naturalHeight || htmlImg.height;

  if (!srcW || !srcH) throw new Error("Invalid image dimensions");

  // Downscale only if needed
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(htmlImg, 0, 0, w, h);

  return canvas.toDataURL(outputType, quality);
}

/**
 * Public API: file -> normalized DataURL
 */
export async function loadImageFromFile(file, { normalize = false } = {}) {
  if (!file) throw new Error("No file provided");
  if (!file.type?.startsWith("image/")) throw new Error("File is not an image");

  if (!normalize) {
    return URL.createObjectURL(file);
  }

  const raw = await readFileAsDataURL(file);
  const htmlImg = await loadHtmlImage(raw);

  // Normalize to PNG to keep alpha if present (and stable pixels)
  return normalizeToDataURL(htmlImg, {
    maxDim: 5000,
    outputType: "image/png",
    quality: 0.92,
  });
}

/**
 * Public API: URL/DataURL -> FabricImage
 * - Only sets crossOrigin for http(s) urls (not for data:)
 */
export function fabricImageFromURL(url, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error("No URL provided"));

    const isHttp = /^https?:\/\//i.test(url);
    const isBlob = /^blob:/i.test(url);
    const options = isHttp ? { crossOrigin: "anonymous" } : {};

    FabricImage.fromURL(url, options)
      .then((img) => {
        img.set({ selectable: true, evented: true, ...opts });
        if (isBlob) URL.revokeObjectURL(url);
        resolve(img);
      })
      .catch(() => {
        if (isBlob) URL.revokeObjectURL(url);
        reject(new Error("Failed to create fabric image"));
      });
  });
}
