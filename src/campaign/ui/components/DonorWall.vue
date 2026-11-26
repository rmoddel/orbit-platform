<script setup>
/**
 * Donor Wall Component
 *
 * Displays a list of campaign supporters.
 * - Desktop: Side panel
 * - Mobile: Bottom sheet
 */

import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useDonorsStore } from '../stores/donors.js';
import { getActiveCampaign } from '../../config.js';

const props = defineProps({
  /** Whether to use mobile bottom sheet layout */
  mobile: { type: Boolean, default: false },
});

const emit = defineEmits(['select-donor', 'close']);

const store = useDonorsStore();
const campaign = getActiveCampaign();

// Touch handling for bottom sheet
const sheetRef = ref(null);
const startY = ref(0);
const currentY = ref(0);
const isDragging = ref(false);

const donors = computed(() => store.recentDonors);
const isExpanded = computed(() => store.isWallExpanded);
const selectedId = computed(() => store.selectedDonorId);

// Format date for display
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format donation amount
function formatAmount(amount, currency = '$') {
  if (!amount) return '';
  return `${currency}${amount.toLocaleString()}`;
}

// Handle donor selection
function selectDonor(donor) {
  store.selectDonor(donor.id);
  emit('select-donor', donor);
}

// Bottom sheet touch handlers
function onTouchStart(e) {
  if (!props.mobile) return;
  startY.value = e.touches[0].clientY;
  isDragging.value = true;
}

function onTouchMove(e) {
  if (!isDragging.value) return;
  currentY.value = e.touches[0].clientY - startY.value;
}

function onTouchEnd() {
  if (!isDragging.value) return;
  isDragging.value = false;

  // If dragged down significantly, collapse
  if (currentY.value > 100) {
    store.collapseWall();
  }
  // If dragged up, expand
  else if (currentY.value < -50) {
    store.expandWall();
  }

  currentY.value = 0;
}

function toggleExpanded() {
  if (isExpanded.value) {
    store.collapseWall();
  } else {
    store.expandWall();
  }
}

onMounted(() => {
  store.loadDonors();
  store.startSubscription();
});

onUnmounted(() => {
  store.stopSubscription();
});
</script>

<template>
  <div
    ref="sheetRef"
    :class="[
      'donor-wall',
      {
        'donor-wall--mobile': mobile,
        'donor-wall--expanded': isExpanded,
        'donor-wall--dragging': isDragging,
      },
    ]"
    :style="
      isDragging ? { transform: `translateY(${Math.max(0, currentY)}px)` } : {}
    "
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- Header -->
    <div class="donor-wall__header" @click="mobile ? toggleExpanded() : null">
      <div v-if="mobile" class="donor-wall__handle"></div>
      <h2 class="donor-wall__title">
        {{ campaign?.branding?.title || 'Our Supporters' }}
      </h2>
      <span class="donor-wall__count">{{ donors.length }} supporters</span>
      <button v-if="!mobile" class="donor-wall__close" @click="emit('close')">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>

    <!-- Demo notice -->
    <div v-if="store.demoDonorsCount > 0" class="donor-wall__demo-notice">
      <span class="material-symbols-outlined">info</span>
      Demo data shown. Remove before launch.
    </div>

    <!-- Donor list -->
    <div class="donor-wall__list">
      <div
        v-for="donor in donors"
        :key="donor.id"
        :class="[
          'donor-wall__item',
          {
            'donor-wall__item--selected': selectedId === donor.id,
            'donor-wall__item--demo': donor.isDemo,
            'donor-wall__item--anonymous': donor.isAnonymous,
          },
        ]"
        @click="selectDonor(donor)"
      >
        <div class="donor-wall__star" :data-tier="donor.starTier">★</div>
        <div class="donor-wall__info">
          <div
            class="donor-wall__name"
            :dir="donor.displayName?.match(/[\u0590-\u05FF]/) ? 'rtl' : 'ltr'"
          >
            {{ donor.displayName }}
          </div>
          <div class="donor-wall__meta">
            <span class="donor-wall__date">{{
              formatDate(donor.donationDate)
            }}</span>
            <span v-if="donor.donationAmount" class="donor-wall__amount">
              {{ formatAmount(donor.donationAmount, donor.currency) }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="donors.length === 0" class="donor-wall__empty">
        <span class="material-symbols-outlined">star</span>
        <p>Be the first to support!</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="donor-wall__footer">
      <a
        v-if="campaign?.settings?.donationUrl"
        :href="campaign.settings.donationUrl"
        target="_blank"
        rel="noopener"
        class="donor-wall__donate-btn"
      >
        {{ campaign?.copy?.donateButtonText || 'Support Now' }}
      </a>
    </div>
  </div>
</template>

<style scoped>
.donor-wall {
  display: flex;
  flex-direction: column;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(212, 175, 55, 0.2);
  color: white;
  font-family: 'Inter', sans-serif;
  overflow: hidden;
}

/* Desktop layout */
.donor-wall:not(.donor-wall--mobile) {
  position: fixed;
  top: 0;
  right: 0;
  width: 320px;
  height: 100vh;
  z-index: 100;
}

/* Mobile bottom sheet */
.donor-wall--mobile {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40vh;
  border-radius: 20px 20px 0 0;
  border-left: none;
  border-top: 1px solid rgba(212, 175, 55, 0.3);
  transition:
    height 0.3s ease-out,
    transform 0.3s ease-out;
  z-index: 200;
}

.donor-wall--mobile.donor-wall--expanded {
  height: 70vh;
}

.donor-wall--mobile.donor-wall--dragging {
  transition: none;
}

/* Handle for mobile */
.donor-wall__handle {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  margin: 8px auto;
}

/* Header */
.donor-wall__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.donor-wall__title {
  font-size: 18px;
  font-weight: 500;
  color: #d4af37;
  margin: 0;
}

.donor-wall__count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}

.donor-wall__close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 4px;
}

.donor-wall__close:hover {
  color: white;
}

/* Demo notice */
.donor-wall__demo-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 193, 7, 0.1);
  border-bottom: 1px solid rgba(255, 193, 7, 0.2);
  font-size: 11px;
  color: #ffc107;
}

.donor-wall__demo-notice .material-symbols-outlined {
  font-size: 14px;
}

/* Donor list */
.donor-wall__list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.donor-wall__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.donor-wall__item:hover {
  background: rgba(212, 175, 55, 0.1);
}

.donor-wall__item--selected {
  background: rgba(212, 175, 55, 0.2);
}

.donor-wall__item--demo {
  opacity: 0.7;
}

/* Star icon */
.donor-wall__star {
  font-size: 20px;
  color: #d4af37;
  text-shadow: 0 0 8px rgba(212, 175, 55, 0.5);
}

.donor-wall__star[data-tier='2'] {
  font-size: 22px;
}
.donor-wall__star[data-tier='3'] {
  font-size: 24px;
}
.donor-wall__star[data-tier='4'] {
  font-size: 26px;
  color: #ffd700;
}
.donor-wall__star[data-tier='5'] {
  font-size: 28px;
  color: #fff5cc;
  text-shadow: 0 0 12px rgba(255, 215, 0, 0.8);
}

/* Donor info */
.donor-wall__info {
  flex: 1;
  min-width: 0;
}

.donor-wall__name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.donor-wall__item--anonymous .donor-wall__name {
  font-style: italic;
  color: rgba(255, 255, 255, 0.7);
}

.donor-wall__meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
}

.donor-wall__amount {
  color: #d4af37;
}

/* Empty state */
.donor-wall__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

.donor-wall__empty .material-symbols-outlined {
  font-size: 48px;
  color: #d4af37;
  margin-bottom: 16px;
}

/* Footer */
.donor-wall__footer {
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.donor-wall__donate-btn {
  display: block;
  width: 100%;
  padding: 12px 24px;
  background: linear-gradient(135deg, #d4af37, #b8860b);
  border: none;
  border-radius: 8px;
  color: #0a0a0f;
  font-weight: 600;
  font-size: 14px;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.donor-wall__donate-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
}

/* Scrollbar styling */
.donor-wall__list::-webkit-scrollbar {
  width: 6px;
}

.donor-wall__list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.donor-wall__list::-webkit-scrollbar-thumb {
  background: rgba(212, 175, 55, 0.3);
  border-radius: 3px;
}

.donor-wall__list::-webkit-scrollbar-thumb:hover {
  background: rgba(212, 175, 55, 0.5);
}

/* Hebrew/RTL support */
[dir='rtl'] {
  font-family: 'Noto Sans Hebrew', 'Inter', sans-serif;
}
</style>
