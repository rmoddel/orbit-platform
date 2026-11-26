/**
 * Geolocation Service
 *
 * Handles browser geolocation with timeout, error handling,
 * and privacy-respecting fallbacks.
 */

import { getActiveCampaign } from '../config.js';

/** Default geolocation timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 10000;

/** Geolocation accuracy options */
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false, // Use low accuracy - we only need approximate location
  timeout: DEFAULT_TIMEOUT_MS,
  maximumAge: 300000, // Accept cached position up to 5 minutes old
};

/**
 * @typedef {Object} GeoPosition
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} [accuracy] - Accuracy in meters
 * @property {string} [source] - 'browser' | 'fallback' | 'demo'
 */

/**
 * Request user geolocation with graceful fallback.
 *
 * @param {Object} options
 * @param {number} [options.timeoutMs] - Timeout in milliseconds
 * @param {AbortSignal} [options.signal] - Abort signal
 * @returns {Promise<GeoPosition>}
 */
export async function requestGeolocation(options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;

  // Check if geolocation is available
  if (!navigator.geolocation) {
    console.info('[Geolocation] API not available, using fallback');
    return getFallbackLocation('unavailable');
  }

  try {
    const position = await new Promise((resolve, reject) => {
      // Handle abort
      if (signal?.aborted) {
        reject(new DOMException('Geolocation aborted', 'AbortError'));
        return;
      }

      const cleanup = signal
        ? () => {
            signal.removeEventListener('abort', onAbort);
          }
        : () => {};

      const onAbort = () => {
        cleanup();
        reject(new DOMException('Geolocation aborted', 'AbortError'));
      };

      signal?.addEventListener('abort', onAbort);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          cleanup();
          resolve(pos);
        },
        (err) => {
          cleanup();
          reject(err);
        },
        {
          ...GEOLOCATION_OPTIONS,
          timeout: timeoutMs,
        },
      );
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      source: 'browser',
    };
  } catch (error) {
    // Log the error type for debugging
    if (error.code === 1) {
      console.info('[Geolocation] Permission denied, using fallback');
      return getFallbackLocation('denied');
    } else if (error.code === 2) {
      console.info('[Geolocation] Position unavailable, using fallback');
      return getFallbackLocation('unavailable');
    } else if (error.code === 3 || error.name === 'AbortError') {
      console.info('[Geolocation] Timeout or aborted, using fallback');
      return getFallbackLocation('timeout');
    }

    console.warn('[Geolocation] Unknown error:', error);
    return getFallbackLocation('error');
  }
}

/**
 * Get the fallback location from campaign config.
 *
 * @param {string} reason - Reason for fallback
 * @returns {GeoPosition}
 */
export function getFallbackLocation(reason = 'manual') {
  const campaign = getActiveCampaign();
  const fallback = campaign?.fallbackLocation || {
    latitude: 40.0583,
    longitude: -74.4057,
    name: 'Lakewood, NJ',
  };

  console.info(
    `[Geolocation] Using fallback location: ${fallback.name} (${reason})`,
  );

  return {
    latitude: fallback.latitude,
    longitude: fallback.longitude,
    source: 'fallback',
    fallbackReason: reason,
  };
}

/**
 * Check if geolocation permission is already granted.
 * Returns 'granted', 'denied', 'prompt', or 'unavailable'.
 *
 * @returns {Promise<string>}
 */
export async function checkGeolocationPermission() {
  if (!navigator.permissions) {
    return 'unavailable';
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return 'unavailable';
  }
}

/**
 * Determine if we should show the geolocation prompt.
 * Returns true if permission hasn't been decided yet.
 *
 * @returns {Promise<boolean>}
 */
export async function shouldShowGeolocationPrompt() {
  const permission = await checkGeolocationPermission();
  return permission === 'prompt' || permission === 'unavailable';
}
