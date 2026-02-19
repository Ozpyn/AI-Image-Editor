import { Image as FabricImage } from "fabric";

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file provided"));
    if (!file.type?.startsWith("image/")) return reject(new Error("File is not an image"));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export function fabricImageFromURL(url, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error("No URL provided"));

    FabricImage.fromURL(url, { crossOrigin: "anonymous" })
      .then((img) => {
        img.set({ selectable: true, evented: true, ...opts });
        resolve(img);
      })
      .catch(() => reject(new Error("Failed to create fabric image")));
  });
}
