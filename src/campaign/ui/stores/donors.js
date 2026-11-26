/**
 * Donors Store
 *
 * Pinia store for managing donor data and UI state.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  fetchPublicDonors,
  subscribeToDonors,
  getDemoDonors,
} from '../../donors/service.js';

export const useDonorsStore = defineStore('donors', () => {
  // State
  const donors = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const selectedDonorId = ref(null);
  const isWallVisible = ref(true);
  const isWallExpanded = ref(false); // For mobile bottom sheet

  // Computed
  const selectedDonor = computed(() => {
    if (!selectedDonorId.value) return null;
    return donors.value.find((d) => d.id === selectedDonorId.value) || null;
  });

  const donorCount = computed(() => donors.value.length);

  const publicDonors = computed(() => donors.value.filter((d) => !d.isHidden));

  const recentDonors = computed(() =>
    [...publicDonors.value]
      .sort((a, b) => new Date(b.donationDate) - new Date(a.donationDate))
      .slice(0, 50),
  );

  const demoDonorsCount = computed(
    () => donors.value.filter((d) => d.isDemo).length,
  );

  // Actions
  async function loadDonors() {
    loading.value = true;
    error.value = null;

    try {
      donors.value = await fetchPublicDonors();
    } catch (e) {
      console.error('[DonorsStore] Error loading donors:', e);
      error.value = e.message;
      // Fall back to demo data
      donors.value = getDemoDonors();
    } finally {
      loading.value = false;
    }
  }

  function selectDonor(donorId) {
    selectedDonorId.value = donorId;
  }

  function clearSelection() {
    selectedDonorId.value = null;
  }

  function toggleWall() {
    isWallVisible.value = !isWallVisible.value;
  }

  function showWall() {
    isWallVisible.value = true;
  }

  function hideWall() {
    isWallVisible.value = false;
  }

  function expandWall() {
    isWallExpanded.value = true;
  }

  function collapseWall() {
    isWallExpanded.value = false;
  }

  // Subscribe to real-time updates
  let unsubscribe = null;

  function startSubscription() {
    if (unsubscribe) return;

    unsubscribe = subscribeToDonors((updatedDonors) => {
      donors.value = updatedDonors;
    });
  }

  function stopSubscription() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return {
    // State
    donors,
    loading,
    error,
    selectedDonorId,
    isWallVisible,
    isWallExpanded,

    // Computed
    selectedDonor,
    donorCount,
    publicDonors,
    recentDonors,
    demoDonorsCount,

    // Actions
    loadDonors,
    selectDonor,
    clearSelection,
    toggleWall,
    showWall,
    hideWall,
    expandWall,
    collapseWall,
    startSubscription,
    stopSubscription,
  };
});
