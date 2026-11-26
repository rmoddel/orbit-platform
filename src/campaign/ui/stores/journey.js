/**
 * Journey Store
 *
 * Pinia store for managing the visitor journey state.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { JourneyState } from '../../journey/controller.js';

export const useJourneyStore = defineStore('journey', () => {
  // State
  const state = ref(JourneyState.IDLE);
  const progress = ref(0);
  const message = ref('');
  const hasCompleted = ref(false);
  const wasSkipped = ref(false);

  // Computed
  const isActive = computed(
    () =>
      state.value !== JourneyState.IDLE &&
      state.value !== JourneyState.ARRIVED &&
      state.value !== JourneyState.SKIPPED,
  );

  const isLocating = computed(() => state.value === JourneyState.LOCATING);

  const isAnimating = computed(() => state.value === JourneyState.ANIMATING);

  const hasArrived = computed(
    () =>
      state.value === JourneyState.ARRIVED ||
      state.value === JourneyState.SKIPPED,
  );

  const canSkip = computed(
    () => isActive.value && state.value !== JourneyState.ARRIVING,
  );

  const canReplay = computed(() => hasCompleted.value || wasSkipped.value);

  // Actions
  function setState(newState) {
    state.value = newState;

    if (newState === JourneyState.ARRIVED) {
      hasCompleted.value = true;
    } else if (newState === JourneyState.SKIPPED) {
      wasSkipped.value = true;
    }
  }

  function setProgress(value) {
    progress.value = Math.max(0, Math.min(1, value));
  }

  function setMessage(text) {
    message.value = text;
  }

  function reset() {
    state.value = JourneyState.IDLE;
    progress.value = 0;
    message.value = '';
    hasCompleted.value = false;
    wasSkipped.value = false;
  }

  return {
    // State
    state,
    progress,
    message,
    hasCompleted,
    wasSkipped,

    // Computed
    isActive,
    isLocating,
    isAnimating,
    hasArrived,
    canSkip,
    canReplay,

    // Actions
    setState,
    setProgress,
    setMessage,
    reset,
  };
});
