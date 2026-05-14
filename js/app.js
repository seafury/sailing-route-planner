// ── Marine & Tide Fetch Module ──────────────────────────────────────────
async function fetchMarineData({ lat, lon, days = 3 }) {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'wave_height,wave_direction,wind_wave_height,swell_wave_height,wave_period,wind_speed_10m,wind_direction_10m',
    daily: 'wave_height_max,wave_direction_dominant,swell_wave_height_max,swell_wave_period_max',
    timezone: 'Africa/Johannesburg',
    start_date: today,
    end_date: end,
  });

  const resp = await fetch(`${CONFIG.marineApi}?${params}`);
  if (!resp.ok) throw new Error(`Marine API error: ${resp.status}`);
  return resp.json();
}

// ── Waypoint & Route Manager ────────────────────────────────────────────
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
      summary: { totalDistance: totalDistance, totalTime: 0 },
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
    this.markers = [];
    this.waypointLinks = [];
    this.waypointArrows = [];
    this.routingControl = null;
    this.lastDistanceNm = null;
  }

  calculateTotalDistance() {
    if (this.waypoints.length < 2) return 0;
    let totalMeters = 0;
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      totalMeters += this.waypoints[i].distanceTo(this.waypoints[i + 1]);
    }
    return totalMeters / 1852;
  }

  formatDuration(totalHours) {
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
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
    const x = (Math.cos(fromLat) * Math.sin(toLat)) - (Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng));
    return ( (Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  addWaypoint(latlng) {
    this.waypoints.push(latlng);
    this.redraw();
  }

  redraw() {
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];
    this.waypointLinks.forEach(l => this.map.removeLayer(l));
    this.waypointLinks = [];
    this.waypointArrows.forEach(a => this.map.removeLayer(a));
    this.waypointArrows = [];

    this.waypoints.forEach((latlng, idx) => {
      const marker = L.marker(latlng, {
        icon: L.divIcon({
          className: 'waypoint-label',
          html: String.fromCharCode(65 + idx),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(this.map);
      this.markers.push(marker);

      if (idx > 0) {
        const prev = this.waypoints[idx - 1];
        const link = L.polyline([prev, latlng], { color: CONFIG.waypointLinkColor, weight: 3, opacity: 0.9 }).addTo(this.map);
        this.waypointLinks.push(link);

        const midpoint = L.latLng((prev.lat + latlng.lat) / 2, (prev.lng + latlng.lng) / 2);
        const bearing = Math.round(this.calculateBearingDegrees(prev, latlng));
        const arrow = L.marker(midpoint, {
          icon: L.divIcon({
            className: 'waypoint-link-arrow',
            html: `<div style="color:${CONFIG.waypointLinkColor};font-size:18px;line-height:1;transform:rotate(${bearing - 90}deg);">➤</div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        }).addTo(this.map);
        arrow.bindTooltip(`${bearing}°T`, { permanent: true, direction: 'top', offset: [0, -10], className: 'bearing-tooltip' });
        this.waypointArrows.push(arrow);
      }
    });

    if (this.waypoints.length >= 2) {
      this.calculateRoute();
    }
  }

  calculateRoute() {
    if (this.routingControl) {
      this.map.removeControl(this.routingControl);
    }

    this.routingControl = L.Routing.control({
      waypoints: this.waypoints.map(w => L.latLng(w)),
      router: DirectRouter,
      lineOptions: {
        styles: [{ color: CONFIG.routeColor, weight: CONFIG.routeWeight, opacity: 0.8 }],
        extendToWaypoints: false,
      },
      show: false,
      addWaypoints: false,
      fitSelectedRoutes: false,
    });

    this.routingControl.on('routesfound', (e) => {
      const distanceNm = e.routes[0].summary.totalDistance / 1852;
      this.renderPlanningDetails(distanceNm);
    });

    this.routingControl.addTo(this.map);
  }

  clear() {
    this.waypoints = [];
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
    document.getElementById('route-summary').innerHTML = '<p class="muted">Click the map to set waypoints.</p>';
  }
}

// ── Map Init ────────────────────────────────────────────────────────────
const map = L.map('map', {
  ...CONFIG.map,
  zoomControl: false
});

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: CONFIG.map.maxZoom
}).addTo(map);

L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
  attribution: 'Seamarks: &copy; OpenSeaMap contributors',
  maxZoom: CONFIG.map.maxZoom
}).addTo(map);

// 3. Cape Town Maritime Pack (Always On)
L.geoJSON(CAPE_TOWN_MARITIME, {
  style: (feature) => feature.properties.style || {},
  onEachFeature: (feature, layer) => {
    if (feature.properties.name) {
      layer.bindTooltip(`<b>${feature.properties.name}</b><br>${feature.properties.description}`, { sticky: true });
    }
  },
  pointToLayer: (feature, latlng) => {
    if (feature.properties.icon) {
      return L.marker(latlng, {
        icon: L.divIcon({
          html: `<div class="maritime-icon">${feature.properties.icon}</div>`,
          className: 'custom-div-icon',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      });
    }
    return L.circleMarker(latlng);
  }
}).addTo(map);

L.control.zoom({ position: 'topleft' }).addTo(map);

const routeManager = new RouteManager(map);

// ── UI Listeners ────────────────────────────────────────────────────────
document.getElementById('btn-route').addEventListener('click', async () => {
  if (routeManager.waypoints.length < 2) {
    alert('Click the map to set at least 2 waypoints first!');
    return;
  }

  routeManager.renderPlanningDetails();
  routeManager.calculateRoute();

  const bounds = map.getBounds();
  const center = bounds.getCenter();
  const weatherEl = document.getElementById('marine-weather');
  const tideEl = document.getElementById('tide-forecast');
  
  weatherEl.innerHTML = '<p class="muted">Fetching marine weather...</p>';
  tideEl.innerHTML = '<p class="muted">Fetching tides...</p>';

  try {
    const marine = await fetchMarineData({ lat: center.lat, lon: center.lng, days: 1 });
    if (marine && marine.daily) {
      const idx = marine.daily.time.indexOf(new Date().toISOString().slice(0, 10));
      if (idx >= 0) {
        const swell = marine.daily.swell_wave_height_max[idx];
        const dir = marine.daily.wave_direction_dominant[idx];
        weatherEl.innerHTML = `
          <div class="route-card">
            <p><strong>Max Swell:</strong> ${swell}m</p>
            <p><strong>Direction:</strong> ${Math.round(dir)}°</p>
            ${swell > CONFIG.dangerSwellMeters
              ? '<span class="warning-badge">⚠️ Heavy Swell — Caution!</span>'
              : '<span class="safe-badge">🟢 Manageable Swell</span>'}
          </div>
        `;
      }
    }
    const tides = await fetchTides(center.lat, center.lng);
    renderTides(tides);
  } catch (err) { console.error(err); }
});

document.getElementById('btn-set-speed').addEventListener('click', () => {
  const speedInput = document.getElementById('input-speed-knots');
  const speed = parseFloat(speedInput.value);
  if (!isNaN(speed) && speed > 0) {
    CONFIG.planningSpeedKnots = speed;
    if (routeManager.waypoints.length >= 2) routeManager.renderPlanningDetails();
  }
});

function parseCoordinate(str) {
  if (!str) return NaN;
  const s = str.trim().toUpperCase();
  
  // Handle cardinal suffixes
  let multiplier = 1;
  if (s.endsWith('S') || s.endsWith('W')) multiplier = -1;
  
  // Remove non-numeric chars except decimals and spaces
  const clean = s.replace(/[^\d\s\.]/g, '').trim();
  const parts = clean.split(/\s+/).map(parseFloat);
  
  if (parts.length === 1) return parts[0] * multiplier;
  if (parts.length === 2) return (parts[0] + parts[1]/60) * multiplier;
  if (parts.length === 3) return (parts[0] + parts[1]/60 + parts[2]/3600) * multiplier;
  
  return NaN;
}

document.getElementById('btn-add-coord').addEventListener('click', () => {
  const latStr = document.getElementById('input-lat').value;
  const lonStr = document.getElementById('input-lon').value;
  
  const lat = parseCoordinate(latStr);
  const lon = parseCoordinate(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    alert('Invalid format. Try "33.9" or "33 55.2 S"');
    return;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    alert('Coordinates out of range.');
    return;
  }

  const latlng = L.latLng(lat, lon);
  routeManager.addWaypoint(latlng);
  map.setView(latlng, map.getZoom());
});

document.getElementById('btn-clear').addEventListener('click', () => {
  routeManager.clear();
  document.getElementById('marine-weather').innerHTML = '';
  loadCapeTownData();
});

async function loadCapeTownData() {
  const tides = await fetchTides(CONFIG.map.center[0], CONFIG.map.center[1]);
  renderTides(tides);
}

map.on('click', (e) => {
  routeManager.addWaypoint(e.latlng);
});

// ── Wave Overlay Logic ──────────────────────────────────────────────────
const waveOverlayLayer = L.layerGroup().addTo(map);
let waveOverlayVisible = false;

async function toggleWaves() {
  const btn = document.getElementById('btn-waves');
  if (!btn) return;
  waveOverlayVisible = !waveOverlayVisible;

  if (waveOverlayVisible) {
    btn.classList.add('active');
    btn.textContent = '🌊 Loading...';
    await renderWaveOverlay();
    btn.textContent = '🌊 Hide Waves';
  } else {
    btn.classList.remove('active');
    waveOverlayLayer.clearLayers();
    btn.textContent = '🌊 Waves';
  }
}

async function renderWaveOverlay() {
  waveOverlayLayer.clearLayers();
  const points = routeManager.waypoints.length >= 1 ? routeManager.waypoints : [map.getCenter()];
  
  const nowISO = new Date().toISOString().slice(0, 13); // "2024-05-14T15"

  for (const latlng of points) {
    try {
      const data = await fetchMarineData({ lat: latlng.lat, lon: latlng.lng, days: 1 });
      if (data && data.hourly) {
        const idx = data.hourly.time.findIndex(t => t.startsWith(nowISO));
        const useIdx = idx !== -1 ? idx : 0;
        
        const height = data.hourly.wave_height[useIdx];
        const direction = data.hourly.wave_direction[useIdx];
        
        L.marker(latlng, {
          icon: L.divIcon({
            className: 'wave-arrow-container',
            html: `<div class="wave-arrow" style="transform: rotate(${direction}deg)">⬇️</div>
                   <span class="wave-label">${height}m ${Math.round(direction)}°</span>`,
            iconSize: [60, 60],
            iconAnchor: [30, 30]
          }),
          zIndexOffset: 1000
        }).addTo(waveOverlayLayer);
      }
    } catch (err) { console.error('Wave data error:', err); }
  }
}

document.getElementById('btn-waves').addEventListener('click', toggleWaves);

// ── Wind Overlay Logic ──────────────────────────────────────────────────
const windOverlayLayer = L.layerGroup().addTo(map);
let windOverlayVisible = false;

async function toggleWind() {
  const btn = document.getElementById('btn-wind');
  if (!btn) return;
  windOverlayVisible = !windOverlayVisible;

  if (windOverlayVisible) {
    btn.classList.add('active');
    btn.textContent = '🌬️ Loading...';
    await renderWindOverlay();
    btn.textContent = '🌬️ Hide Wind';
  } else {
    btn.classList.remove('active');
    windOverlayLayer.clearLayers();
    btn.textContent = '🌬️ Wind';
  }
}

async function renderWindOverlay() {
  windOverlayLayer.clearLayers();
  const points = routeManager.waypoints.length >= 1 ? routeManager.waypoints : [map.getCenter()];
  const nowISO = new Date().toISOString().slice(0, 13);

  for (const latlng of points) {
    try {
      const data = await fetchMarineData({ lat: latlng.lat, lon: latlng.lng, days: 1 });
      if (data && data.hourly) {
        const idx = data.hourly.time.findIndex(t => t.startsWith(nowISO));
        const useIdx = idx !== -1 ? idx : 0;
        const speed = data.hourly.wind_speed_10m[useIdx];
        const direction = data.hourly.wind_direction_10m[useIdx];
        
        L.marker(latlng, {
          icon: L.divIcon({
            className: 'wind-arrow-container',
            html: `<div class="wind-arrow" style="transform: rotate(${direction}deg)">➤</div>
                   <span class="wind-label">${speed}km/h</span>`,
            iconSize: [50, 50],
            iconAnchor: [25, 25]
          }),
          zIndexOffset: 1100
        }).addTo(windOverlayLayer);
      }
    } catch (err) { console.error(err); }
  }
}

document.getElementById('btn-wind').addEventListener('click', toggleWind);

// Sidebar initialization
loadCapeTownData();