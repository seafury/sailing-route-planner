// Tide Data Module
// ──────────────────────────────────────────────────────────────────────────
// Fetches tide predictions for a given lat/lon using free APIs.
//
// OPTION A: Open-Meteo (free, no key, 7-day tide forecast)
//   https://open-meteo.com/en/docs#latitude=33.93&longitude=-118.42
//   Endpoint: /v1/marine with hourly=wave_height,swell_wave_height
//
// OPTION B: NOAA CO-OPS (US only, free, no key)
//   https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
//
// OPTION C: tide-forecast.com (scraping via serverless proxy)
//   Same source used in cape_town_report.py — needs a CORS proxy.
//
// To add a new source:
//   1. Implement fetchTides(lat, lon) returning [{time, height, type}]
//   2. Wire it into app.js → RouteManager
// ──────────────────────────────────────────────────────────────────────────

async function fetchTidesNOAA(stationId = "9410663") {
  // San Francisco example — replace with your station
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
    `product=predictions&application=NOS.COOPS.TAC.WL&begin_date=${today.replace(/-/g,'')}&end_date=${today.replace(/-/g,'')}` +
    `&datum=MLLW&station=${stationId}&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`NOAA error: ${resp.status}`);
  const data = await resp.json();

  return data.predictions.map(p => ({
    time: p.t,
    height: parseFloat(p.v),
    type: p.t.includes('H') ? 'High' : 'Low',
  }));
}

// Render tide data into the sidebar
function renderTides(tides) {
  const el = document.getElementById('tide-forecast');
  if (!tides || !tides.length) {
    el.innerHTML = '<p class="muted">No tide data available.</p>';
    return;
  }

  let html = '<table class="tide-table"><thead><tr>';
  html += '<th>Time</th><th>Type</th><th>Height</th>';
  html += '</tr></thead><tbody>';

  tides.forEach(t => {
    const cls = t.type === 'High' ? 'high' : 'low';
    const icon = t.type === 'High' ? '⬆️' : '⬇️';
    html += `<tr><td>${t.time}</td><td class="${cls}">${icon} ${t.type}</td><td>${t.height}m</td></tr>`;
  });

  html += '</tbody></table>';
  el.innerHTML = html;
}