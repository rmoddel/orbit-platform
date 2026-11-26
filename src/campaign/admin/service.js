/**
 * Admin Service
 *
 * Server-side operations for managing donors and campaigns.
 */

import { getSupabase, getCurrentUser, isAuthenticated } from './auth.js';

/**
 * @typedef {Object} DonorInput
 * @property {string} publicDisplayName
 * @property {string} [privateDonorName]
 * @property {number} [donationAmount]
 * @property {Date} [donationDate]
 * @property {boolean} [isAnonymous]
 * @property {boolean} [isPublic]
 * @property {string} [dedication]
 * @property {string} [hebrewDedication]
 * @property {number} [starTier]
 * @property {string} [notes]
 */

/**
 * Ensure user is authenticated.
 */
function requireAuth() {
  if (!isAuthenticated()) {
    throw new Error('Authentication required');
  }
}

/**
 * Get all donors for a campaign.
 *
 * @param {string} campaignId
 * @returns {Promise<Object[]>}
 */
export async function getAllDonors(campaignId) {
  requireAuth();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('donors')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get a single donor by ID.
 *
 * @param {string} donorId
 * @returns {Promise<Object>}
 */
export async function getDonor(donorId) {
  requireAuth();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('donors')
    .select('*')
    .eq('id', donorId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new donor.
 *
 * @param {string} campaignId
 * @param {DonorInput} input
 * @returns {Promise<Object>}
 */
export async function createDonor(campaignId, input) {
  requireAuth();
  const supabase = getSupabase();

  // Generate random star offset
  const starOffsetLat = (Math.random() - 0.5) * 0.015;
  const starOffsetLon = (Math.random() - 0.5) * 0.015;

  const { data, error } = await supabase
    .from('donors')
    .insert({
      campaign_id: campaignId,
      public_display_name: input.publicDisplayName,
      private_donor_name: input.privateDonorName,
      donation_amount: input.donationAmount,
      donation_date: input.donationDate || new Date().toISOString(),
      is_anonymous: input.isAnonymous || false,
      is_public: input.isPublic !== false,
      dedication: input.dedication,
      hebrew_dedication: input.hebrewDedication,
      star_tier: input.starTier || 1,
      star_offset_lat: starOffsetLat,
      star_offset_lon: starOffsetLon,
      notes: input.notes,
      is_demo: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a donor.
 *
 * @param {string} donorId
 * @param {Partial<DonorInput>} updates
 * @returns {Promise<Object>}
 */
export async function updateDonor(donorId, updates) {
  requireAuth();
  const supabase = getSupabase();

  const updateData = {};

  if (updates.publicDisplayName !== undefined) {
    updateData.public_display_name = updates.publicDisplayName;
  }
  if (updates.privateDonorName !== undefined) {
    updateData.private_donor_name = updates.privateDonorName;
  }
  if (updates.donationAmount !== undefined) {
    updateData.donation_amount = updates.donationAmount;
  }
  if (updates.donationDate !== undefined) {
    updateData.donation_date = updates.donationDate;
  }
  if (updates.isAnonymous !== undefined) {
    updateData.is_anonymous = updates.isAnonymous;
  }
  if (updates.isPublic !== undefined) {
    updateData.is_public = updates.isPublic;
  }
  if (updates.isHidden !== undefined) {
    updateData.is_hidden = updates.isHidden;
  }
  if (updates.dedication !== undefined) {
    updateData.dedication = updates.dedication;
  }
  if (updates.hebrewDedication !== undefined) {
    updateData.hebrew_dedication = updates.hebrewDedication;
  }
  if (updates.starTier !== undefined) {
    updateData.star_tier = updates.starTier;
  }
  if (updates.notes !== undefined) {
    updateData.notes = updates.notes;
  }

  const { data, error } = await supabase
    .from('donors')
    .update(updateData)
    .eq('id', donorId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a donor.
 *
 * @param {string} donorId
 */
export async function deleteDonor(donorId) {
  requireAuth();
  const supabase = getSupabase();

  const { error } = await supabase.from('donors').delete().eq('id', donorId);

  if (error) throw error;
}

/**
 * Generate a private viewing token for a donor.
 *
 * @param {string} donorId
 * @returns {Promise<string>} The generated token
 */
export async function generatePrivateToken(donorId) {
  requireAuth();
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('generate_donor_token', {
    donor_id: donorId,
  });

  if (error) throw error;
  return data;
}

/**
 * Revoke a donor's private token.
 *
 * @param {string} donorId
 */
export async function revokePrivateToken(donorId) {
  requireAuth();
  const supabase = getSupabase();

  const { error } = await supabase.rpc('revoke_donor_token', {
    donor_id: donorId,
  });

  if (error) throw error;
}

/**
 * Get the full private link URL for a donor.
 *
 * @param {string} token
 * @returns {string}
 */
export function getPrivateLinkUrl(token) {
  const baseUrl = window.location.origin;
  return `${baseUrl}/campaign.html?token=${encodeURIComponent(token)}`;
}

/**
 * Import donors from CSV data.
 *
 * @param {string} campaignId
 * @param {Object[]} rows - Parsed CSV rows
 * @returns {Promise<{success: number, errors: Array}>}
 */
export async function importDonorsFromCsv(campaignId, rows) {
  requireAuth();

  const results = { success: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await createDonor(campaignId, {
        publicDisplayName: row.publicDisplayName || row.name || row.displayName,
        privateDonorName: row.privateDonorName || row.privateName,
        donationAmount: parseFloat(row.amount) || undefined,
        donationDate: row.date ? new Date(row.date) : undefined,
        isAnonymous: row.anonymous === 'true' || row.anonymous === '1',
        dedication: row.dedication,
        hebrewDedication: row.hebrewDedication,
        starTier: parseInt(row.tier) || 1,
        notes: row.notes,
      });
      results.success++;
    } catch (error) {
      results.errors.push({ row: i + 1, error: error.message });
    }
  }

  return results;
}

/**
 * Remove all demo donors from a campaign.
 *
 * @param {string} campaignId
 */
export async function removeDemoDonors(campaignId) {
  requireAuth();
  const supabase = getSupabase();

  const { error } = await supabase
    .from('donors')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('is_demo', true);

  if (error) throw error;
}

/**
 * Get campaign by ID or slug.
 *
 * @param {string} idOrSlug
 * @returns {Promise<Object>}
 */
export async function getCampaign(idOrSlug) {
  requireAuth();
  const supabase = getSupabase();

  // Try by ID first
  let { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', idOrSlug)
    .single();

  if (error) {
    // Try by slug
    const result = await supabase
      .from('campaigns')
      .select('*')
      .eq('slug', idOrSlug)
      .single();

    data = result.data;
    error = result.error;
  }

  if (error) throw error;
  return data;
}

/**
 * Update campaign settings.
 *
 * @param {string} campaignId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateCampaign(campaignId, updates) {
  requireAuth();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', campaignId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get recent audit log entries.
 *
 * @param {number} [limit=50]
 * @returns {Promise<Object[]>}
 */
export async function getAuditLog(limit = 50) {
  requireAuth();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
