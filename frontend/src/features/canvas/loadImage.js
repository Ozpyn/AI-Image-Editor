import { Image as FabricImage } from "fabric";

/**
 * Load an image from a File object and return a data URL
 */
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

/**
 * Create a Fabric Image object from a URL with better error handling
 * Works with blob: URLs, data: URLs, and http(s): URLs
 */
export function fabricImageFromURL(url, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error("No URL provided"));

    console.log("Loading fabric image from URL:", url.substring(0, 50) + "...");
    
    // For blob URLs, we need a different approach
    if (url.startsWith('blob:')) {
      console.log("Detected blob URL, using direct Image loading");
      
      // First, try to fetch the blob to check if it's valid
      fetch(url)
        .then(response => {
          console.log("Blob fetch response:", {
            status: response.status,
            ok: response.ok,
            type: response.headers.get('content-type')
          });
          return response.blob();
        })
        .then(blob => {
          console.log("Retrieved blob:", {
            type: blob.type,
            size: blob.size,
            sizeKB: (blob.size / 1024).toFixed(2) + "KB"
          });
          
          if (blob.size === 0) {
            throw new Error("Blob is empty");
          }
          
          if (!blob.type.startsWith('image/')) {
            console.warn("Blob is not an image:", blob.type);
            
            // Try to read as text to see if it's an error message
            const reader = new FileReader();
            reader.onload = () => {
              const text = reader.result;
              if (typeof text === 'string') {
                console.error("Blob content (might be error):", text.substring(0, 200));
              }
            };
            reader.readAsText(blob);
            
            throw new Error(`Blob is not an image: ${blob.type}`);
          }
          
          // Create a new blob URL from the fetched blob
          const newUrl = URL.createObjectURL(blob);
          console.log("Created new blob URL from fetched blob");
          
          // Now create test image with the new URL
          const testImg = new Image();
          testImg.crossOrigin = "anonymous";
          
          testImg.onload = () => {
            console.log("Blob image loaded successfully:", testImg.width, "x", testImg.height);
            URL.revokeObjectURL(newUrl);
            
            // Now create Fabric image from original URL
            FabricImage.fromURL(url, { 
              crossOrigin: "anonymous" 
            }).then((img) => {
              console.log("Fabric image created successfully from blob:", img.width, "x", img.height);
              img.set({ 
                selectable: true, 
                evented: true, 
                hasControls: true,
                hasBorders: true,
                ...opts 
              });
              resolve(img);
            }).catch((error) => {
              console.error("Fabric image creation from blob failed:", error);
              reject(new Error(`Failed to create fabric image from blob: ${error.message}`));
            });
          };
          
          testImg.onerror = (error) => {
            console.error("Blob image failed to load even after fetch:", error);
            URL.revokeObjectURL(newUrl);
            reject(new Error(`Failed to load blob image after fetch: ${url.substring(0, 50)}...`));
          };
          
          testImg.src = newUrl;
        })
        .catch(error => {
          console.error("Failed to fetch blob:", error);
          reject(new Error(`Failed to fetch blob: ${error.message}`));
        });
        
    } else {
      // For non-blob URLs
      const testImg = new Image();
      testImg.crossOrigin = "anonymous";
      
      testImg.onload = () => {
        console.log("Test image loaded successfully:", testImg.width, "x", testImg.height);
        
        FabricImage.fromURL(url, { 
          crossOrigin: "anonymous" 
        }).then((img) => {
          console.log("Fabric image created successfully:", img.width, "x", img.height);
          img.set({ 
            selectable: true, 
            evented: true, 
            hasControls: true,
            hasBorders: true,
            ...opts 
          });
          resolve(img);
        }).catch((error) => {
          console.error("Fabric image creation failed:", error);
          reject(new Error(`Failed to create fabric image: ${error.message}`));
        });
      };
      
      testImg.onerror = (error) => {
        console.error("Test image failed to load:", error);
        reject(new Error(`Failed to load image from URL: ${url.substring(0, 50)}...`));
      };
      
      testImg.src = url;
    }
  });
}

/**
 * Convert a Blob to a Data URL
 */
export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) {
      return reject(new Error("No blob provided"));
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      console.log("Blob converted to data URL successfully");
      resolve(reader.result);
    };
    reader.onerror = (error) => {
      console.error("Failed to convert blob to data URL:", error);
      reject(new Error("Failed to convert blob to data URL"));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Validate that a blob is a valid image and get its dimensions
 */
export function validateImageBlob(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) {
      return reject(new Error("No blob provided"));
    }
    
    console.log("Validating image blob:", {
      type: blob.type,
      size: blob.size,
      sizeKB: (blob.size / 1024).toFixed(2) + "KB"
    });
    
    if (!blob.type?.startsWith("image/")) {
      return reject(new Error(`Blob is not an image: ${blob.type}`));
    }
    
    if (blob.size === 0) {
      return reject(new Error("Blob is empty"));
    }
    
    // Try to read the first few bytes to check PNG header
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      const uint8Array = new Uint8Array(arrayBuffer.slice(0, 8));
      
      // Check PNG header: 89 50 4E 47 0D 0A 1A 0A
      const isPNG = uint8Array[0] === 0x89 && 
                    uint8Array[1] === 0x50 && 
                    uint8Array[2] === 0x4E && 
                    uint8Array[3] === 0x47;
      
      console.log("PNG header check:", isPNG ? "Valid PNG" : "Not a PNG", uint8Array);
      
      const url = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        console.log("Image blob validation passed:", {
          width: img.width,
          height: img.height,
          aspectRatio: (img.width / img.height).toFixed(2)
        });
        resolve({
          valid: true,
          width: img.width,
          height: img.height,
          type: blob.type,
          size: blob.size
        });
      };
      
      img.onerror = (error) => {
        URL.revokeObjectURL(url);
        console.error("Image blob validation failed:", error);
        reject(new Error("Blob is not a valid image"));
      };
      
      img.src = url;
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read blob header"));
    };
    
    reader.readAsArrayBuffer(blob.slice(0, 8));
  });
}

/**
 * Load an image from a blob and return a Fabric Image object
 */
export async function fabricImageFromBlob(blob, opts = {}) {
  try {
    console.log("Creating fabric image from blob");
    
    // Validate the blob first
    const validation = await validateImageBlob(blob);
    console.log("Blob validation passed:", validation);
    
    // For problematic blobs, convert to data URL first
    const dataUrl = await blobToDataURL(blob);
    console.log("Converted blob to data URL");
    
    // Create fabric image from data URL (more reliable)
    return await fabricImageFromURL(dataUrl, opts);
    
  } catch (error) {
    console.error("Failed to create fabric image from blob:", error);
    throw error;
  }
}

/**
 * Load an image from a File object and return a Fabric Image object
 */
export async function fabricImageFromFile(file, opts = {}) {
  try {
    console.log("Creating fabric image from file:", file.name);
    
    // Load file to data URL
    const dataUrl = await loadImageFromFile(file);
    
    // Create fabric image from data URL
    return await fabricImageFromURL(dataUrl, opts);
    
  } catch (error) {
    console.error("Failed to create fabric image from file:", error);
    throw error;
  }
}

/**
 * Get dimensions of an image from a blob without loading it into Fabric
 */
export function getImageDimensionsFromBlob(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) {
      return reject(new Error("No blob provided"));
    }
    
    const url = URL.createObjectURL(blob);
    const img = new Image();
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for dimension measurement"));
    };
    
    img.src = url;
  });
}

export default {
  loadImageFromFile,
  fabricImageFromURL,
  blobToDataURL,
  validateImageBlob,
  fabricImageFromBlob,
  fabricImageFromFile,
  getImageDimensionsFromBlob
};