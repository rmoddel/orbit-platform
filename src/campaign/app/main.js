/**
 * Orbit Platform - Campaign Application Entry Point
 *
 * This is the main entry point for the donor recognition platform.
 * It initializes the CesiumJS globe and campaign experience.
 */

import { createApp, ref, computed, onMounted, onUnmounted } from 'vue';
import { createPinia } from 'pinia';

// Campaign configuration
import { setActiveCampaign, getActiveCampaign } from '../config.js';
import '../campaigns/toras-zev.js'; // Register campaign

// Journey
import {
  createJourneyController,
  JourneyState,
} from '../journey/controller.js';

// Donors
import {
  initializeSupabase,
  createDonorStarsLayer,
  createDestinationMarker,
  fetchDonorByToken,
} from '../donors/index.js';

// UI Components
import DonorWall from '../ui/components/DonorWall.vue';
import JourneyOverlay from '../ui/components/JourneyOverlay.vue';
import PrivateDonorView from '../ui/components/PrivateDonorView.vue';

// Stores
import { useDonorsStore } from '../ui/stores/donors.js';
import { useJourneyStore } from '../ui/stores/journey.js';

/**
 * Main application component
 */
const CampaignApp = {
  components: {
    DonorWall,
    JourneyOverlay,
    PrivateDonorView,
  },

  setup() {
    const donorsStore = useDonorsStore();
    const journeyStore = useJourneyStore();

    // State
    const isReady = ref(false);
    const isMobile = ref(window.innerWidth < 768);
    const privateToken = ref(null);
    const showPrivateView = ref(false);
    const reducedMotion = ref(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    // References
    let viewer = null;
    let journeyController = null;
    let starsLayer = null;
    let destinationMarker = null;
    let Cesium = null;

    // Check for private token in URL
    function checkPrivateToken() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || params.get('t');
      if (token) {
        privateToken.value = token;
        showPrivateView.value = true;
      }
    }

    // Initialize Cesium and campaign
    async function initialize() {
      try {
        // Load Cesium
        Cesium = await import('cesium');

        // Initialize viewer
        const container = document.getElementById('cesiumContainer');
        if (!container) {
          throw new Error('Cesium container not found');
        }

        viewer = new Cesium.Viewer(container, {
          timeline: false,
          animation: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          vrButton: false,
          selectionIndicator: false,
          infoBox: false,
          creditContainer: document.createElement('div'),
          skyBox: false,
          skyAtmosphere: new Cesium.SkyAtmosphere(),
          contextOptions: {
            webgl: { preserveDrawingBuffer: true },
          },
        });

        // Dark globe styling
        viewer.scene.globe.baseColor =
          Cesium.Color.fromCssColorString('#0a0a0f');
        viewer.scene.backgroundColor =
          Cesium.Color.fromCssColorString('#0a0a0f');

        // Add imagery
        viewer.imageryLayers.addImageryProvider(
          new Cesium.IonImageryProvider({ assetId: 3 }), // Bing Maps
        );

        // Initialize stars layer
        starsLayer = createDonorStarsLayer({ viewer, Cesium });

        // Initialize destination marker
        destinationMarker = createDestinationMarker({ viewer, Cesium });

        // Initialize journey controller
        journeyController = createJourneyController({
          camera: createCameraAdapter(viewer, Cesium),
          scene: viewer.scene,
          onMessage: (msg) => journeyStore.setMessage(msg),
          onProgress: (p) => journeyStore.setProgress(p),
        });

        // Subscribe to journey state changes
        journeyController.onStateChange((state) => {
          journeyStore.setState(state);

          // Show destination marker and stars on arrival
          if (
            state === JourneyState.ARRIVED ||
            state === JourneyState.SKIPPED
          ) {
            destinationMarker.show();
            donorsStore.loadDonors().then(() => {
              starsLayer.updateStars(donorsStore.donors);
            });
          }
        });

        // Handle star clicks
        starsLayer.onStarClick((donorId) => {
          donorsStore.selectDonor(donorId);
          starsLayer.highlightStar(donorId);
        });

        isReady.value = true;

        // Start journey or show private view
        if (showPrivateView.value) {
          // Skip to destination for private view
          journeyController.skip();
        } else {
          // Start the journey
          journeyController.start();
        }
      } catch (error) {
        console.error('[CampaignApp] Initialization failed:', error);
        // Show fallback
        document
          .getElementById('loading-screen')
          .querySelector('.loader-status').textContent =
          'Unable to load 3D experience. Please refresh or try a different browser.';
      }
    }

    // Create camera adapter for journey controller
    function createCameraAdapter(viewer, Cesium) {
      return {
        setView(spec) {
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
              spec.destination.x,
              spec.destination.y,
              spec.destination.z,
            ),
            orientation: spec.orientation,
          });
        },
        flyTo(destination, options = {}) {
          return new Promise((resolve, reject) => {
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(
                destination.x,
                destination.y,
                destination.z,
              ),
              orientation: options.orientation,
              duration: options.durationS || 2,
              complete: () => {
                options.onComplete?.();
                resolve('complete');
              },
              cancel: () => {
                options.onCancel?.();
                reject(new Error('Flight cancelled'));
              },
            });

            return {
              cancel: () => viewer.camera.cancelFlight(),
            };
          });
        },
      };
    }

    // Event handlers
    function handleSkip() {
      journeyController?.skip();
    }

    function handleReplay() {
      journeyController?.replay();
    }

    function handleDonorSelect(donor) {
      if (starsLayer) {
        starsLayer.flyToStar(donor.id);
      }
    }

    function handlePrivateViewLoaded(donor) {
      if (starsLayer) {
        starsLayer.highlightStar(donor.id);
      }
    }

    function handleResize() {
      isMobile.value = window.innerWidth < 768;
    }

    // Lifecycle
    onMounted(() => {
      checkPrivateToken();
      setActiveCampaign('toras-zev');

      // Initialize Supabase if configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        initializeSupabase({ url: supabaseUrl, anonKey: supabaseKey });
      }

      initialize();
      window.addEventListener('resize', handleResize);
    });

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
      journeyController?.dispose();
      starsLayer?.dispose();
      destinationMarker?.dispose();
      viewer?.destroy();
    });

    return {
      isReady,
      isMobile,
      privateToken,
      showPrivateView,
      reducedMotion,
      journeyStore,
      donorsStore,
      handleSkip,
      handleReplay,
      handleDonorSelect,
      handlePrivateViewLoaded,
    };
  },

  template: `
    <div class="campaign-app">
      <!-- Journey Overlay -->
      <JourneyOverlay
        :reduced-motion="reducedMotion"
        @skip="handleSkip"
        @replay="handleReplay"
      />

      <!-- Donor Wall (shown after arrival) -->
      <DonorWall
        v-if="journeyStore.hasArrived && !showPrivateView"
        :mobile="isMobile"
        @select-donor="handleDonorSelect"
      />

      <!-- Private Donor View (for token links) -->
      <PrivateDonorView
        v-if="showPrivateView && privateToken"
        :token="privateToken"
        @loaded="handlePrivateViewLoaded"
        @replay="handleReplay"
      />
    </div>
  `,
};

/**
 * Initialize the campaign application
 */
export function createCampaignApplication() {
  const app = createApp(CampaignApp);
  const pinia = createPinia();

  app.use(pinia);

  return {
    mount(selector = '#app') {
      app.mount(selector);
    },
    unmount() {
      app.unmount();
    },
  };
}

// Auto-start if this is the main entry
if (import.meta.env.MODE !== 'test') {
  // Hide loading screen once Vue is ready
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }

  const campaignApp = createCampaignApplication();
  campaignApp.mount('#app');
}
