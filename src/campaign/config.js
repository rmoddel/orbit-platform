/**
 * Campaign Configuration System
 *
 * Separates the platform engine from campaign-specific configuration.
 * Each campaign is a configuration, not a hardcoded dependency.
 */

/** @typedef {Object} CampaignDestination
 * @property {string} name - Display name of the destination
 * @property {string} address - Full address
 * @property {number} latitude - Latitude in decimal degrees
 * @property {number} longitude - Longitude in decimal degrees
 * @property {number} [altitude] - Optional altitude in meters
 */

/** @typedef {Object} CampaignBranding
 * @property {string} title - Campaign title (e.g., "Kochvei Toras Zev")
 * @property {string} [hebrewTitle] - Hebrew campaign title
 * @property {string} organization - Organization name
 * @property {string} [tagline] - Short tagline
 * @property {string} [hebrewTagline] - Hebrew tagline
 * @property {Object} colors - Theme colors
 * @property {string} colors.primary - Primary accent color (hex)
 * @property {string} colors.secondary - Secondary color (hex)
 * @property {string} colors.background - Background color (hex)
 * @property {string} [logoUrl] - URL to campaign logo
 */

/** @typedef {Object} CampaignCopy
 * @property {string} journeyMessage - Message shown at journey start
 * @property {string} [hebrewJourneyMessage] - Hebrew journey message
 * @property {string} arrivalMessage - Message shown on arrival
 * @property {string} [hebrewArrivalMessage] - Hebrew arrival message
 * @property {string} donorRevealMessage - Private donor reveal message
 * @property {string} [hebrewDonorRevealMessage] - Hebrew reveal message
 * @property {string} anonymousPlaceholder - Text for anonymous donors
 * @property {string} [hebrewAnonymousPlaceholder] - Hebrew anonymous text
 * @property {string} donateButtonText - Donation button text
 * @property {string} [hebrewDonateButtonText] - Hebrew button text
 */

/** @typedef {Object} CampaignSettings
 * @property {boolean} showDonationAmounts - Whether to show amounts publicly
 * @property {boolean} enableSatellites - Whether to show satellite layer
 * @property {boolean} enableDrivingRoute - Whether to calculate driving routes
 * @property {number} maxRouteDistanceKm - Max distance for driving routes
 * @property {number} journeyDurationMs - Journey animation duration
 * @property {string} donationUrl - URL for donation button
 * @property {string} [currency] - Currency symbol (default: $)
 * @property {number} [campaignGoal] - Optional fundraising goal
 */

/** @typedef {Object} CampaignConfig
 * @property {string} id - Unique campaign identifier
 * @property {CampaignDestination} destination
 * @property {CampaignBranding} branding
 * @property {CampaignCopy} copy
 * @property {CampaignSettings} settings
 * @property {Object} fallbackLocation - Fallback when geolocation denied
 * @property {number} fallbackLocation.latitude
 * @property {number} fallbackLocation.longitude
 * @property {string} fallbackLocation.name
 */

const campaignRegistry = new Map();
let activeCampaign = null;

/**
 * Register a campaign configuration.
 * @param {CampaignConfig} config
 */
export function registerCampaign(config) {
  if (!config.id) throw new Error('Campaign must have an id');
  if (!config.destination?.latitude || !config.destination?.longitude) {
    throw new Error('Campaign must have destination coordinates');
  }
  campaignRegistry.set(config.id, Object.freeze(config));
}

/**
 * Set the active campaign by ID.
 * @param {string} campaignId
 * @returns {CampaignConfig}
 */
export function setActiveCampaign(campaignId) {
  const config = campaignRegistry.get(campaignId);
  if (!config) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }
  activeCampaign = config;
  return config;
}

/**
 * Get the currently active campaign configuration.
 * @returns {CampaignConfig|null}
 */
export function getActiveCampaign() {
  return activeCampaign;
}

/**
 * Get a campaign by ID.
 * @param {string} campaignId
 * @returns {CampaignConfig|undefined}
 */
export function getCampaign(campaignId) {
  return campaignRegistry.get(campaignId);
}

/**
 * List all registered campaign IDs.
 * @returns {string[]}
 */
export function listCampaigns() {
  return Array.from(campaignRegistry.keys());
}

/**
 * Calculate distance between two points in kilometers.
 * Uses Haversine formula.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number}
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determine if a location is within driving route distance of the campaign.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean}
 */
export function isWithinRouteDistance(latitude, longitude) {
  const campaign = getActiveCampaign();
  if (!campaign) return false;
  const distance = calculateDistanceKm(
    latitude,
    longitude,
    campaign.destination.latitude,
    campaign.destination.longitude,
  );
  return distance <= (campaign.settings.maxRouteDistanceKm || 500);
}

/**
 * Check if a location is overseas (not in continental US for US campaigns).
 * Simple heuristic: checks if within reasonable US bounds.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean}
 */
export function isOverseas(latitude, longitude) {
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

/**
 * Default campaign configuration values.
 */
export const DEFAULT_CONFIG = Object.freeze({
  settings: {
    showDonationAmounts: false,
    enableSatellites: true,
    enableDrivingRoute: true,
    maxRouteDistanceKm: 500,
    journeyDurationMs: 15000,
    currency: '$',
  },
  copy: {
    anonymousPlaceholder: 'Anonymous Supporter',
    hebrewAnonymousPlaceholder: 'תורם אנונימי',
    donateButtonText: 'Support Now',
    hebrewDonateButtonText: 'תרום עכשיו',
  },
  fallbackLocation: {
    latitude: 40.0583,
    longitude: -74.4057,
    name: 'Lakewood, NJ',
  },
});

/**
 * Merge campaign config with defaults.
 * @param {Partial<CampaignConfig>} config
 * @returns {CampaignConfig}
 */
export function createCampaignConfig(config) {
  return {
    ...config,
    settings: { ...DEFAULT_CONFIG.settings, ...config.settings },
    copy: { ...DEFAULT_CONFIG.copy, ...config.copy },
    fallbackLocation:
      config.fallbackLocation || DEFAULT_CONFIG.fallbackLocation,
  };
}
