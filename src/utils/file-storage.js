/**
 * @module utils/file-storage
 * @description IndexedDB-based virtual file storage for uploaded GLB models
 */

/**
 * Open IndexedDB database for GLB storage
 * @returns {Promise<IDBDatabase>} Database instance
 */
export function openGLBDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GLBStorage', 1);
    
    request.onerror = () => reject(new Error('Failed to open database'));
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('uploadedGLBs')) {
        const store = db.createObjectStore('uploadedGLBs', { keyPath: 'name' });
        store.createIndex('path', 'path', { unique: false });
        store.createIndex('uploadTime', 'uploadTime', { unique: false });
      }
    };
  });
}

/**
 * Save uploaded GLB to IndexedDB
 * @param {File} file - GLB File object  
 * @returns {Promise<Object>} Saved file info
 */
export async function saveUploadedGLB(file) {
  const db = await openGLBDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['uploadedGLBs'], 'readwrite');
    const store = transaction.objectStore('uploadedGLBs');
    
    const data = {
      name: file.name,
      path: `uploaded/${file.name}`,
      uploadTime: Date.now(),
      size: file.size
    };
    
    const request = store.add(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(new Error('Failed to save'));
  });
}

/**
 * Get all uploaded GLBs
 * @returns {Promise<Array<Object>>} Array of uploaded GLB data
 */
export async function getUploadedGLBs() {
  try {
    const db = await openGLBDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['uploadedGLBs'], 'readonly');
      const store = transaction.objectStore('uploadedGLBs');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get uploaded GLBs'));
    });
  } catch (error) {
    console.log('[FileStorage] No uploaded GLBs yet');
    return [];
  }
}

/**
 * Delete uploaded GLB
 * @param {string} name - GLB file name
 * @returns {Promise<void>}
 */
export async function deleteUploadedGLB(name) {
  const db = await openGLBDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['uploadedGLBs'], 'readwrite');
    const store = transaction.objectStore('uploadedGLBs');
    const request = store.delete(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete'));
  });
}

export default {
  openGLBDatabase,
  saveUploadedGLB,
  getUploadedGLBs,
  deleteUploadedGLB
};
