/**
 * @module utils/file-storage
 * @description IndexedDB-based persistent file storage for uploaded GLB models
 * Supports up to 100MB of model storage
 */

/** @type {number} Maximum storage size in bytes (100MB) */
const MAX_STORAGE_SIZE = 100 * 1024 * 1024;

/** @type {string} IndexedDB database name */
const DB_NAME = 'GLBStorage';

/** @type {number} Database version */
const DB_VERSION = 2;

/**
 * Open IndexedDB database for GLB storage
 * @returns {Promise<IDBDatabase>} Database instance
 */
export function openGLBDatabase() {
  return new Promise((resolve, reject) => {
    console.log('[FileStorage] Opening IndexedDB database...');
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[FileStorage] Failed to open database:', request.error);
      reject(new Error('Failed to open database'));
    };
    
    request.onsuccess = () => {
      console.log('[FileStorage] Database opened successfully');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      console.log('[FileStorage] Database upgrade needed, creating stores...');
      const db = event.target.result;
      
      // Delete old store if exists (for upgrade from v1)
      if (db.objectStoreNames.contains('uploadedGLBs')) {
        db.deleteObjectStore('uploadedGLBs');
      }
      
      // Create new store with file data
      if (!db.objectStoreNames.contains('uploadedGLBs')) {
        const store = db.createObjectStore('uploadedGLBs', { keyPath: 'name' });
        store.createIndex('path', 'path', { unique: false });
        store.createIndex('uploadTime', 'uploadTime', { unique: false });
        store.createIndex('size', 'size', { unique: false });
        console.log('[FileStorage] Created uploadedGLBs store');
      }
    };
  });
}

/**
 * Calculate total storage used
 * @returns {Promise<number>} Total bytes used
 */
export async function getStorageUsage() {
  try {
    const glbs = await getUploadedGLBs();
    const totalSize = glbs.reduce((sum, glb) => sum + (glb.size || 0), 0);
    console.log(`[FileStorage] Storage usage: ${(totalSize / 1024 / 1024).toFixed(2)}MB / ${(MAX_STORAGE_SIZE / 1024 / 1024).toFixed(0)}MB`);
    return totalSize;
  } catch (error) {
    console.error('[FileStorage] Error calculating storage usage:', error);
    return 0;
  }
}

/**
 * Check if adding a file would exceed storage limit
 * @param {number} fileSize - Size of file to add in bytes
 * @returns {Promise<boolean>} True if there's room
 */
export async function hasStorageSpace(fileSize) {
  const currentUsage = await getStorageUsage();
  const wouldExceed = (currentUsage + fileSize) > MAX_STORAGE_SIZE;
  
  if (wouldExceed) {
    console.warn(`[FileStorage] Storage limit would be exceeded: ${((currentUsage + fileSize) / 1024 / 1024).toFixed(2)}MB > ${(MAX_STORAGE_SIZE / 1024 / 1024).toFixed(0)}MB`);
  }
  
  return !wouldExceed;
}

/**
 * Save uploaded GLB to IndexedDB with file data
 * @param {File} file - GLB File object
 * @returns {Promise<Object>} Saved file info with blob URL
 */
export async function saveUploadedGLB(file) {
  console.log(`[FileStorage] Saving uploaded GLB: ${file.name} (${(file.size / 1024).toFixed(2)}KB)`);
  
  // Check storage space
  const hasSpace = await hasStorageSpace(file.size);
  if (!hasSpace) {
    throw new Error(`Storage limit exceeded. Maximum: ${(MAX_STORAGE_SIZE / 1024 / 1024).toFixed(0)}MB`);
  }
  
  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  
  // Create blob and URL for immediate use
  const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  const blobUrl = URL.createObjectURL(blob);
  
  const db = await openGLBDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['uploadedGLBs'], 'readwrite');
    const store = transaction.objectStore('uploadedGLBs');

    const data = {
      name: file.name,
      path: `uploaded/${file.name}`,
      uploadTime: Date.now(),
      size: file.size,
      data: arrayBuffer, // Store the actual file data
      blobUrl: blobUrl    // Store the blob URL for quick access
    };

    const request = store.put(data); // Use put instead of add to allow updates
    
    request.onsuccess = () => {
      console.log(`[FileStorage] Saved ${file.name} successfully`);
      resolve({
        name: file.name,
        path: data.path,
        blobUrl: blobUrl,
        size: file.size
      });
    };
    
    request.onerror = () => {
      console.error('[FileStorage] Failed to save:', request.error);
      reject(new Error('Failed to save to IndexedDB'));
    };
  });
}

/**
 * Get all uploaded GLBs with their blob URLs
 * @returns {Promise<Array<Object>>} Array of uploaded GLB data
 */
export async function getUploadedGLBs() {
  try {
    console.log('[FileStorage] Retrieving all uploaded GLBs...');
    const db = await openGLBDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['uploadedGLBs'], 'readonly');
      const store = transaction.objectStore('uploadedGLBs');
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // Recreate blob URLs if needed
        const processed = results.map(glb => {
          if (glb.data && !glb.blobUrl) {
            // Recreate blob URL from stored data
            const blob = new Blob([glb.data], { type: 'model/gltf-binary' });
            glb.blobUrl = URL.createObjectURL(blob);
            console.log(`[FileStorage] Recreated blob URL for: ${glb.name}`);
          }
          return glb;
        });
        console.log(`[FileStorage] Retrieved ${processed.length} uploaded GLBs`);
        resolve(processed);
      };
      
      request.onerror = () => {
        console.error('[FileStorage] Failed to retrieve:', request.error);
        reject(new Error('Failed to get uploaded GLBs'));
      };
    });
  } catch (error) {
    console.warn('[FileStorage] Error retrieving GLBs:', error.message);
    return [];
  }
}

/**
 * Get a specific uploaded GLB by name
 * @param {string} name - GLB file name
 * @returns {Promise<Object|null>} GLB data or null if not found
 */
export async function getUploadedGLB(name) {
  try {
    console.log(`[FileStorage] Getting uploaded GLB: ${name}`);
    const db = await openGLBDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['uploadedGLBs'], 'readonly');
      const store = transaction.objectStore('uploadedGLBs');
      const request = store.get(name);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Recreate blob URL if needed
          if (result.data && !result.blobUrl) {
            const blob = new Blob([result.data], { type: 'model/gltf-binary' });
            result.blobUrl = URL.createObjectURL(blob);
            console.log(`[FileStorage] Recreated blob URL for: ${name}`);
          }
          console.log(`[FileStorage] Found ${name}: ${(result.size / 1024).toFixed(2)}KB`);
          resolve(result);
        } else {
          console.log(`[FileStorage] ${name} not found in storage`);
          resolve(null);
        }
      };
      
      request.onerror = () => {
        console.error(`[FileStorage] Failed to get ${name}:`, request.error);
        reject(new Error(`Failed to get ${name}`));
      };
    });
  } catch (error) {
    console.error('[FileStorage] Error getting GLB:', error);
    return null;
  }
}

/**
 * Delete uploaded GLB
 * @param {string} name - GLB file name
 * @returns {Promise<void>}
 */
export async function deleteUploadedGLB(name) {
  console.log(`[FileStorage] Deleting uploaded GLB: ${name}`);
  
  // Get the file first to revoke blob URL
  const glb = await getUploadedGLB(name);
  if (glb && glb.blobUrl) {
    URL.revokeObjectURL(glb.blobUrl);
    console.log(`[FileStorage] Revoked blob URL for: ${name}`);
  }
  
  const db = await openGLBDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['uploadedGLBs'], 'readwrite');
    const store = transaction.objectStore('uploadedGLBs');
    const request = store.delete(name);
    
    request.onsuccess = () => {
      console.log(`[FileStorage] Deleted ${name} successfully`);
      resolve();
    };
    
    request.onerror = () => {
      console.error(`[FileStorage] Failed to delete ${name}:`, request.error);
      reject(new Error('Failed to delete'));
    };
  });
}

/**
 * Clear all uploaded GLBs
 * @returns {Promise<void>}
 */
export async function clearAllUploadedGLBs() {
  console.log('[FileStorage] Clearing all uploaded GLBs...');
  const glbs = await getUploadedGLBs();
  
  // Revoke all blob URLs
  glbs.forEach(glb => {
    if (glb.blobUrl) {
      URL.revokeObjectURL(glb.blobUrl);
    }
  });
  
  const db = await openGLBDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['uploadedGLBs'], 'readwrite');
    const store = transaction.objectStore('uploadedGLBs');
    const request = store.clear();
    
    request.onsuccess = () => {
      console.log('[FileStorage] Cleared all uploaded GLBs');
      resolve();
    };
    
    request.onerror = () => {
      console.error('[FileStorage] Failed to clear:', request.error);
      reject(new Error('Failed to clear'));
    };
  });
}

/**
 * Get blob URL for a GLB (creates if doesn't exist)
 * @param {string} name - GLB file name
 * @returns {Promise<string|null>} Blob URL or null
 */
export async function getGLBBlobUrl(name) {
  const glb = await getUploadedGLB(name);
  return glb ? glb.blobUrl : null;
}

export default {
  openGLBDatabase,
  saveUploadedGLB,
  getUploadedGLBs,
  getUploadedGLB,
  getGLBBlobUrl,
  deleteUploadedGLB,
  clearAllUploadedGLBs,
  getStorageUsage,
  hasStorageSpace
};
