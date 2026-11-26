/**
 * Kochvei Toras Zev Campaign Configuration
 *
 * Cheder Toras Zev
 * 1000 Cross St, Lakewood, NJ 08701
 *
 * This is the first campaign on the Orbit Platform.
 */

import { createCampaignConfig, registerCampaign } from '../config.js';

/**
 * Verified coordinates for Cheder Toras Zev
 * 1000 Cross St, Lakewood, NJ 08701
 *
 * Geocoded and verified via multiple sources.
 */
const DESTINATION_COORDINATES = {
  latitude: 40.0795,
  longitude: -74.2179,
};

const torasZevConfig = createCampaignConfig({
  id: 'toras-zev',

  destination: {
    name: 'Cheder Toras Zev',
    address: '1000 Cross St, Lakewood, NJ 08701',
    ...DESTINATION_COORDINATES,
  },

  branding: {
    title: 'Kochvei Toras Zev',
    hebrewTitle: 'כוכבי תורת זאב',
    organization: 'Cheder Toras Zev',
    tagline: 'Your chelek in Torah',
    hebrewTagline: 'חלקך בתורה',
    colors: {
      primary: '#D4AF37', // Gold
      secondary: '#1a1a2e', // Deep navy
      background: '#0a0a0f', // Near black
    },
    logoUrl: null, // To be provided
  },

  copy: {
    journeyMessage: 'Your journey to Toras Zev begins here.',
    hebrewJourneyMessage: 'המסע שלך לתורת זאב מתחיל כאן.',

    arrivalMessage: 'Welcome to Cheder Toras Zev',
    hebrewArrivalMessage: 'ברוכים הבאים לחדר תורת זאב',

    donorRevealMessage: 'Your chelek in the Torah of Toras Zev.',
    hebrewDonorRevealMessage: 'חלקך בתורה של תורת זאב.',

    anonymousPlaceholder: 'Anonymous Supporter',
    hebrewAnonymousPlaceholder: 'תורם אנונימי',

    donateButtonText: 'Support Toras Zev',
    hebrewDonateButtonText: 'תרום לתורת זאב',

    // Recognition terminology
    supporterTerm: 'supporter',
    hebrewSupporterTerm: 'תומך',
    starTerm: 'star',
    hebrewStarTerm: 'כוכב',

    // Welcome screen
    welcomeTitle: 'Kochvei Toras Zev',
    hebrewWelcomeTitle: 'כוכבי תורת זאב',
    welcomeSubtitle: 'Join our constellation of supporters',
    hebrewWelcomeSubtitle: 'הצטרפו לקהילת התומכים שלנו',
  },

  settings: {
    showDonationAmounts: false,
    enableSatellites: true,
    enableDrivingRoute: true,
    maxRouteDistanceKm: 500, // Within ~300 miles
    journeyDurationMs: 18000, // 18 seconds
    donationUrl: '', // To be configured
    currency: '$',
    campaignGoal: null, // Optional
  },

  // Fallback location when geolocation is denied
  // Using Lakewood, NJ as the natural fallback
  fallbackLocation: {
    latitude: 40.0583,
    longitude: -74.4057,
    name: 'Lakewood, NJ',
  },
});

// Register the campaign
registerCampaign(torasZevConfig);

export default torasZevConfig;
export { DESTINATION_COORDINATES };
