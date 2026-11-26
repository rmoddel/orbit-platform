/**
 * Donor Service
 *
 * Client-side service for fetching and managing donor data.
 * Interfaces with Supabase backend.
 */

import { createClient } from '@supabase/supabase-js';
import { getActiveCampaign } from '../config.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabaseClient = null;

/**
 * Initialize the Supabase client.
 *
 * @param {Object} config
 * @param {string} config.url - Supabase project URL
 * @param {string} config.anonKey - Supabase anon key
 */
export function initializeSupabase(config) {
  if (!config.url || !config.anonKey) {
    console.warn('[Donors] Supabase not configured, using demo mode');
    return;
  }

  supabaseClient = createClient(config.url, config.anonKey);
}

/**
 * Check if Supabase is configured and available.
 *
 * @returns {boolean}
 */
export function isSupabaseAvailable() {
  return supabaseClient !== null;
}

/**
 * @typedef {Object} PublicDonor
 * @property {string} id
 * @property {string} campaignId
 * @property {string} displayName
 * @property {Date} donationDate
 * @property {number} [donationAmount]
 * @property {string} [currency]
 * @property {number} starOffsetLat
 * @property {number} starOffsetLon
 * @property {number} starTier
 * @property {boolean} isAnonymous
 * @property {boolean} isDemo
 */

/**
 * @typedef {Object} PrivateDonor
 * @property {string} id
 * @property {string} campaignId
 * @property {string} publicDisplayName
 * @property {string} privateDonorName
 * @property {number} donationAmount
 * @property {Date} donationDate
 * @property {string} currency
 * @property {boolean} isAnonymous
 * @property {string} [dedication]
 * @property {string} [hebrewDedication]
 * @property {number} starOffsetLat
 * @property {number} starOffsetLon
 * @property {number} starTier
 */

/**
 * Fetch public donors for the current campaign.
 *
 * @param {Object} [options]
 * @param {number} [options.limit] - Maximum number of donors
 * @param {number} [options.offset] - Offset for pagination
 * @returns {Promise<PublicDonor[]>}
 */
export async function fetchPublicDonors(options = {}) {
  const campaign = getActiveCampaign();
  if (!campaign) {
    console.warn('[Donors] No active campaign');
    return getDemoDonors();
  }

  if (!supabaseClient) {
    return getDemoDonors();
  }

  try {
    let query = supabaseClient
      .from('public_donors')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('donation_date', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 100) - 1,
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Donors] Error fetching donors:', error);
      return getDemoDonors();
    }

    return data.map(transformPublicDonor);
  } catch (error) {
    console.error('[Donors] Error:', error);
    return getDemoDonors();
  }
}

/**
 * Fetch a donor by their private token.
 *
 * @param {string} token - Private viewing token
 * @returns {Promise<PrivateDonor | null>}
 */
export async function fetchDonorByToken(token) {
  if (!token) {
    return null;
  }

  if (!supabaseClient) {
    // Check demo donors for token
    const demo = getDemoDonors().find((d) => d.token === token);
    if (demo) {
      return {
        ...demo,
        privateDonorName: demo.privateDonorName || demo.displayName,
        dedication: demo.dedication,
      };
    }
    return null;
  }

  try {
    const { data, error } = await supabaseClient.rpc('get_donor_by_token', {
      token,
    });

    if (error) {
      console.error('[Donors] Error fetching donor by token:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return transformPrivateDonor(data[0]);
  } catch (error) {
    console.error('[Donors] Error:', error);
    return null;
  }
}

/**
 * Subscribe to real-time donor updates.
 *
 * @param {function(PublicDonor[]): void} callback
 * @returns {function(): void} Unsubscribe function
 */
export function subscribeToDonors(callback) {
  const campaign = getActiveCampaign();

  if (!supabaseClient || !campaign) {
    // For demo mode, just call once
    callback(getDemoDonors());
    return () => {};
  }

  // Initial fetch
  fetchPublicDonors().then(callback);

  // Subscribe to changes
  const subscription = supabaseClient
    .channel('public_donors_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'donors',
        filter: `campaign_id=eq.${campaign.id}`,
      },
      () => {
        // Refetch on any change
        fetchPublicDonors().then(callback);
      },
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Transform database row to PublicDonor.
 */
function transformPublicDonor(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    displayName: row.display_name,
    donationDate: new Date(row.donation_date),
    donationAmount: row.donation_amount,
    currency: row.currency,
    starOffsetLat: row.star_offset_lat || generateStarOffset(),
    starOffsetLon: row.star_offset_lon || generateStarOffset(),
    starTier: row.star_tier || 1,
    isAnonymous: row.is_anonymous,
    isDemo: row.is_demo,
  };
}

/**
 * Transform database row to PrivateDonor.
 */
function transformPrivateDonor(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    publicDisplayName: row.public_display_name,
    privateDonorName: row.private_donor_name,
    donationAmount: row.donation_amount,
    donationDate: new Date(row.donation_date),
    currency: row.currency,
    isAnonymous: row.is_anonymous,
    dedication: row.dedication,
    hebrewDedication: row.hebrew_dedication,
    starOffsetLat: row.star_offset_lat || generateStarOffset(),
    starOffsetLon: row.star_offset_lon || generateStarOffset(),
    starTier: row.star_tier || 1,
  };
}

/**
 * Generate a random star offset for visualization.
 */
function generateStarOffset() {
  // Random offset within ~0.01 degrees (~1km)
  return (Math.random() - 0.5) * 0.02;
}

/**
 * Get demonstration donor data.
 * These are clearly marked as demos and should be removed before launch.
 */
export function getDemoDonors() {
  const campaign = getActiveCampaign();
  const baseDate = new Date();

  // Generate diverse demo donors
  const demoNames = [
    {
      public: 'The Goldberg Family',
      private: 'Moshe & Sara Goldberg',
      tier: 3,
    },
    {
      public: 'Anonymous Supporter',
      private: 'Yosef Katz',
      tier: 2,
      anonymous: true,
    },
    {
      public: 'The Friedman Foundation',
      private: 'Friedman Family Foundation',
      tier: 5,
    },
    {
      public: 'Anonymous Supporter',
      private: 'Shimon Levy',
      tier: 1,
      anonymous: true,
    },
    { public: "R' Dovid & Family", private: 'Dovid Schwartz', tier: 2 },
    { public: 'The Klein Family', private: 'Avraham Klein', tier: 3 },
    {
      public: 'Anonymous Supporter',
      private: 'Chaim Rosen',
      tier: 1,
      anonymous: true,
    },
    { public: 'In Memory of R\' Zev zt"l', private: 'Memorial Fund', tier: 4 },
    { public: 'Lakewood Supporter', private: 'Local Family', tier: 1 },
    { public: 'The Cohen Family', private: 'Yitzchak Cohen', tier: 2 },
  ];

  return demoNames.map((donor, index) => ({
    id: `demo-${index}`,
    campaignId: campaign?.id || 'toras-zev',
    displayName: donor.anonymous
      ? campaign?.copy?.anonymousPlaceholder || 'Anonymous Supporter'
      : donor.public,
    privateDonorName: donor.private,
    donationDate: new Date(baseDate.getTime() - index * 24 * 60 * 60 * 1000),
    donationAmount: donor.tier * 500 + Math.floor(Math.random() * 500),
    currency: '$',
    starOffsetLat: (Math.random() - 0.5) * 0.015,
    starOffsetLon: (Math.random() - 0.5) * 0.015,
    starTier: donor.tier,
    isAnonymous: donor.anonymous || false,
    isDemo: true,
    token: `demo-token-${index}`,
    dedication: index === 7 ? "לעילוי נשמת ר' זאב בן ר' משה ז\"ל" : undefined,
  }));
}

/**
 * Get total donor count for campaign.
 *
 * @returns {Promise<number>}
 */
export async function getDonorCount() {
  const campaign = getActiveCampaign();

  if (!supabaseClient || !campaign) {
    return getDemoDonors().length;
  }

  try {
    const { count, error } = await supabaseClient
      .from('public_donors')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);

    if (error) {
      console.error('[Donors] Error counting donors:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[Donors] Error:', error);
    return 0;
  }
}
