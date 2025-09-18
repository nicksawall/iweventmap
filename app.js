// ===== Config =====
const SHEET_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-ZxzOQMY6WOlSdttZWaxy-UUQEXdnHEvdXcuRoqDlek4ziPNTSgMgvq-NinaaCuezJ7vzBlm3hOMO/pub?gid=0&single=true&output=csv";

// USA bounds (CONUS-ish)
const USA_BOUNDS = L.latLngBounds([ [24.396308, -124.848974], [49.384358, -66.885444] ]);
const AUTO_FIT_ON_LOAD = false; // <-- keep initial view on USA, not full marker extent

// ===== State =====
let map, layers, events = [], userLoc = null;

// ===== DOM =====
const appEl = document.getElementById('app');
const listEl = document.getElementById('list');
const locBtn = document.getElementById('locBtn');
const locInput = document.getElementById('locInput');
const setLocBtn = document.getElementById('setLocBtn');
const searchInput = document.getElementById('searchInput');
const sortSel = document.getElementById('sortSel');
const toggleListFloating = document.getElementById('toggleListFloating');
const chev = document.getElementById('chev');
const backdrop = document.getElementById('backdrop');
const chkPast = document.getElementById('chkPast');
const chkSoon = document.getElementById('chkSoon');
const chkFuture = document.getElementById('chkFuture');
const loadingBadge = document.getElementById('loading');
const resetBtn = document.getElementById('resetBtn');
const hud = document.getElementById('hud');

// ===== Utils =====
function escapeHtml(str){return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function linkify(text){if(!text)return"";return text.replace(/(https?:\/\/[^\s]+)/g,url=>`<a href="${url}" target="_blank" rel="noopener">${url}</a>`);}
function formatDate(s){if(!s)return"";const d=new Date(s);if(isNaN(d))return s;return d.toLocaleString("en-US",{month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true});}
function distanceMiles(lat1,lon1,lat2,lon2){const toRad=d=>d*Math.PI/180;const R=3958.8;const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function classifyByDate(startISO){const now=new Date();const s=new Date(startISO);if(isNaN(s))return{status:'unknown',color:'#3367d6'};if(s<now)return{status:'past',color:'#9aa0a6'};const days=(s-now)/86400000;if(days<=30)return{status:'soon',color:'#f2994a'};return{status:'upcoming',color:'#34a853'};}
function matchesQuery(ev,q){if(!q)return true;q=q.toLowerCase();return ev.title.toLowerCase().includes(q)||(ev.where||'').toLowerCase().includes(q);}
function isMobile(){ return window.matchMedia('(max-width: 900px)').matches; }
function setChevron(){
  chev.textContent = (appEl.classList.contains('collapsed') && !isMobile())
                  || (!appEl.classList.contains('drawer-open') && isMobile()) ? '>' : '<';
}
function updateHud(){
  if (!map) return;
  const c = map.getCenter();
  hud.textContent = `zoom: ${map.getZoom()} | center: ${c.lat.toFixed(3)}, ${c.lng.toFixed(3)} | markers: ${events.length}`;
}

// ===== Map init =====
function addTilesWithFallback() {
  let activeLayer;

  function useOSM() {
    activeLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    activeLayer.on('tileerror', onError);
    activeLayer.on('load', onLoad);
  }

  function useHot() {
    if (activeLayer) { activeLayer.off(); map.removeLayer(activeLayer); }
    activeLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors, Tiles style by HOT'
    }).addTo(map);
    activeLayer.on('tileerror', onSecondError);
    activeLayer.on('load', onLoad);
  }

  function useCarto() {
    if (activeLayer) { activeLayer.off(); map.removeLayer(activeLayer); }
    activeLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors & CARTO'
    }).addTo(map);
    activeLayer.on('load', onLoad);
  }

  function onError() {
    console.warn('OSM tiles blocked; switching to HOT layer');
    useHot();
  }
  function onSecondError() {
    console.warn('HOT tiles failed; trying Carto basemap');
    useCarto();
  }
  function onLoad() {
    requestAnimationFrame(()=>{ map.invalidateSize(); updateHud(); });
  }

  useOSM();
}

function initMap(){
  map = L.map('map',{scrollWheelZoom:true});
  addTilesWithFallback();
  map.zoomControl.setPosition('bottomright');

  // Start focused on USA (requested)
  map.fitBounds(USA_BOUNDS, { padding: [20,20] });

  // Priority panes (orange > green > gray)
  map.createPane('paneSoon');     map.getPane('paneSoon').style.zIndex = 650;
  map.createPane('paneUpcoming'); map.getPane('paneUpcoming').style.zIndex = 640;
  map.createPane('panePast');     map.getPane('panePast').style.zIndex = 630;

  layers = { past: L.layerGroup().addTo(map),
             soon: L.layerGroup().addTo(map),
             upcoming: L.layerGroup().addTo(map) };

  // Invalidate after layout settles + watchdog
  requestAnimationFrame(()=>{ map.invalidateSize(); updateHud(); });
  setTimeout(()=>{ map.invalidateSize(); updateHud(); }, 400);

  // Desktop/iframe watchdog: if container is tiny at init, force pixel height
  const mapDiv = document.getElementById('map');
  const h = mapDiv.clientHeight, w = mapDiv.clientWidth;
  if (h < 200 || w < 200) {
    console.warn('Map container small at init, forcing 820px height (desktop fallback)');
    mapDiv.style.height = '820px';
    document.getElementById('app').style.height = 'auto';
    setTimeout(()=>{ map.invalidateSize(); updateHud(); }, 50);
  }
}

// ===== Data mapping =====
function rowToEvent(r){
  const lat = parseFloat(r.lat), lng = parseFloat(r.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const klass = classifyByDate(r.start);
  return {
    title: (r.title || 'Untitled Event').trim(),
    start: r.start, end: r.end,
    when: formatDate(r.start) + (r.end ? " – " + formatDate(r.end) : ""),
    where: r.location || '',
    link: r.htmlLink || '',
    rawDesc: r.description || '',
    desc: linkify(escapeHtml(r.description || '')),
    lat, lng, color: klass.color, status: klass.status, marker: null
  };
}

// ===== Renderers =====
function renderMarkers(){
  layers.past.clearLayers(); layers.soon.clearLayers(); layers.upcoming.clearLayers();

  const boundsArr = [];

  events.forEach(ev=>{
    const popup =
      `<div class="popup">
         <h3>${escapeHtml(ev.title)}</h3>
         ${ev.when ? `<div class="meta"><strong>When:</strong> ${ev.when}</div>` : ""}
         ${ev.where ? `<div class="meta"><strong>Where:</strong> ${escapeHtml(ev.where)}</div>` : ""}
         ${ev.link ? `<div class="meta"><a href="${encodeURI(ev.link)}" target="_blank" rel="noopener">View in Google Calendar</a></div>` : ""}
         ${ev.rawDesc ? `<div class="desc">${ev.desc}</div>` : ""}
       </div>`;

    const pane = ev.status==='soon' ? 'paneSoon' : ev.status==='upcoming' ? 'paneUpcoming' : 'panePast';
    const m = L.circleMarker([ev.lat, ev.lng], {
      pane, radius: 8, color: ev.color, weight: 2, fillColor: ev.color, fillOpacity: 0.85
    }).bindPopup(popup);

    if (ev.status==='past') layers.past.addLayer(m);
    else if (ev.status==='soon') layers.soon.addLayer(m);
    else layers.upcoming.addLayer(m);

    ev.marker = m;
    boundsArr.push([ev.lat, ev.lng]);
  });

  // Ensure groups are actually on at start
  if (!map.hasLayer(layers.past)) map.addLayer(layers.past);
  if (!map.hasLayer(layers.soon)) map.addLayer(layers.soon);
  if (!map.hasLayer(layers.upcoming)) map.addLayer(layers.upcoming);

  // On load, keep USA view (do not auto-fit), but allow Reset button to fit later
  if (AUTO_FIT_ON_LOAD) {
    if (boundsArr.length) {
      const b = L.latLngBounds(boundsArr);
      map.fitBounds(b, { padding: [28, 28], maxZoom: 7 });
    } else {
      map.fitBounds(USA_BOUNDS, { padding: [20,20] });
    }
  }
  setTimeout(()=>{ map.invalidateSize(); updateHud(); }, 250);
}

function renderList(){
  const q = (searchInput.value || '').trim();
  const allowPast = chkPast.checked, allowSoon = chkSoon.checked, allowFuture = chkFuture.checked;

  const filtered = events.filter(ev =>
    ((ev.status==='past' && allowPast) || (ev.status==='soon' && allowSoon) || (ev.status==='upcoming' && allowFuture)) &&
    matchesQuery(ev, q)
  );

  listEl.innerHTML = filtered.map(ev =>
    `<div class="item">
      <h4><span class="dot" style="background:${ev.color};"></span>${escapeHtml(ev.title)}</h4>
      <div class="meta">${ev.when}</div>
      ${ev.where ? `<div class="meta">${escapeHtml(ev.where)}</div>` : ''}
      ${ev.link ? `<div class="meta"><a href="${encodeURI(ev.link)}" target="_blank" rel="noopener">Open in Google Calendar</a></div>` : ''}
    </div>`
  ).join('');
}

// ===== UI wiring =====
function openDrawer(){ appEl.classList.remove('collapsed'); appEl.classList.add('drawer-open'); setChevron(); setTimeout(()=>{ map.invalidateSize(); updateHud(); },260); }
function closeDrawer(){ appEl.classList.remove('drawer-open'); setChevron(); setTimeout(()=>{ map.invalidateSize(); updateHud(); },260); }
function toggleList(){
  if (isMobile()) { appEl.classList.contains('drawer-open') ? closeDrawer() : openDrawer(); }
  else { appEl.classList.toggle('collapsed'); setChevron(); setTimeout(()=>{ map.invalidateSize(); updateHud(); },260); }
}
toggleListFloating.addEventListener('click', toggleList);
backdrop.addEventListener('click', closeDrawer);

// Reset view (fit to all markers)
resetBtn.addEventListener('click', ()=>{
  if (events.length) {
    const b = L.latLngBounds(events.map(e => [e.lat, e.lng]));
    map.fitBounds(b, { padding: [28,28], maxZoom: 7 });
  } else {
    map.fitBounds(USA_BOUNDS, { padding: [20,20] });
  }
  // Ensure groups reflect checkboxes
  if (chkPast.checked && !map.hasLayer(layers.past)) map.addLayer(layers.past);
  if (chkSoon.checked && !map.hasLayer(layers.soon)) map.addLayer(layers.soon);
  if (chkFuture.checked && !map.hasLayer(layers.upcoming)) map.addLayer(layers.upcoming);
  setTimeout(()=>{ map.invalidateSize(); updateHud(); }, 150);
});

// Location controls
function enableDistanceSort(){
  const distOpt=[...sortSel.options].find(o=>o.value==='distance');
  if(distOpt) distOpt.disabled=false;
}
locBtn.addEventListener('click',()=>{
  if(!navigator.geolocation){alert("Geolocation not supported.");return;}
  navigator.geolocation.getCurrentPosition(
    pos=>{
      userLoc={lat:pos.coords.latitude,lng:pos.coords.longitude};
      localStorage.setItem('iw_user_loc',JSON.stringify(userLoc));
      L.circleMarker([userLoc.lat,userLoc.lng],{radius:6,color:'#1976d2',weight:2,fillColor:'#1976d2',fillOpacity:0.6})
        .addTo(map).bindPopup('You are here').openPopup();
      enableDistanceSort(); renderList(); updateHud();
    },
    err=>{ alert("Couldn’t get your location ("+err.message+")"); },
    { enableHighAccuracy:true, timeout:8000, maximumAge:60000 }
  );
});
setLocBtn.addEventListener('click', async ()=>{
  const q=(locInput.value||'').trim();
  if(!q){ alert('Enter a ZIP or City, State'); return; }
  try{
    const res=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q),{headers:{'Accept-Language':'en'}});
    const arr=await res.json(); if(!arr.length) throw new Error('No results');
    userLoc={lat:parseFloat(arr[0].lat),lng:parseFloat(arr[0].lon)};
    localStorage.setItem('iw_user_loc',JSON.stringify(userLoc));
    L.circleMarker([userLoc.lat,userLoc.lng],{radius:6,color:'#1976d2',weight:2,fillColor:'#1976d2',fillOpacity:0.6})
      .addTo(map).bindPopup('Your location set').openPopup();
    map.setView([userLoc.lat,userLoc.lng],8);
    enableDistanceSort(); renderList(); updateHud();
  }catch(e){ alert('Could not find that place.'); }
});

searchInput.addEventListener('input', ()=>{ renderList(); });
sortSel.addEventListener('change', ()=>{ renderList(); });

// Checkbox toggles update map and list
[chkPast,chkSoon,chkFuture].forEach(chk=>{
  chk.addEventListener('change',()=>{
    if(chkPast.checked) map.addLayer(layers.past); else map.removeLayer(layers.past);
    if(chkSoon.checked) map.addLayer(layers.soon); else map.removeLayer(layers.soon);
    if(chkFuture.checked) map.addLayer(layers.upcoming); else map.removeLayer(layers.upcoming);
    renderList(); updateHud();
  });
});

// ===== Boot =====
window.addEventListener('DOMContentLoaded', async ()=>{
  initMap();

  // Default: hide past on first load (both list & map)
  chkPast.checked = false;
  map.removeLayer(layers.past);

  // Extra nudge loop (handles late CSS/layout)
  let ticks=0; const id=setInterval(()=>{ map.invalidateSize(); if(++ticks>=6) clearInterval(id); }, 250);

  // Restore saved location (if any)
  try{
    const saved=localStorage.getItem('iw_user_loc');
    if(saved){
      userLoc=JSON.parse(saved);
      L.circleMarker([userLoc.lat,userLoc.lng],{radius:6,color:'#1976d2',weight:2,fillColor:'#1976d2',fillOpacity:0.6})
        .addTo(map).bindPopup('Your saved location');
      enableDistanceSort();
    }
  }catch(_){}

  // Fetch CSV then parse (avoids Papa XHR/CSP pitfalls)
  try{
    const resp = await fetch(SHEET_CSV + "&_ts=" + Date.now(), { credentials: "omit", cache: "no-store" });
    if (!resp.ok) throw new Error("CSV HTTP " + resp.status);
    const csvText = await resp.text();

    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = (parsed.data || []).filter(r => r && Object.keys(r).length);
    console.log("CSV loaded:", { rows: rows.length, cols: Object.keys(rows[0] || {}) });
    if (rows.length) console.log("CSV sample row:", rows[0]);

    events = rows.map(rowToEvent).filter(Boolean);
    console.log("Events mapped:", events.length);

    renderMarkers();            // creates markers (no auto-fit at load)
    renderList();

    loadingBadge.style.display='none';
    setTimeout(()=>{ map.invalidateSize(); updateHud(); }, 400);
  } catch (e) {
    console.error("CSV load error:", e);
    loadingBadge.textContent = 'Failed to load events.';
  }

  setChevron();
  updateHud();
});
