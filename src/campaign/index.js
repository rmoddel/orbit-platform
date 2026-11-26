/**
 * Campaign Module Entry Point
 *
 * Exports campaign configuration and management utilities.
 */

export {
  registerCampaign,
  setActiveCampaign,
  getActiveCampaign,
  getCampaign,
  listCampaigns,
  createCampaignConfig,
  calculateDistanceKm,
  isWithinRouteDistance,
  isOverseas,
  DEFAULT_CONFIG,
} from './config.js';

// Import campaigns to register them
import './campaigns/toras-zev.js';
