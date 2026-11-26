<script setup>
/**
 * Private Donor View Component
 *
 * Displays personalized content for donors accessing via private link.
 * Shows their actual name, donation amount, and dedication.
 */

import { ref, computed, onMounted } from 'vue';
import { fetchDonorByToken } from '../../donors/service.js';
import { getActiveCampaign } from '../../config.js';

const props = defineProps({
  /** Private viewing token from URL */
  token: { type: String, required: true },
});

const emit = defineEmits(['loaded', 'error', 'replay']);

const campaign = getActiveCampaign();

// State
const donor = ref(null);
const loading = ref(true);
const error = ref(null);
const showDetails = ref(false);

// Computed
const displayName = computed(() => {
  if (!donor.value) return '';
  return donor.value.privateDonorName || donor.value.publicDisplayName;
});

const formattedAmount = computed(() => {
  if (!donor.value?.donationAmount) return '';
  const currency = donor.value.currency || '$';
  return `${currency}${donor.value.donationAmount.toLocaleString()}`;
});

const formattedDate = computed(() => {
  if (!donor.value?.donationDate) return '';
  return new Date(donor.value.donationDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

const hasHebrew = computed(() => {
  if (!donor.value) return false;
  return (
    donor.value.hebrewDedication ||
    campaign?.branding?.hebrewTitle ||
    campaign?.copy?.hebrewDonorRevealMessage
  );
});

// Load donor data
async function loadDonor() {
  loading.value = true;
  error.value = null;

  try {
    const result = await fetchDonorByToken(props.token);

    if (!result) {
      error.value = 'This link is invalid or has been revoked.';
      emit('error', error.value);
      return;
    }

    donor.value = result;
    emit('loaded', result);

    // Animate in details after a moment
    setTimeout(() => {
      showDetails.value = true;
    }, 500);
  } catch (e) {
    console.error('[PrivateDonorView] Error:', e);
    error.value =
      'Unable to load your donor information. Please try again later.';
    emit('error', error.value);
  } finally {
    loading.value = false;
  }
}

function handleReplay() {
  emit('replay');
}

onMounted(() => {
  loadDonor();
});
</script>

<template>
  <div class="private-donor-view">
    <!-- Loading state -->
    <div v-if="loading" class="private-donor-view__loading">
      <div class="private-donor-view__spinner"></div>
      <p>Loading your personalized view...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="private-donor-view__error">
      <span class="material-symbols-outlined">error</span>
      <p>{{ error }}</p>
      <a href="/" class="private-donor-view__home-link">Return Home</a>
    </div>

    <!-- Donor details -->
    <Transition v-else name="reveal">
      <div v-if="donor && showDetails" class="private-donor-view__content">
        <!-- Star icon -->
        <div class="private-donor-view__star" :data-tier="donor.starTier"
          >★</div
        >

        <!-- Reveal message -->
        <div class="private-donor-view__reveal">
          <p class="private-donor-view__message">
            {{
              campaign?.copy?.donorRevealMessage ||
              'Thank you for your support.'
            }}
          </p>
          <p
            v-if="campaign?.copy?.hebrewDonorRevealMessage"
            class="private-donor-view__message-hebrew"
            dir="rtl"
          >
            {{ campaign.copy.hebrewDonorRevealMessage }}
          </p>
        </div>

        <!-- Donor name -->
        <h1
          class="private-donor-view__name"
          :dir="displayName.match(/[\u0590-\u05FF]/) ? 'rtl' : 'ltr'"
        >
          {{ displayName }}
        </h1>

        <!-- Donation info -->
        <div class="private-donor-view__donation">
          <span class="private-donor-view__amount">{{ formattedAmount }}</span>
          <span class="private-donor-view__date">{{ formattedDate }}</span>
        </div>

        <!-- Dedication -->
        <div
          v-if="donor.dedication || donor.hebrewDedication"
          class="private-donor-view__dedication"
        >
          <div class="private-donor-view__dedication-divider">✦</div>
          <p
            v-if="donor.dedication"
            class="private-donor-view__dedication-text"
          >
            {{ donor.dedication }}
          </p>
          <p
            v-if="donor.hebrewDedication"
            class="private-donor-view__dedication-hebrew"
            dir="rtl"
          >
            {{ donor.hebrewDedication }}
          </p>
        </div>

        <!-- Actions -->
        <div class="private-donor-view__actions">
          <button class="private-donor-view__replay" @click="handleReplay">
            <span class="material-symbols-outlined">restart_alt</span>
            Replay Your Reveal
          </button>
        </div>

        <!-- Thank you note -->
        <p class="private-donor-view__thanks">
          Thank you for being part of
          {{ campaign?.branding?.organization || 'our mission' }}.
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.private-donor-view {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  pointer-events: none;
  z-index: 200;
}

.private-donor-view > * {
  pointer-events: auto;
}

/* Loading */
.private-donor-view__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.7);
}

.private-donor-view__spinner {
  width: 40px;
  height: 40px;
  border: 2px solid rgba(212, 175, 55, 0.2);
  border-top-color: #d4af37;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Error */
.private-donor-view__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(10, 10, 15, 0.9);
  backdrop-filter: blur(20px);
  padding: 40px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.private-donor-view__error .material-symbols-outlined {
  font-size: 48px;
  color: #ef4444;
}

.private-donor-view__home-link {
  color: #d4af37;
  text-decoration: none;
  padding: 10px 24px;
  border: 1px solid #d4af37;
  border-radius: 24px;
  transition: all 0.2s ease;
}

.private-donor-view__home-link:hover {
  background: rgba(212, 175, 55, 0.1);
}

/* Content */
.private-donor-view__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 500px;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(30px);
  padding: 48px;
  border-radius: 24px;
  border: 1px solid rgba(212, 175, 55, 0.2);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

/* Star */
.private-donor-view__star {
  font-size: 60px;
  color: #d4af37;
  text-shadow: 0 0 40px rgba(212, 175, 55, 0.6);
  animation: starPulse 2s ease-in-out infinite;
  margin-bottom: 24px;
}

.private-donor-view__star[data-tier='4'],
.private-donor-view__star[data-tier='5'] {
  color: #ffd700;
  text-shadow: 0 0 60px rgba(255, 215, 0, 0.8);
}

/* Reveal message */
.private-donor-view__reveal {
  margin-bottom: 24px;
}

.private-donor-view__message {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  font-weight: 300;
}

.private-donor-view__message-hebrew {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.9);
  margin: 8px 0 0;
  font-family: 'Noto Sans Hebrew', sans-serif;
}

/* Name */
.private-donor-view__name {
  font-size: 36px;
  font-weight: 400;
  color: white;
  margin: 0;
  font-family: 'Inter', 'Noto Sans Hebrew', sans-serif;
}

/* Donation info */
.private-donor-view__donation {
  display: flex;
  gap: 16px;
  margin-top: 16px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

.private-donor-view__amount {
  color: #d4af37;
  font-weight: 500;
  font-size: 20px;
}

/* Dedication */
.private-donor-view__dedication {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
}

.private-donor-view__dedication-divider {
  color: #d4af37;
  font-size: 12px;
  margin-bottom: 16px;
}

.private-donor-view__dedication-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
  margin: 0;
}

.private-donor-view__dedication-hebrew {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9);
  margin: 12px 0 0;
  font-family: 'Noto Sans Hebrew', sans-serif;
  line-height: 1.6;
}

/* Actions */
.private-donor-view__actions {
  margin-top: 32px;
}

.private-donor-view__replay {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 24px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.private-donor-view__replay:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.private-donor-view__replay .material-symbols-outlined {
  font-size: 18px;
}

/* Thanks */
.private-donor-view__thanks {
  margin-top: 32px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

/* Animations */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes starPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

.reveal-enter-active {
  animation: revealIn 0.8s ease-out;
}

.reveal-leave-active {
  animation: revealIn 0.5s ease-in reverse;
}

@keyframes revealIn {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .private-donor-view__content {
    padding: 32px 24px;
    margin: 16px;
  }

  .private-donor-view__star {
    font-size: 48px;
  }

  .private-donor-view__name {
    font-size: 28px;
  }

  .private-donor-view__amount {
    font-size: 18px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .private-donor-view__star {
    animation: none;
  }

  .private-donor-view__spinner {
    animation: none;
    border-top-color: transparent;
  }

  .reveal-enter-active,
  .reveal-leave-active {
    animation: none;
  }
}
</style>
