/**
 * Donor Stars Visualization
 *
 * Renders donor stars as a constellation around the campaign destination.
 * Uses CesiumJS primitives for efficient rendering of 200+ donors.
 */

import { getActiveCampaign } from '../config.js';

/** Star tier configurations */
const STAR_TIERS = {
  1: { size: 8, color: [255, 215, 0, 200], altitude: 500 }, // Basic gold
  2: { size: 10, color: [255, 215, 0, 220], altitude: 600 }, // Brighter
  3: { size: 12, color: [255, 223, 0, 240], altitude: 700 }, // Larger
  4: { size: 16, color: [255, 235, 100, 250], altitude: 800 }, // Premium
  5: { size: 20, color: [255, 245, 150, 255], altitude: 1000 }, // Flagship
};

/** Default star configuration */
const DEFAULT_STAR = STAR_TIERS[1];

/**
 * @typedef {Object} DonorStar
 * @property {string} donorId
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} altitude
 * @property {number} tier
 * @property {boolean} isHighlighted
 */

/**
 * Create a donor stars layer.
 *
 * @param {Object} options
 * @param {Object} options.viewer - Cesium viewer
 * @param {Object} options.Cesium - Cesium module
 * @returns {Object} Stars layer controller
 */
export function createDonorStarsLayer({ viewer, Cesium }) {
  const campaign = getActiveCampaign();
  const destination = campaign?.destination || {
    latitude: 40.0795,
    longitude: -74.2179,
  };

  // Point primitive collection for efficient rendering
  let pointCollection = null;
  let pointMap = new Map(); // donorId -> point index
  let highlightedId = null;
  let disposed = false;

  // Pulsing animation state
  let pulsePhase = 0;
  let animationFrame = null;

  /**
   * Initialize the layer.
   */
  function initialize() {
    if (disposed) return;

    pointCollection = new Cesium.PointPrimitiveCollection();
    viewer.scene.primitives.add(pointCollection);

    // Start pulse animation
    startPulseAnimation();
  }

  /**
   * Update stars with new donor data.
   *
   * @param {Array} donors - Array of PublicDonor objects
   */
  function updateStars(donors) {
    if (disposed || !pointCollection) return;

    // Clear existing points
    pointCollection.removeAll();
    pointMap.clear();

    // Add new points
    donors.forEach((donor, index) => {
      const tier = STAR_TIERS[donor.starTier] || DEFAULT_STAR;

      const lat = destination.latitude + (donor.starOffsetLat || 0);
      const lon = destination.longitude + (donor.starOffsetLon || 0);

      const position = Cesium.Cartesian3.fromDegrees(lon, lat, tier.altitude);

      const point = pointCollection.add({
        position,
        pixelSize: tier.size,
        color: Cesium.Color.fromBytes(...tier.color),
        outlineColor: Cesium.Color.fromBytes(255, 255, 255, 100),
        outlineWidth: 1,
        scaleByDistance: new Cesium.NearFarScalar(1000, 2, 50000, 0.5),
        translucencyByDistance: new Cesium.NearFarScalar(1000, 1, 100000, 0.3),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        id: { type: 'donor-star', donorId: donor.id },
      });

      pointMap.set(donor.id, { point, tier, originalSize: tier.size });
    });

    viewer.scene.requestRender();
  }

  /**
   * Highlight a specific donor's star.
   *
   * @param {string | null} donorId - Donor ID to highlight, or null to clear
   */
  function highlightStar(donorId) {
    // Reset previous highlight
    if (highlightedId && pointMap.has(highlightedId)) {
      const prev = pointMap.get(highlightedId);
      prev.point.pixelSize = prev.originalSize;
      prev.point.outlineWidth = 1;
    }

    highlightedId = donorId;

    // Apply new highlight
    if (donorId && pointMap.has(donorId)) {
      const current = pointMap.get(donorId);
      current.point.pixelSize = current.originalSize * 2;
      current.point.outlineWidth = 3;
      current.point.outlineColor = Cesium.Color.WHITE;
    }

    viewer.scene.requestRender();
  }

  /**
   * Fly camera to focus on a donor's star.
   *
   * @param {string} donorId
   * @param {Object} [options]
   */
  async function flyToStar(donorId, options = {}) {
    if (!pointMap.has(donorId)) return;

    const { point, tier } = pointMap.get(donorId);
    const position = point.position;

    // Convert to cartographic for the destination
    const cartographic = Cesium.Cartographic.fromCartesian(position);

    return new Promise((resolve) => {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          options.altitude || 2000,
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
        duration: options.duration || 2,
        complete: () => {
          highlightStar(donorId);
          resolve();
        },
      });
    });
  }

  /**
   * Get the star position for a donor.
   *
   * @param {string} donorId
   * @returns {Object | null} Position in degrees
   */
  function getStarPosition(donorId) {
    if (!pointMap.has(donorId)) return null;

    const { point } = pointMap.get(donorId);
    const cartographic = Cesium.Cartographic.fromCartesian(point.position);

    return {
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      altitude: cartographic.height,
    };
  }

  /**
   * Start the pulsing animation for stars.
   */
  function startPulseAnimation() {
    if (disposed) return;

    const animate = () => {
      if (disposed) return;

      pulsePhase += 0.03;
      const pulse = Math.sin(pulsePhase) * 0.15 + 1;

      // Apply pulse to highlighted star
      if (highlightedId && pointMap.has(highlightedId)) {
        const { point, originalSize } = pointMap.get(highlightedId);
        point.pixelSize = originalSize * 2 * pulse;
      }

      viewer.scene.requestRender();
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Handle click on a star.
   *
   * @param {function(string): void} callback - Called with donor ID
   * @returns {function(): void} Remove handler
   */
  function onStarClick(callback) {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((event) => {
      const pickedObject = viewer.scene.pick(event.position);
      if (
        Cesium.defined(pickedObject) &&
        pickedObject.id?.type === 'donor-star'
      ) {
        callback(pickedObject.id.donorId);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => handler.destroy();
  }

  /**
   * Clean up resources.
   */
  function dispose() {
    disposed = true;

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }

    if (pointCollection) {
      viewer.scene.primitives.remove(pointCollection);
    }

    pointMap.clear();
  }

  // Initialize
  initialize();

  return {
    updateStars,
    highlightStar,
    flyToStar,
    getStarPosition,
    onStarClick,
    dispose,
    get highlightedId() {
      return highlightedId;
    },
  };
}

/**
 * Create a golden destination marker.
 *
 * @param {Object} options
 * @param {Object} options.viewer - Cesium viewer
 * @param {Object} options.Cesium - Cesium module
 * @returns {Object} Marker controller
 */
export function createDestinationMarker({ viewer, Cesium }) {
  const campaign = getActiveCampaign();
  const destination = campaign?.destination || {
    latitude: 40.0795,
    longitude: -74.2179,
  };

  let entity = null;
  let disposed = false;

  /**
   * Show the destination marker.
   */
  function show() {
    if (disposed || entity) return;

    entity = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        destination.longitude,
        destination.latitude,
        100,
      ),
      point: {
        pixelSize: 15,
        color: Cesium.Color.fromCssColorString('#D4AF37'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: destination.name || campaign?.branding?.title || 'Destination',
        font: '16px Inter, sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1000, 1, 50000, 0.4),
      },
      id: { type: 'destination-marker' },
    });

    viewer.scene.requestRender();
  }

  /**
   * Hide the destination marker.
   */
  function hide() {
    if (entity) {
      viewer.entities.remove(entity);
      entity = null;
    }
  }

  /**
   * Fly to the destination.
   */
  async function flyTo(options = {}) {
    return new Promise((resolve) => {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          destination.longitude,
          destination.latitude,
          options.altitude || 1500,
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
        duration: options.duration || 2,
        complete: resolve,
      });
    });
  }

  /**
   * Clean up.
   */
  function dispose() {
    disposed = true;
    hide();
  }

  return {
    show,
    hide,
    flyTo,
    dispose,
  };
}
