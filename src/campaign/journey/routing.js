/**
 * Routing Service
 *
 * Calculates driving routes for the journey animation.
 *
 * ROUTING PROVIDERS:
 *
 * 1. OpenRouteService (ORS)
 *    - Free tier: 2,000 requests/day
 *    - Terms: Requires API key, attribution to OpenRouteService and OSM
 *    - https://openrouteservice.org/terms-of-service/
 *
 * 2. OSRM (Open Source Routing Machine)
 *    - Public demo server: NOT for production use
 *    - Self-hosted: Unlimited, requires server infrastructure
 *    - https://github.com/Project-OSRM/osrm-backend
 *
 * 3. Valhalla
 *    - Self-hosted only for free
 *    - https://github.com/valhalla/valhalla
 *
 * This module uses OpenRouteService as the primary provider with fallback
 * to a cinematic flyover when routing is unavailable.
 *
 * IMPORTANT: Do not use public demo servers for production. The fallback
 * cinematic flyover is provided when no valid routing service is configured.
 */

import { calculateDistanceKm } from '../config.js';

/** Maximum route distance in kilometers for driving routes */
const MAX_DRIVING_ROUTE_KM = 500;

/** Minimum number of waypoints for a smooth route */
const MIN_ROUTE_WAYPOINTS = 10;

/**
 * @typedef {Object} RoutePoint
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} [altitude] - Altitude in meters (for visualization)
 */

/**
 * @typedef {Object} Route
 * @property {RoutePoint[]} waypoints - Points along the route
 * @property {number} distanceKm - Total distance in kilometers
 * @property {number} durationMinutes - Estimated duration in minutes
 * @property {string} type - 'driving' | 'flyover' | 'cinematic'
 * @property {string} [provider] - Routing provider used
 * @property {string} [attribution] - Required attribution text
 */

/**
 * Configuration for routing providers.
 */
const routingConfig = {
  openRouteService: {
    apiKey: null, // Set via configureRouting()
    endpoint: 'https://api.openrouteservice.org/v2/directions/driving-car',
    attribution:
      'Routing by OpenRouteService | Map data © OpenStreetMap contributors',
  },
};

/**
 * Configure the routing service.
 *
 * @param {Object} config
 * @param {string} [config.openRouteServiceApiKey] - ORS API key
 */
export function configureRouting(config = {}) {
  if (config.openRouteServiceApiKey) {
    routingConfig.openRouteService.apiKey = config.openRouteServiceApiKey;
  }
}

/**
 * Check if a valid routing service is configured.
 *
 * @returns {boolean}
 */
export function isRoutingAvailable() {
  return Boolean(routingConfig.openRouteService.apiKey);
}

/**
 * Calculate a route between two points.
 *
 * @param {RoutePoint} start - Starting point
 * @param {RoutePoint} end - Ending point
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal] - Abort signal
 * @returns {Promise<Route>}
 */
export async function calculateRoute(start, end, options = {}) {
  const distance = calculateDistanceKm(
    start.latitude,
    start.longitude,
    end.latitude,
    end.longitude,
  );

  // If distance is too great for driving, use cinematic flyover
  if (distance > MAX_DRIVING_ROUTE_KM) {
    console.info(
      `[Routing] Distance ${distance.toFixed(0)}km exceeds max, using flyover`,
    );
    return createCinematicRoute(start, end, distance);
  }

  // Try routing service if available
  if (isRoutingAvailable()) {
    try {
      return await fetchOpenRouteServiceRoute(start, end, options);
    } catch (error) {
      console.warn('[Routing] OpenRouteService failed:', error.message);
      // Fall through to cinematic route
    }
  } else {
    console.info(
      '[Routing] No routing service configured, using cinematic flyover',
    );
  }

  // Fallback to cinematic route
  return createCinematicRoute(start, end, distance);
}

/**
 * Fetch route from OpenRouteService.
 *
 * @param {RoutePoint} start
 * @param {RoutePoint} end
 * @param {Object} options
 * @returns {Promise<Route>}
 */
async function fetchOpenRouteServiceRoute(start, end, options = {}) {
  const { apiKey, endpoint, attribution } = routingConfig.openRouteService;

  if (!apiKey) {
    throw new Error('OpenRouteService API key not configured');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      coordinates: [
        [start.longitude, start.latitude],
        [end.longitude, end.latitude],
      ],
      instructions: false,
      geometry_simplify: false,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `OpenRouteService error: ${response.status} - ${errorText}`,
    );
  }

  const data = await response.json();
  const route = data.routes?.[0];

  if (!route?.geometry?.coordinates) {
    throw new Error('Invalid route response from OpenRouteService');
  }

  // Decode route geometry (ORS returns coordinates as [lon, lat])
  const waypoints = route.geometry.coordinates.map(([lon, lat]) => ({
    longitude: lon,
    latitude: lat,
  }));

  // Simplify route for smooth animation (keep every Nth point)
  const simplifiedWaypoints = simplifyRoute(waypoints, 50);

  return {
    waypoints: simplifiedWaypoints,
    distanceKm: (route.summary?.distance || 0) / 1000,
    durationMinutes: (route.summary?.duration || 0) / 60,
    type: 'driving',
    provider: 'openrouteservice',
    attribution,
  };
}

/**
 * Simplify a route by keeping every Nth point and ensuring key points.
 *
 * @param {RoutePoint[]} waypoints
 * @param {number} targetCount - Target number of points
 * @returns {RoutePoint[]}
 */
function simplifyRoute(waypoints, targetCount) {
  if (waypoints.length <= targetCount) {
    return waypoints;
  }

  const step = Math.max(1, Math.floor(waypoints.length / targetCount));
  const simplified = [waypoints[0]]; // Always include start

  for (let i = step; i < waypoints.length - 1; i += step) {
    simplified.push(waypoints[i]);
  }

  simplified.push(waypoints[waypoints.length - 1]); // Always include end

  return simplified;
}

/**
 * Create a cinematic flyover route (great circle arc).
 *
 * @param {RoutePoint} start
 * @param {RoutePoint} end
 * @param {number} distanceKm
 * @returns {Route}
 */
export function createCinematicRoute(start, end, distanceKm) {
  const waypoints = generateGreatCircleArc(
    start,
    end,
    Math.max(MIN_ROUTE_WAYPOINTS, 30),
  );

  // Estimate duration based on distance (assuming 100km/h average for visualization)
  const durationMinutes = (distanceKm / 100) * 60;

  return {
    waypoints,
    distanceKm,
    durationMinutes,
    type: distanceKm > MAX_DRIVING_ROUTE_KM ? 'flyover' : 'cinematic',
    attribution: 'Cinematic flyover visualization',
  };
}

/**
 * Generate waypoints along a great circle arc between two points.
 *
 * @param {RoutePoint} start
 * @param {RoutePoint} end
 * @param {number} numPoints
 * @returns {RoutePoint[]}
 */
function generateGreatCircleArc(start, end, numPoints) {
  const waypoints = [];
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const lat1 = toRad(start.latitude);
  const lon1 = toRad(start.longitude);
  const lat2 = toRad(end.latitude);
  const lon2 = toRad(end.longitude);

  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;

    // Spherical interpolation along great circle
    const d =
      2 *
      Math.asin(
        Math.sqrt(
          Math.pow(Math.sin((lat2 - lat1) / 2), 2) +
            Math.cos(lat1) *
              Math.cos(lat2) *
              Math.pow(Math.sin((lon2 - lon1) / 2), 2),
        ),
      );

    if (d === 0) {
      waypoints.push({
        latitude: start.latitude,
        longitude: start.longitude,
      });
      continue;
    }

    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);

    const x =
      A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y =
      A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);

    waypoints.push({
      latitude: toDeg(lat),
      longitude: toDeg(lon),
    });
  }

  return waypoints;
}

/**
 * Check if a location is overseas (not in continental US).
 * Used to determine if driving route should be attempted.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean}
 */
export function isOverseasLocation(latitude, longitude) {
  // Continental US approximate bounds
  const US_BOUNDS = {
    minLat: 24.5,
    maxLat: 49.5,
    minLon: -125,
    maxLon: -66.5,
  };

  return (
    latitude < US_BOUNDS.minLat ||
    latitude > US_BOUNDS.maxLat ||
    longitude < US_BOUNDS.minLon ||
    longitude > US_BOUNDS.maxLon
  );
}
