Irreverent Warriors Event Map
A lightweight, mobile-friendly event map + list built with Leaflet and Papa Parse.
Events are read from a published Google Sheet (CSV); markers use your custom logos for:
Past events (logo-past.png)


Next 30 days (logo-soon.png)


Future events (logo-future.png)


The map shows all categories by default and has on-map toggles.
The list intentionally excludes past events (always).
Works standalone and inside an iframe (e.g., DonorDrive) with some CSP notes below.

Features
📍 Leaflet map centered on the USA, “Reset View” button.


🧭 Category toggles: Past, Next 30 days, Future (all on by default for the map).


🗂️ Sidebar list (search + sort by date; distance sorting enabled when a user location is set).


📱 Mobile drawer for the list (slides over map); desktop uses a collapsible sidebar.


🔗 Popups show title, time (Month Day, Year, HH:MM AM/PM), location, description (links made clickable), and a link to the Google Calendar event.


🖼️ Custom logo markers and legend images.


⚡ CSV is fetched client-side; no server required (great for GitHub Pages).



Repo Structure
/ (root)
├─ index.html        # main page
├─ styles.css        # layout & styles
├─ app.js            # logic (map, CSV parsing, filters)
├─ papaparse.min.js  # CSV parser (loaded from unpkg in index.html)
├─ logo-past.png     # marker for past events
├─ logo-soon.png     # marker for events within 30 days
└─ logo-future.png   # marker for events after 30 days
You can use SVGs instead of PNGs—just update the filenames in index.html and app.js.

Requirements
A Google Sheet with the event data (see the Data Format section).


The sheet must be published to the web as CSV.


A static host (e.g., GitHub Pages) or your own web server.



Data Format (Google Sheet → CSV)
Your sheet must have a header row with the following exact column names:
Column
Required
Notes
eventId
✅
A unique ID (can be Calendar’s event ID).
title
✅
Event title.
start
✅
ISO-ish string like 2024-09-21 00:00 (local is fine).
end
❌
Optional.
location
❌
Plain-text location.
htmlLink
❌
Link to the event on Google Calendar (or your site).
description
❌
Event notes; URLs will be auto-linkified.
lat
✅
Latitude as number.
lng
✅
Longitude as number.

lat/lng must be numeric; rows without valid coordinates are skipped.

Publish your Google Sheet as CSV
Open the sheet.


File → Share → Publish to web.


Choose the specific tab that holds the data.


Output format: CSV.


Copy the published CSV URL.


Replace the SHEET_CSV constant in app.js with your published URL:
// app.js
const SHEET_CSV = "https://docs.google.com/spreadsheets/d/e/XXXX/pub?gid=0&single=true&output=csv";
We append a &_ts= timestamp at runtime to bypass caching.

Configure logos
Place your three images in the project root (or update paths as needed).


index.html (legend chips):


<img src="logo-past.png" class="dot-img" alt="Past">
<img src="logo-soon.png" class="dot-img" alt="Next 30 days">
<img src="logo-future.png" class="dot-img" alt="Future">




app.js (map markers):


const ICONS = {
  past:    L.icon({ iconUrl: 'logo-past.png',    iconSize: [28,28], iconAnchor: [14,28], popupAnchor: [0,-28] }),
  soon:    L.icon({ iconUrl: 'logo-soon.png',    iconSize: [28,28], iconAnchor: [14,28], popupAnchor: [0,-28] }),
  upcoming:L.icon({ iconUrl: 'logo-future.png',  iconSize: [28,28], iconAnchor: [14,28], popupAnchor: [0,-28] })
};




Adjust iconSize/iconAnchor/popupAnchor to fit your artwork.



Run locally
You can just open index.html in a browser, but for best results use a local server:
Python: python3 -m http.server 8080


Node (serve): npx serve .


Browse to http://localhost:8080.

Deploy on GitHub Pages
Commit all files to a public repo.


Settings → Pages → set the source to main branch, /root (or /docs if you prefer).


Wait for the Pages site to build, then open the URL.


If you change files and don’t see updates, hard-refresh (Shift+Reload).
We also version-bump CSS/JS in index.html like styles.css?v=14.

Using the map
Toggles (top-left): control which markers render on the map (Past / Next 30 days / Future).


Search: filters by title and location.


Sort: date by default. “Distance” becomes available after you set or allow a user location.


Use My Location / Set Location: optional controls that enable distance sorting.


Reset View: fits the map to all current markers; default view is the continental USA.


The list never shows past events, by design—even if “Past” is toggled on for the map.

Marker priority
To keep critical markers visible:
Next 30 days (orange / logo-soon.png) are drawn on the top pane.


Future (green / logo-future.png) are in the middle.


Past (gray / logo-past.png) are below both.


This ensures gray past markers never cover orange/green markers.

Accessibility & Mobile
The list becomes a drawer on mobile (< 900px), opened via the floating chevron button.


All controls have reasonable touch targets and readable labels.



Embedding in DonorDrive (iframe) — CSP Tips
Some hosts enforce strict Content Security Policy (CSP) that can block inline scripts or some CDNs.
This app does not use inline scripts; scripts are loaded via <script src=… defer>.


If the host blocks external scripts, you may need to:


Self-host Leaflet CSS/JS and Papa Parse in your repo, and reference them locally (e.g., ./lib/leaflet.js).


Confirm the host allows https://basemaps.cartocdn.com (map tiles) and https://{a,b,c}.tile.openstreetmap.org if you switch basemaps.


Typical iframe:


<iframe
  src="https://YOUR-USER.github.io/iweventmap/"
  width="100%"
  height="800"
  style="border:0"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  allow="geolocation"
></iframe>




If geolocation is blocked by policy, users can still manually set a ZIP/city.



Troubleshooting
Blank/blue/gray map, no tiles:
Hard refresh the page.


Check Console for errors.


We disable map fade/zoom animations and force .leaflet-tile { opacity: 1 !important; } to avoid browser fade bugs.


Map loads on mobile but not on desktop:
Ensure the grid explicitly assigns areas; we already do via grid-template-areas.


If the map width logs as 0, the sidebar/grid placement was the culprit—fixed in this code.


No markers:
Verify your CSV has numeric lat/lng.


Make sure your published sheet URL in app.js is correct and public.


Distance sort disabled:
It becomes enabled once a location is set (via “Use My Location” or manual ZIP/city).


Links in description not clickable:
We auto-link http(s)://… in descriptions; ensure URLs include the protocol.



Privacy notes
“Use My Location” uses the browser’s Geolocation API (user must consent).


Manual ZIP/city uses the public Nominatim geocoder (nominatim.openstreetmap.org).


No personal data is stored server-side; only a simple localStorage key for saved location.



Customizing
Default view: See USA_BOUNDS in app.js. Adjust for other regions or call map.setView([lat,lng], zoom).


Colors / fonts: Update styles.css.


Popup content: Edit the popup HTML in renderMarkers() in app.js.


Exclude past forever (list is already excluded): You can also hide past from the map by default by unchecking Past in index.html and removing the layer in app.js—but your current setup shows all by default.



Roadmap ideas (optional)
Cluster markers (Leaflet.markercluster).


Add a mini-calendar to filter by month.


Persist filters/search in the URL (for sharing views).


Pull images/thumbnails per event, if available.



License
MIT. Logos and branding (e.g. logo-past.png, logo-soon.png, logo-future.png) are the property of Irreverent Warriors and are not licensed for reuse.




Credits
Map: Leaflet


Tiles: CARTO Light (and OSM data)


CSV parsing: Papa Parse


Geocoding: Nominatim / OpenStreetMap


Development: Nick Sawall


