/**
 * @module audio/reactive
 * @description Audio-reactive calculation utilities.
 * Provides standardized 4-slider audio-reactivity calculations.
 */

/**
 * Smooth audio value using exponential moving average
 * @param {number} current - Current audio value
 * @param {number} previous - Previous smoothed value
 * @param {number} factor - Smoothing factor (0.1 = slow, 0.5 = fast)
 * @returns {number} Smoothed value
 */
export function smoothAudioValue(current, previous, factor = 0.1) {
  return previous + (current - previous) * factor;
}

/**
 * Calculate audio-reactive magnitude using 4-slider structure
 * @param {Object} config - Configuration object
 * @param {number} config.intensity - Base intensity (0-100)
 * @param {number} config.bass - Bass sensitivity (0-100)
 * @param {number} config.mid - Mid sensitivity (0-100)
 * @param {number} config.high - High sensitivity (0-100)
 * @param {Object} audio - Audio data
 * @param {number} audio.bass - Bass value (0-1)
 * @param {number} audio.mid - Mid value (0-1)
 * @param {number} audio.high - High value (0-1)
 * @returns {number} Final magnitude (0-1 normalized)
 */
export function calculateAudioMagnitude(config, audio) {
  const baseMagnitude = config.intensity / 100;
  
  const bassContribution = audio.bass * (config.bass / 100);
  const midContribution = audio.mid * (config.mid / 100);
  const highContribution = audio.high * (config.high / 100);
  
  const totalContribution = bassContribution + midContribution + highContribution;
  
  // Apply intensity as a multiplier to the total effect
  return baseMagnitude * (1 + totalContribution);
}

/**
 * Create smoothed audio tracking for a parameter
 * @returns {Object} Smoothed audio tracker
 */
export function createSmoothedAudioTracker(smoothingFactor = 0.1) {
  let smoothedBass = 0;
  let smoothedMid = 0;
  let smoothedHigh = 0;
  
  return {
    /**
     * Update with new audio values
     * @param {Object} audio - Raw audio data
     * @returns {Object} Smoothed audio values
     */
    update(audio) {
      smoothedBass = smoothAudioValue(audio.bass, smoothedBass, smoothingFactor);
      smoothedMid = smoothAudioValue(audio.mid, smoothedMid, smoothingFactor);
      smoothedHigh = smoothAudioValue(audio.high, smoothedHigh, smoothingFactor);
      
      return {
        bass: smoothedBass,
        mid: smoothedMid,
        high: smoothedHigh
      };
    },
    
    /**
     * Get current smoothed values
     * @returns {Object} Smoothed audio values
     */
    getValues() {
      return {
        bass: smoothedBass,
        mid: smoothedMid,
        high: smoothedHigh
      };
    },
    
    /**
     * Reset to zero
     */
    reset() {
      smoothedBass = 0;
      smoothedMid = 0;
      smoothedHigh = 0;
    }
  };
}
