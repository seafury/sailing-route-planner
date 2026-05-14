// ── Tide Data Module (Open-Meteo Built-in) ──────────────────────────────
async function fetchTides(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'sea_level_height',
    timezone: 'Africa/Johannesburg',
    forecast_days: 2
  });

  try {
    const resp = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params}`);
    if (!resp.ok) throw new Error(`Tide API error: ${resp.status}`);
    const data = await resp.json();
    
    if (!data.hourly || !data.hourly.sea_level_height) return null;

    const heights = data.hourly.sea_level_height;
    const times = data.hourly.time;
    const predictions = [];

    // Simple peak/trough detection
    for (let i = 1; i < heights.length - 1; i++) {
      const prev = heights[i - 1];
      const curr = heights[i];
      const next = heights[i + 1];

      if (curr > prev && curr > next) {
        predictions.push({
          time: new Date(times[i]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          height: curr.toFixed(2),
          type: 'High'
        });
      } else if (curr < prev && curr < next) {
        predictions.push({
          time: new Date(times[i]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          height: curr.toFixed(2),
          type: 'Low'
        });
      }
    }
    return predictions;
  } catch (err) {
    console.error('Tide fetch failed:', err);
    return null;
  }
}

function renderTides(tides) {
  const el = document.getElementById('tide-forecast');
  if (!tides || !tides.length) {
    el.innerHTML = '<p class="muted">Tide data unavailable for this location.</p>';
    return;
  }

  // Filter for next 4 events
  const upcoming = tides.slice(0, 4);

  let html = '<div class="tide-card"><h4>Tidal Extremes (Next 24h)</h4>';
  html += '<table class="tide-table"><tbody>';

  upcoming.forEach(t => {
    const cls = t.type === 'High' ? 'high' : 'low';
    const icon = t.type === 'High' ? '⬆️' : '⬇️';
    html += `<tr>
      <td>${t.time}</td>
      <td class="${cls}"><strong>${icon} ${t.type}</strong></td>
      <td>${t.height}m</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}