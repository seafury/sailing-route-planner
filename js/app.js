// ── Configuration ──────────────────────────────────────────────────────
// Toggle data sources here. All are free / no-key-required endpoints.

// ── Marine & Tide Fetch Module ──────────────────────────────────────────
// All API calls go through a single gateway function so you can swap
// providers later without touching the rest of the codebase.

async function fetchMarineData({ lat, lon, days = 3 }) {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'wave_height,wave_direction,wind_wave_height,swell_wave_height,wave_period,wind_speed_10m',
    daily: 'wave_height_max,wave_direction_dominant,swell_wave_height_max,swell_wave_period_max',
    timezone: 'Africa/Johannesburg',
    start_date: today,
    end_date: end,
  });

  const resp = await fetch(`${CONFIG.marineApi}?${params}`);
  if (!resp.ok) throw new Error(`Marine API error: ${resp.status}`);
  return resp.json();
}

async function fetchTides({ lat, lon }) {
  // Fallback: parse tide-forecast.com for Cape Town
  // Primary: use Open-Meteo's free tide model (no key)
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    timezone: 'Africa/Johannesburg',
  });

  try {
    const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=Cape+Town&count=1&language=en&format=json`);
    if (resp.ok) {
      const geo = await resp.json();
      if (geo.results?.[0]) {
        params.set('latitude', geo.results[0].latitude);
        params.set('longitude', geo.results[0].longitude);
      }
    }
  } catch (_) { /* use default coords */ }

  // Note: Open-Meteo has a tide endpoint but it's behind a paid tier for some params.
  // For now, we fall back to scraping tide-forecast.com via a CORS proxy or
  // a simple serverless function you can deploy.
  console.log('Tide fetch needs a server-side proxy — see README for setup');
  return null;
}

// ── Waypoint & Route Manager ────────────────────────────────────────────

/**
 * Custom Leaflet Routing Machine router that calculates a direct (straight line)
 * route between waypoints. This is more appropriate for maritime navigation
 * in open water than road-based routing like OSRM.
 */
const DirectRouter = {
  route: function(waypoints, callback, context) {
    const routeWaypoints = waypoints.map(wp => ({
      latLng: L.latLng(wp.latLng),
      name: wp.name || '',
    }));

    const coordinates = routeWaypoints.map(wp => wp.latLng);

    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      totalDistance += coordinates[i].distanceTo(coordinates[i + 1]);
    }

    const routes = [{
      name: 'Direct Route',
      summary: {
        totalDistance: totalDistance,
        totalTime: 0,
      },
      coordinates: coordinates,
      waypoints: routeWaypoints,
      inputWaypoints: routeWaypoints,
      instructions: [],
    }];

    callback.call(context, null, routes);
  },
};

class RouteManager {
  constructor(map) {
    this.map = map;
    this.waypoints = [];
    this.routeLine = null;
    this.waypointLinks = [];
    this.waypointArrows = [];
    this.markers = [];
    this.routingControl = null;
    this.lastDistanceNm = null;
    this.hasEnd = false;
  }

  calculateTotalDistance() {
    if (this.waypoints.length < 2) return 0;
    let totalMeters = 0;
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      totalMeters += this.waypoints[i].distanceTo(this.waypoints[i + 1]);
    }
    return this.metersToNauticalMiles(totalMeters);
  }

  metersToNauticalMiles(meters) {
    return meters / 1852;
  }

  formatDuration(totalHours) {
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    if (minutes === 60) return `${hours + 1}h 00m`;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  formatArrivalTime(totalHours) {
    const arrival = new Date(Date.now() + totalHours * 3600000);
    return arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  renderPlanningDetails(distanceNm) {
    if (distanceNm === undefined) {
      distanceNm = this.calculateTotalDistance();
    }
    this.lastDistanceNm = distanceNm;

    const durationHours = distanceNm / CONFIG.planningSpeedKnots;
    document.getElementById('route-summary').innerHTML = `
      <div class="route-card">
        <p><strong>Distance:</strong> ${distanceNm.toFixed(2)} nm</p>
        <p><strong>Planning Speed:</strong> ${CONFIG.planningSpeedKnots.toFixed(1)} kn</p>
        <p><strong>Duration:</strong> ${this.formatDuration(durationHours)}</p>
        <p><strong>ETA:</strong> ${this.formatArrivalTime(durationHours)}</p>
        <p><strong>Waypoints:</strong> ${this.waypoints.length}</p>
      </div>
    `;
  }

  calculateBearingDegrees(from, to) {
    const fromLat = (from.lat * Math.PI) / 180;
    const fromLng = (from.lng * Math.PI) / 180;
    const toLat = (to.lat * Math.PI) / 180;
    const toLng = (to.lng * Math.PI) / 180;
    const deltaLng = toLng - fromLng;

    const y = Math.sin(deltaLng) * Math.cos(toLat);
    const x = (Math.cos(fromLat) * Math.sin(toLat))
      - (Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng));
    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
  }

  addWaypoint(latlng, mode = 'between') {
    if (mode === 'start') {
      if (this.waypoints.length > 0) {
        this.waypoints[0] = latlng;
      } else {
        this.waypoints.push(latlng);
      }
    } else if (mode === 'end') {
      if (this.hasEnd && this.waypoints.length > 0) {
        this.waypoints[this.waypoints.length - 1] = latlng;
      } else {
        this.waypoints.push(latlng);
        this.hasEnd = true;
      }
    } else { // 'between'
      if (this.hasEnd && this.waypoints.length > 1) {
        // Insert before the end waypoint
        this.waypoints.splice(this.waypoints.length - 1, 0, latlng);
      } else {
        this.waypoints.push(latlng);
      }
    }
    this.redraw();
  }

  redraw() {
    // Clear existing visuals
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];
    this.waypointLinks.forEach(l => this.map.removeLayer(l));
    this.waypointLinks = [];
    this.waypointArrows.forEach(a => this.map.removeLayer(a));
    this.waypointArrows = [];

    // Redraw all waypoints
    this.waypoints.forEach((latlng, idx) => {
      const marker = L.marker(latlng, {
        icon: L.divIcon({
          className: 'waypoint-label',
          html: String.fromCharCode(65 + idx), // A, B, C...
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(this.map);
      this.markers.push(marker);

      // Draw direct visual link from the previous waypoint to this one.
      if (idx > 0) {
        const prev = this.waypoints[idx - 1];
        const link = L.polyline([prev, latlng], {
          color: CONFIG.waypointLinkColor,
          weight: 3,
          opacity: 0.9,
        }).addTo(this.map);
        this.waypointLinks.push(link);

        const midpoint = L.latLng(
          (prev.lat + latlng.lat) / 2,
          (prev.lng + latlng.lng) / 2
        );
        const bearing = this.calculateBearingDegrees(prev, latlng);
        const bearingTrue = Math.round(bearing);
        const cssRotation = bearing - 90;
        const arrow = L.marker(midpoint, {
          icon: L.divIcon({
            className: 'waypoint-link-arrow',
            html: `<div style="color:${CONFIG.waypointLinkColor};font-size:18px;line-height:1;transform:rotate(${cssRotation}deg);">➤</div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        }).addTo(this.map);
        arrow.bindTooltip(`${bearingTrue}°T`, {
          permanent: true,
          direction: 'top',
          offset: [0, -10],
          className: 'bearing-tooltip',
        });
        this.waypointArrows.push(arrow);
      }
    });

    if (this.waypoints.length >= 2) {
      this.calculateRoute();
    } else if (this.waypoints.length < 2) {
      // Clear route line if fewer than 2 waypoints
      if (this.routingControl) {
        this.map.removeControl(this.routingControl);
        this.routingControl = null;
      }
      document.getElementById('route-summary').innerHTML =
        '<p class="muted">Click the map to set waypoints.</p>';
    }
  }

  calculateRoute() {
    // We use a custom DirectRouter for maritime-friendly straight lines,
    // instead of road-based engines like OSRM.
    if (this.routingControl) {
      this.map.removeControl(this.routingControl);
    }

    this.routingControl = L.Routing.control({
      waypoints: this.waypoints.map(w => L.latLng(w)),
      router: DirectRouter,
      lineOptions: {
        styles: [{ color: CONFIG.routeColor, weight: CONFIG.routeWeight, opacity: 0.8 }],
        extendToWaypoints: false, // Remove grey dashed connectors to snapped road points.
      },
      show: false,
      addWaypoints: false,
      fitSelectedRoutes: false, // Keep user-controlled viewport; do not auto-zoom/pan.
    });

    this.routingControl.on('routesfound', (e) => {
      const route = e.routes[0];
      const distanceNm = this.metersToNauticalMiles(route.summary.totalDistance);
      this.lastDistanceNm = distanceNm;
      this.renderPlanningDetails(distanceNm);
    });

    this.routingControl.addTo(this.map);
  }

  clear() {
    this.waypoints = [];
    this.hasEnd = false;
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];
    this.waypointLinks.forEach(l => this.map.removeLayer(l));
    this.waypointLinks = [];
    this.waypointArrows.forEach(a => this.map.removeLayer(a));
    this.waypointArrows = [];
    if (this.routingControl) {
      this.map.removeControl(this.routingControl);
      this.routingControl = null;
    }
    document.getElementById('route-summary').innerHTML =
      '<p class="muted">Click the map to set waypoints.</p>';
    document.getElementById('route-marine').innerHTML = '';
  }
}

// ── Map Init ────────────────────────────────────────────────────────────

// ── Map & Layer Initialization ──────────────────────────────────────────
const map = L.map('map', {
  ...CONFIG.map,
  zoomControl: false // Moved to allow custom positioning if needed
});

// 1. Base Layers
const baseLayers = {
  "Nautical Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: CONFIG.map.maxZoom
  }),
  "Standard Chart": L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: CONFIG.map.maxZoom
  }),
  "Satellite Imagery": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
  })
};

// 2. Overlays
const overlays = {
  "Seamarks (Buoys/Lights)": L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
    attribution: 'Seamarks: &copy; OpenSeaMap contributors',
    maxZoom: CONFIG.map.maxZoom
  })
};

// Add default layers
baseLayers["Nautical Dark"].addTo(map);
overlays["Seamarks (Buoys/Lights)"].addTo(map);

// Add Layer Control
L.control.layers(baseLayers, overlays, {
  position: 'topright',
  collapsed: false // Kept expanded for easier maritime use
}).addTo(map);

// Add Zoom Control in top-left to avoid overlap
L.control.zoom({ position: 'topleft' }).addTo(map);

// Handle base layer changes for debugging/consistency
map.on('baselayerchange', (e) => {
  console.log(`Map theme changed to: ${e.name}`);
});

const routeManager = new RouteManager(map);
const swellOverlayLayer = L.layerGroup();
let swellOverlayVisible = false;

function nearestHourlyIndex(times) {
  if (!Array.isArray(times) || times.length === 0) return -1;
  const now = Date.now();
  let nearestIdx = 0;
  let nearestDelta = Number.POSITIVE_INFINITY;

  times.forEach((timeStr, idx) => {
    const timestamp = Date.parse(timeStr);
    if (Number.isNaN(timestamp)) return;
    const delta = Math.abs(timestamp - now);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearestIdx = idx;
    }
  });

  return nearestIdx;
}

function offsetLatLngByNauticalMiles(origin, bearingDeg, distanceNm = 1) {
  const distanceMeters = distanceNm * 1852;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const latRad = (origin.lat * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLon = Math.max(111320 * Math.cos(latRad), 1e-6);

  const dLat = (distanceMeters * Math.cos(bearingRad)) / metersPerDegLat;
  const dLon = (distanceMeters * Math.sin(bearingRad)) / metersPerDegLon;

  return L.latLng(origin.lat + dLat, origin.lng + dLon);
}

function drawSwellVector(latlng, swellMeters, directionDeg) {
  const tip = offsetLatLngByNauticalMiles(latlng, directionDeg, 0.6);
  L.polyline([latlng, tip], {
    color: '#38bdf8',
    weight: 3,
    opacity: 0.95,
  }).addTo(swellOverlayLayer);

  L.circleMarker(tip, {
    radius: 4,
    color: '#38bdf8',
    fillColor: '#38bdf8',
    fillOpacity: 0.95,
    weight: 1,
  })
    .bindTooltip(`${swellMeters.toFixed(1)} m | ${Math.round(directionDeg)}°`, {
      permanent: true,
      direction: 'top',
      className: 'waypoint-label',
      offset: [0, -6],
    })
    .addTo(swellOverlayLayer);
}

async function renderSwellOverlay() {
  swellOverlayLayer.clearLayers();

  const points = routeManager.waypoints.length > 0
    ? routeManager.waypoints.slice(0, 10)
    : [map.getCenter()];

  const results = await Promise.all(
    points.map(async (point) => {
      const marine = await fetchMarineData({
        lat: point.lat,
        lon: point.lng,
        days: 1,
      });

      const idx = nearestHourlyIndex(marine?.hourly?.time);
      if (idx < 0) return null;

      const swellMeters = marine?.hourly?.swell_wave_height?.[idx];
      // Open-Meteo hourly does not currently expose swell direction directly.
      // Use wave direction as best available proxy for swell travel direction.
      const directionDeg = marine?.hourly?.wave_direction?.[idx];

      if (typeof swellMeters !== 'number' || typeof directionDeg !== 'number') return null;
      return { point, swellMeters, directionDeg };
    })
  );

  const valid = results.filter(Boolean);
  valid.forEach(({ point, swellMeters, directionDeg }) => {
    drawSwellVector(point, swellMeters, directionDeg);
  });

  return valid.length;
}

// ── Tide overlay layer ─────────────────────────────────────────────────
// TODO: Render tide height as coloured polygons along the route.
// Green = safe (< 1.5m), Yellow = caution (1.5–3.0m), Red = danger (> 3.0m)

// ── UI Event Handlers ───────────────────────────────────────────────────

let mode = 'start'; // 'start' | 'between' | 'end'
document.getElementById('input-speed-knots').value = CONFIG.planningSpeedKnots.toFixed(1);
updateButtonStates();

function updateButtonStates() {
  const modes = ['start', 'between', 'end'];
  modes.forEach(m => {
    const btn = document.getElementById(`btn-set-${m}`);
    if (mode === m) {
      btn.classList.remove('btn-primary', 'btn-secondary');
      btn.classList.add('btn-accent');
    } else {
      btn.classList.remove('btn-accent');
      if (m === 'start') {
        btn.classList.add('btn-primary');
      } else {
        btn.classList.add('btn-secondary');
      }
    }
  });
}

document.getElementById('btn-set-start').addEventListener('click', () => {
  mode = 'start';
  updateButtonStates();
});

document.getElementById('btn-set-between').addEventListener('click', () => {
  mode = 'between';
  updateButtonStates();
});

document.getElementById('btn-set-end').addEventListener('click', () => {
  mode = 'end';
  updateButtonStates();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  routeManager.clear();
  swellOverlayLayer.clearLayers();
  if (map.hasLayer(swellOverlayLayer)) {
    map.removeLayer(swellOverlayLayer);
  }
  swellOverlayVisible = false;
  document.getElementById('btn-swell-overlay').textContent = '🌊 Toggle Swell Overlay';
});

document.getElementById('btn-add-latlon').addEventListener('click', () => {
  const latInput = document.getElementById('input-lat');
  const lonInput = document.getElementById('input-lon');

  const lat = Number.parseFloat(latInput.value);
  const lon = Number.parseFloat(lonInput.value);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    alert('Please enter valid latitude and longitude values.');
    return;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    alert('Latitude must be between -90 and 90, and longitude between -180 and 180.');
    return;
  }

  routeManager.addWaypoint(L.latLng(lat, lon), mode);
  map.panTo([lat, lon]);
  latInput.value = '';
  lonInput.value = '';
});

document.getElementById('btn-set-speed').addEventListener('click', () => {
  const speedInput = document.getElementById('input-speed-knots');
  const speedKnots = Number.parseFloat(speedInput.value);

  if (Number.isNaN(speedKnots) || speedKnots <= 0) {
    alert('Please enter a valid speed in knots (greater than 0).');
    return;
  }

  CONFIG.planningSpeedKnots = speedKnots;

  if (routeManager.waypoints.length >= 2) {
    if (routeManager.lastDistanceNm !== null) {
      routeManager.renderPlanningDetails(routeManager.lastDistanceNm);
    } else {
      routeManager.calculateRoute();
    }
  }
});

document.getElementById('btn-swell-overlay').addEventListener('click', async () => {
  const button = document.getElementById('btn-swell-overlay');

  if (swellOverlayVisible) {
    map.removeLayer(swellOverlayLayer);
    swellOverlayVisible = false;
    button.textContent = '🌊 Toggle Swell Overlay';
    return;
  }

  button.disabled = true;
  button.textContent = '🌊 Loading Swell...';

  try {
    const renderedCount = await renderSwellOverlay();
    if (renderedCount === 0) {
      alert('No swell overlay data available right now for the selected area.');
      button.textContent = '🌊 Toggle Swell Overlay';
      return;
    }

    swellOverlayLayer.addTo(map);
    swellOverlayVisible = true;
    button.textContent = '🌊 Hide Swell Overlay';
  } catch (err) {
    console.error('Swell overlay fetch failed:', err);
    alert('Unable to load swell overlay at the moment.');
    button.textContent = '🌊 Toggle Swell Overlay';
  } finally {
    button.disabled = false;
  }
});

document.getElementById('btn-route').addEventListener('click', async () => {
  if (routeManager.waypoints.length < 2) {
    alert('Set at least 2 waypoints first!');
    return;
  }

  // Sync speed from input field
  const speedInput = document.getElementById('input-speed-knots');
  const speedKnots = parseFloat(speedInput.value);
  if (!isNaN(speedKnots) && speedKnots > 0) {
    CONFIG.planningSpeedKnots = speedKnots;
  }

  // 1. Update planning details immediately using synchronous calculation
  routeManager.renderPlanningDetails();

  // 2. Refresh the visual route line (async)
  routeManager.calculateRoute();

  // 3. Fetch marine data for the route
  const bounds = map.getBounds();
  const center = bounds.getCenter();
  const marineEl = document.getElementById('route-marine');
  
  marineEl.innerHTML = '<p class="muted">Fetching marine weather...</p>';

  try {
    const marine = await fetchMarineData({
      lat: center.lat,
      lon: center.lng,
      days: 1,
    });

    if (marine && marine.daily) {
      const today = marine.daily.time.indexOf(
        new Date().toISOString().slice(0, 10)
      );
      if (today >= 0) {
        const swell = marine.daily.swell_wave_height_max[today];
        marineEl.innerHTML = `
          <div class="route-card">
            <p><strong>Today's Max Swell:</strong> ${swell}m</p>
            ${swell > CONFIG.dangerSwellMeters
              ? '<span class="warning-badge">⚠️ Heavy Swell — Caution!</span>'
              : '<span class="safe-badge">🟢 Manageable Swell</span>'}
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Marine fetch failed:', err);
    marineEl.innerHTML = '<p class="muted">Could not fetch marine data.</p>';
  }
});

map.on('click', (e) => {
  routeManager.addWaypoint(e.latlng, mode);
});

// ── Init sidebar with loading state ──────────────────────────────────────
document.getElementById('tide-forecast').innerHTML =
  '<p class="muted">Tide overlay requires a server-side proxy — see README.</p>';
document.getElementById('tide-info').textContent = 'Tides: initializing...';