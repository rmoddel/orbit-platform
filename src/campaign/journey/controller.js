/**
 * Journey Controller
 *
 * Orchestrates the complete visitor journey experience:
 * 1. Arrival from space
 * 2. Geolocation and visitor marker
 * 3. Route calculation
 * 4. Cinematic journey animation
 * 5. Arrival at destination
 */

import {
  getActiveCampaign,
  calculateDistanceKm,
  isOverseas,
} from '../config.js';
import { requestGeolocation, getFallbackLocation } from './geolocation.js';
import { calculateRoute, isOverseasLocation } from './routing.js';

/** Journey states */
export const JourneyState = {
  IDLE: 'idle',
  SPACE_VIEW: 'space_view',
  LOCATING: 'locating',
  SHOWING_ORIGIN: 'showing_origin',
  CALCULATING_ROUTE: 'calculating_route',
  JOURNEY_MESSAGE: 'journey_message',
  ANIMATING: 'animating',
  ARRIVING: 'arriving',
  ARRIVED: 'arrived',
  SKIPPED: 'skipped',
};

/**
 * @typedef {Object} JourneyController
 * @property {function(): Promise<void>} start - Start the journey
 * @property {function(): void} skip - Skip to destination
 * @property {function(): void} pause - Pause the journey
 * @property {function(): void} resume - Resume the journey
 * @property {function(): Promise<void>} replay - Replay the journey
 * @property {function(): string} getState - Get current state
 * @property {function(callback: Function): Function} onStateChange - Subscribe to state changes
 * @property {function(): void} dispose - Clean up
 */

/**
 * Create a journey controller.
 *
 * @param {Object} options
 * @param {Object} options.camera - Camera port with flyTo, setView methods
 * @param {Object} options.scene - Scene for rendering markers
 * @param {function(message: string): void} [options.onMessage] - Display messages
 * @param {function(progress: number): void} [options.onProgress] - Progress callback (0-1)
 * @returns {JourneyController}
 */
export function createJourneyController({
  camera,
  scene,
  onMessage,
  onProgress,
}) {
  let state = JourneyState.IDLE;
  const listeners = new Set();
  let abortController = null;
  let currentFlight = null;
  let originPosition = null;
  let route = null;
  let isPaused = false;

  const setState = (newState) => {
    state = newState;
    listeners.forEach((cb) => cb(state));
  };

  const notify = (message) => {
    onMessage?.(message);
  };

  const reportProgress = (progress) => {
    onProgress?.(Math.max(0, Math.min(1, progress)));
  };

  /**
   * Start the journey from space.
   */
  async function start() {
    if (
      state !== JourneyState.IDLE &&
      state !== JourneyState.ARRIVED &&
      state !== JourneyState.SKIPPED
    ) {
      return;
    }

    abortController = new AbortController();
    const signal = abortController.signal;

    try {
      // Phase 1: Show Earth from space
      setState(JourneyState.SPACE_VIEW);
      reportProgress(0);

      await flyToSpaceView(camera, { signal });
      if (signal.aborted) return;

      // Brief pause to appreciate the view
      await delay(1500, signal);
      if (signal.aborted) return;

      // Phase 2: Get visitor location
      setState(JourneyState.LOCATING);
      reportProgress(0.1);

      originPosition = await requestGeolocation({ signal, timeoutMs: 8000 });
      if (signal.aborted) return;

      // Phase 3: Fly to visitor location
      setState(JourneyState.SHOWING_ORIGIN);
      reportProgress(0.2);

      await flyToLocation(camera, originPosition, { signal, altitude: 50000 });
      if (signal.aborted) return;

      await delay(1500, signal);
      if (signal.aborted) return;

      // Phase 4: Show journey message
      setState(JourneyState.JOURNEY_MESSAGE);
      reportProgress(0.3);

      const campaign = getActiveCampaign();
      notify(campaign?.copy?.journeyMessage || 'Your journey begins here.');

      await delay(2500, signal);
      if (signal.aborted) return;

      // Phase 5: Calculate route
      setState(JourneyState.CALCULATING_ROUTE);
      reportProgress(0.35);

      const destination = campaign?.destination;
      if (!destination) {
        throw new Error('No campaign destination configured');
      }

      // Determine if we should attempt driving route
      const shouldUseDrivingRoute =
        campaign?.settings?.enableDrivingRoute !== false &&
        !isOverseasLocation(originPosition.latitude, originPosition.longitude);

      if (shouldUseDrivingRoute) {
        route = await calculateRoute(originPosition, destination, { signal });
      } else {
        // Use cinematic flyover for overseas/distant visitors
        const distance = calculateDistanceKm(
          originPosition.latitude,
          originPosition.longitude,
          destination.latitude,
          destination.longitude,
        );
        route = {
          waypoints: [originPosition, destination],
          distanceKm: distance,
          type: 'flyover',
        };
      }

      if (signal.aborted) return;

      // Phase 6: Animate journey
      setState(JourneyState.ANIMATING);
      reportProgress(0.4);

      const journeyDuration = campaign?.settings?.journeyDurationMs || 15000;
      await animateJourney(camera, route, {
        signal,
        durationMs: journeyDuration,
        onProgress: (p) => reportProgress(0.4 + p * 0.5),
      });

      if (signal.aborted) return;

      // Phase 7: Arrival sequence
      setState(JourneyState.ARRIVING);
      reportProgress(0.95);

      await flyToDestination(camera, destination, { signal });
      if (signal.aborted) return;

      notify(campaign?.copy?.arrivalMessage || 'Welcome!');

      setState(JourneyState.ARRIVED);
      reportProgress(1);
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('[Journey] Error:', error);
      // On error, skip to destination
      skip();
    }
  }

  /**
   * Skip directly to the destination.
   */
  function skip() {
    abortController?.abort();
    abortController = null;
    currentFlight?.cancel();
    currentFlight = null;

    const campaign = getActiveCampaign();
    const destination = campaign?.destination;

    if (destination && camera) {
      flyToDestination(camera, destination, {}).then(() => {
        setState(JourneyState.SKIPPED);
        reportProgress(1);
        notify(campaign?.copy?.arrivalMessage || 'Welcome!');
      });
    } else {
      setState(JourneyState.SKIPPED);
    }
  }

  /**
   * Pause the journey animation.
   */
  function pause() {
    isPaused = true;
    currentFlight?.cancel();
  }

  /**
   * Resume the journey animation.
   */
  function resume() {
    isPaused = false;
    // Resuming mid-journey is complex; for now just continue to destination
    if (state === JourneyState.ANIMATING) {
      skip();
    }
  }

  /**
   * Replay the journey from the beginning.
   */
  async function replay() {
    abortController?.abort();
    currentFlight?.cancel();
    state = JourneyState.IDLE;
    await start();
  }

  /**
   * Subscribe to state changes.
   */
  function onStateChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  /**
   * Clean up resources.
   */
  function dispose() {
    abortController?.abort();
    currentFlight?.cancel();
    listeners.clear();
  }

  return {
    start,
    skip,
    pause,
    resume,
    replay,
    getState: () => state,
    onStateChange,
    dispose,
    // Expose for testing
    get originPosition() {
      return originPosition;
    },
    get route() {
      return route;
    },
  };
}

/**
 * Fly camera to space view of Earth.
 */
async function flyToSpaceView(camera, { signal }) {
  const campaign = getActiveCampaign();
  const destination = campaign?.destination || { latitude: 40, longitude: -74 };

  // Start from a space view looking at the general region
  camera.setView({
    destination: {
      x: destination.longitude,
      y: destination.latitude,
      z: 20000000, // 20,000 km altitude
    },
    orientation: {
      heading: 0,
      pitch: -Math.PI / 2, // Looking down
      roll: 0,
    },
  });

  await delay(100, signal);
}

/**
 * Fly to a specific location with smooth animation.
 */
async function flyToLocation(camera, position, { signal, altitude = 50000 }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const flight = camera.flyTo(
      {
        x: position.longitude,
        y: position.latitude,
        z: altitude,
      },
      {
        durationS: 3,
        easing: 'cubicInOut',
        onComplete: resolve,
        onCancel: () => reject(new DOMException('Cancelled', 'AbortError')),
      },
    );

    signal?.addEventListener('abort', () => flight.cancel(), { once: true });
  });
}

/**
 * Animate the camera along the route.
 */
async function animateJourney(
  camera,
  route,
  { signal, durationMs, onProgress },
) {
  const waypoints = route.waypoints;
  if (!waypoints || waypoints.length < 2) {
    return;
  }

  const totalDistance = route.distanceKm;
  const isLongDistance = totalDistance > 100;
  const isFlyover = route.type === 'flyover' || route.type === 'cinematic';

  // Calculate altitude profile (higher for longer routes)
  const getAltitude = (progress) => {
    // Parabolic altitude profile: start low, peak in middle, end low
    const baseAltitude = isFlyover ? 500000 : 5000; // 500km for flyover, 5km for driving
    const peakAltitude = isFlyover
      ? Math.min(2000000, totalDistance * 1000) // Up to 2000km
      : Math.min(50000, totalDistance * 100); // Up to 50km

    const heightFactor = 4 * progress * (1 - progress); // Peaks at 0.5
    return baseAltitude + heightFactor * (peakAltitude - baseAltitude);
  };

  // Calculate pitch profile (more tilted at start/end, flatter in middle)
  const getPitch = (progress) => {
    const edgeFactor = Math.min(progress * 4, (1 - progress) * 4, 1);
    return -Math.PI / 4 - (edgeFactor * Math.PI) / 6;
  };

  // Animate through waypoints
  const startTime = performance.now();
  const duration = durationMs;
  const numWaypoints = waypoints.length;

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / duration);

    // Interpolate position along route
    const waypointIndex = Math.min(
      numWaypoints - 2,
      Math.floor(progress * (numWaypoints - 1)),
    );
    const waypointProgress =
      (progress * (numWaypoints - 1)) % 1 || (progress === 1 ? 1 : 0);

    const wp1 = waypoints[waypointIndex];
    const wp2 = waypoints[Math.min(waypointIndex + 1, numWaypoints - 1)];

    const lat = wp1.latitude + (wp2.latitude - wp1.latitude) * waypointProgress;
    const lon =
      wp1.longitude + (wp2.longitude - wp1.longitude) * waypointProgress;
    const alt = getAltitude(progress);

    // Calculate heading towards next waypoint
    const heading = calculateHeading(lat, lon, wp2.latitude, wp2.longitude);

    camera.setView({
      destination: { x: lon, y: lat, z: alt },
      orientation: {
        heading: heading,
        pitch: getPitch(progress),
        roll: 0,
      },
    });

    onProgress?.(progress);

    if (progress >= 1) {
      break;
    }

    // Target 30fps for smooth animation
    await delay(33, signal);
  }
}

/**
 * Fly to the destination with arrival animation.
 */
async function flyToDestination(camera, destination, { signal }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const flight = camera.flyTo(
      {
        x: destination.longitude,
        y: destination.latitude,
        z: 1500, // Final altitude: ~1.5km
      },
      {
        durationS: 4,
        easing: 'cubicInOut',
        orientation: {
          heading: 0,
          pitch: -Math.PI / 4, // 45 degree angle
          roll: 0,
        },
        onComplete: resolve,
        onCancel: () => reject(new DOMException('Cancelled', 'AbortError')),
      },
    );

    signal?.addEventListener('abort', () => flight.cancel(), { once: true });
  });
}

/**
 * Calculate heading from one point to another.
 */
function calculateHeading(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);

  return Math.atan2(y, x);
}

/**
 * Delay helper with abort support.
 */
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}
