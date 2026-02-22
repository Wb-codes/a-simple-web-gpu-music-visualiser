/**
 * @module audio/capture
 * @description Audio capture and analysis for both browser and Electron modes.
 * Handles device enumeration, audio source selection, and frequency analysis.
 */

import { audioBass, audioMid, audioHigh, audioOverall, updateAudioUniforms } from './uniforms.js';
import { showAudioSourceSelector as showAudioSelector, setAudioConnecting, setAudioActive, setAudioError, setAudioSelectScreen } from '../gui/audio-selector.js';

/** @type {AudioContext|null} */
let audioContext = null;

/** @type {AnalyserNode|null} */
let analyser = null;

/** @type {Uint8Array|null} */
let dataArray = null;

/** @type {Array<{id: string, name: string, thumbnail: string}>} */
let audioSources = [];

/** @type {{id: string, name: string, thumbnail: string}|null} */
let selectedAudioSource = null;

/**
 * Check if audio is currently active.
 * @returns {boolean}
 */
export function isAudioActive() {
    return analyser !== null && dataArray !== null;
}

/**
 * Get available audio sources (Electron mode).
 * @returns {Array<{id: string, name: string, thumbnail: string}>}
 */
export function getAudioSources() {
    return audioSources;
}

/**
 * Get the currently selected audio source.
 * @returns {{id: string, name: string, thumbnail: string}|null}
 */
export function getSelectedAudioSource() {
    return selectedAudioSource;
}

/**
 * Initialize audio capture.
 * Shows device selector in browser, source selector in Electron.
 * @returns {Promise<boolean>} True if audio initialized successfully
 */
export async function initAudio() {
    try {
        if (window.isElectron && window.electronAPI) {
            return initElectronAudio();
        } else {
            return initBrowserAudio();
        }
    } catch (err) {
        console.error('Audio error:', err);
        handleAudioError(err);
        return false;
    }
}

/**
 * Initialize audio in Electron mode with source selector.
 * @param {HTMLElement} statusEl - Status display element
 * @returns {Promise<boolean>}
 */
async function initElectronAudio() {
    const sources = await window.electronAPI.getAudioSources();
    audioSources = sources.filter(s => s.name && !s.name.includes('Music Visualizer'));
    
    if (audioSources.length === 0) {
        setAudioError('No sources found');
        return false;
    }
    
    showAudioSourceSelector();
    return true;
}

/**
 * Initialize audio in browser mode with screen share.
 * @param {HTMLElement} statusEl - Status display element
 * @returns {Promise<boolean>}
 */
async function initBrowserAudio() {
    setAudioSelectScreen();
    
    const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
    });
    
    const audioTrack = stream.getAudioTracks()[0];
    stream.getVideoTracks().forEach(t => t.stop());
    
    if (!audioTrack) {
        setAudioError('No audio - check "Share audio" when sharing');
        stream.getTracks().forEach(t => t.stop());
        return false;
    }
    
    const success = setupAudioContext(audioTrack);
    
    if (success) {
        setAudioActive('Active');
    }
    
    return success;
}

/**
 * Setup audio context and analyser for a given audio track.
 * @param {MediaStreamTrack} audioTrack - The audio track to analyze
 * @returns {boolean} True if setup successful
 */
function setupAudioContext(audioTrack) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    
    const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    return true;
}

/**
 * Show audio source selector UI (Electron mode).
 */
function showAudioSourceSelector() {
    showAudioSelector(audioSources, (source) => {
        selectAudioSource(source);
    });
}

/**
 * Select and connect to an audio source (Electron mode).
 * @param {{id: string, name: string, thumbnail: string}} source - The audio source to connect to
 * @returns {Promise<boolean>}
 */
export async function selectAudioSource(source) {
    const selector = document.getElementById('audio-selector');
    if (selector) selector.remove();
    
    setAudioConnecting();
    
    try {
        let audioTrack = null;
        
        if (window.electronAPI) {
            const constraints = {
                audio: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: source.id
                    }
                },
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: source.id,
                        maxWidth: 1,
                        maxHeight: 1
                    }
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            audioTrack = stream.getAudioTracks()[0];
            stream.getVideoTracks().forEach(t => t.stop());
        } else {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            audioTrack = stream.getAudioTracks()[0];
            stream.getVideoTracks().forEach(t => t.stop());
        }
        
        if (!audioTrack) {
            setAudioError('No audio track');
            return false;
        }
        
        setupAudioContext(audioTrack);
        
        selectedAudioSource = source;
        setAudioActive(source.name);
        
        return true;
    } catch (err) {
        console.error('Audio connection error:', err);
        statusEl.textContent = 'Audio: ' + err.message;
        statusEl.className = 'error';
        return false;
    }
}

/**
 * Analyze audio and update audio uniforms.
 * @param {Object} settings - Settings object with sensitivity values
 * @returns {{bass: number, mid: number, high: number, overall: number}} Audio levels
 */
export function analyzeAudio(settings) {
    if (!analyser || !dataArray) {
        return { bass: 0, mid: 0, high: 0, overall: 0 };
    }
    
    analyser.getByteFrequencyData(dataArray);
    const len = dataArray.length;
    
    // Calculate frequency band boundaries
    const bassEnd = Math.floor(len * 0.08);  // ~8% of spectrum
    const midEnd = Math.floor(len * 0.4);    // ~40% of spectrum
    
    // Sum frequency bands
    let bassSum = 0, midSum = 0, highSum = 0;
    for (let i = 0; i < len; i++) {
        const val = dataArray[i] / 255;
        if (i < bassEnd) bassSum += val;
        else if (i < midEnd) midSum += val;
        else highSum += val;
    }
    
    // Normalize to 0-1 range
    const bassNorm = bassSum / bassEnd;
    const midNorm = midSum / (midEnd - bassEnd);
    const highNorm = highSum / (len - midEnd);
    
    // Apply sensitivity and clamp to 0-1
    const bass = Math.min(bassNorm * settings.bassSensitivity.value, 1);
    const mid = Math.min(midNorm * settings.midSensitivity.value, 1);
    const high = Math.min(highNorm * settings.highSensitivity.value, 1);
    const overall = (bass + mid + high) / 3;
    
    // Update uniforms
    updateAudioUniforms({ bass, mid, high, overall });
    
    return { bass, mid, high, overall };
}

/**
 * Handle audio errors and update status display.
 * @param {Error} err - The error that occurred
 */
function handleAudioError(err) {
    console.error('Audio error:', err);
    if (err.name === 'NotAllowedError') {
        setAudioError('Cancelled - click a scene to retry');
    } else {
        setAudioError(err.message);
    }
}

/**
 * Close audio context and cleanup.
 */
export function closeAudio() {
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    analyser = null;
    dataArray = null;
    selectedAudioSource = null;
}

/**
 * Get the audio context for external use.
 * @returns {AudioContext|null}
 */
export function getAudioContext() {
    return audioContext;
}

/**
 * Get the analyser node for external use.
 * @returns {AnalyserNode|null}
 */
export function getAnalyser() {
    return analyser;
}
