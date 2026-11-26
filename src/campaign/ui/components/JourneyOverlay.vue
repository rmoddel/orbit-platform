<script setup>
/**
 * Journey Overlay Component
 *
 * Displays journey progress, messages, and controls during the visitor experience.
 */

import { computed } from 'vue';
import { useJourneyStore } from '../stores/journey.js';
import { getActiveCampaign } from '../../config.js';

const props = defineProps({
  /** Reduced motion preference */
  reducedMotion: { type: Boolean, default: false },
});

const emit = defineEmits(['skip', 'replay']);

const store = useJourneyStore();
const campaign = getActiveCampaign();

const isActive = computed(() => store.isActive);
const hasArrived = computed(() => store.hasArrived);
const canSkip = computed(() => store.canSkip);
const canReplay = computed(() => store.canReplay);
const progress = computed(() => store.progress);
const message = computed(() => store.message);

const progressPercent = computed(() => Math.round(progress.value * 100));

function handleSkip() {
  emit('skip');
}

function handleReplay() {
  emit('replay');
}
</script>

<template>
  <div
    class="journey-overlay"
    :class="{ 'journey-overlay--active': isActive || hasArrived }"
  >
    <!-- Journey in progress -->
    <Transition name="fade">
      <div v-if="isActive" class="journey-progress">
        <!-- Message -->
        <div v-if="message" class="journey-message">
          <p class="journey-message__text">{{ message }}</p>
          <p
            v-if="campaign?.copy?.hebrewJourneyMessage"
            class="journey-message__hebrew"
            dir="rtl"
          >
            {{ campaign.copy.hebrewJourneyMessage }}
          </p>
        </div>

        <!-- Progress bar -->
        <div class="journey-progress__bar">
          <div
            class="journey-progress__fill"
            :style="{ width: `${progressPercent}%` }"
            :class="{ 'journey-progress__fill--reduced': reducedMotion }"
          ></div>
        </div>

        <!-- Skip button -->
        <button v-if="canSkip" class="journey-skip" @click="handleSkip">
          Skip Journey
          <span class="material-symbols-outlined">skip_next</span>
        </button>
      </div>
    </Transition>

    <!-- Arrived state -->
    <Transition name="fade">
      <div v-if="hasArrived && !isActive" class="journey-arrived">
        <!-- Campaign title -->
        <h1 class="journey-arrived__title">
          {{ campaign?.branding?.title || 'Welcome' }}
        </h1>
        <p
          v-if="campaign?.branding?.hebrewTitle"
          class="journey-arrived__hebrew"
          dir="rtl"
        >
          {{ campaign.branding.hebrewTitle }}
        </p>

        <!-- Tagline -->
        <p class="journey-arrived__tagline">
          {{ campaign?.branding?.tagline || campaign?.copy?.arrivalMessage }}
        </p>

        <!-- Action buttons -->
        <div class="journey-arrived__actions">
          <a
            v-if="campaign?.settings?.donationUrl"
            :href="campaign.settings.donationUrl"
            target="_blank"
            rel="noopener"
            class="journey-arrived__donate"
          >
            {{ campaign?.copy?.donateButtonText || 'Support Now' }}
          </a>

          <button
            v-if="canReplay"
            class="journey-arrived__replay"
            @click="handleReplay"
          >
            <span class="material-symbols-outlined">restart_alt</span>
            Replay Journey
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.journey-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 24px;
  z-index: 150;
}

/* Journey in progress */
.journey-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  margin-bottom: 60px;
  pointer-events: auto;
}

.journey-message {
  text-align: center;
  animation: fadeIn 0.5s ease-out;
}

.journey-message__text {
  font-size: 24px;
  font-weight: 300;
  color: white;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.8);
  margin: 0;
  font-family: 'Inter', sans-serif;
}

.journey-message__hebrew {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.8);
  margin: 8px 0 0;
  font-family: 'Noto Sans Hebrew', sans-serif;
}

/* Progress bar */
.journey-progress__bar {
  width: 200px;
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.journey-progress__fill {
  height: 100%;
  background: linear-gradient(90deg, #d4af37, #ffd700);
  transition: width 0.3s ease-out;
  box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
}

.journey-progress__fill--reduced {
  transition: width 0.1s linear;
}

/* Skip button */
.journey-skip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 24px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.journey-skip:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
}

.journey-skip .material-symbols-outlined {
  font-size: 18px;
}

/* Arrived state */
.journey-arrived {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 60px;
  pointer-events: auto;
  animation: arrivalFadeIn 1s ease-out;
}

.journey-arrived__title {
  font-size: 48px;
  font-weight: 300;
  color: #d4af37;
  text-shadow: 0 4px 30px rgba(212, 175, 55, 0.4);
  margin: 0;
  font-family: 'Inter', sans-serif;
  letter-spacing: 2px;
}

.journey-arrived__hebrew {
  font-size: 36px;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.8);
  margin: 12px 0 0;
  font-family: 'Noto Sans Hebrew', sans-serif;
}

.journey-arrived__tagline {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.7);
  margin: 20px 0 0;
  font-weight: 300;
}

.journey-arrived__actions {
  display: flex;
  gap: 16px;
  margin-top: 32px;
}

.journey-arrived__donate {
  padding: 14px 32px;
  background: linear-gradient(135deg, #d4af37, #b8860b);
  border: none;
  border-radius: 8px;
  color: #0a0a0f;
  font-weight: 600;
  font-size: 16px;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.journey-arrived__donate:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
}

.journey-arrived__replay {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.journey-arrived__replay:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.journey-arrived__replay .material-symbols-outlined {
  font-size: 20px;
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes arrivalFadeIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .journey-arrived__title {
    font-size: 32px;
  }

  .journey-arrived__hebrew {
    font-size: 24px;
  }

  .journey-arrived__tagline {
    font-size: 14px;
  }

  .journey-arrived__actions {
    flex-direction: column;
  }

  .journey-message__text {
    font-size: 18px;
  }

  .journey-message__hebrew {
    font-size: 16px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .journey-arrived,
  .journey-message {
    animation: none;
  }

  .journey-progress__fill {
    transition: none;
  }
}
</style>
