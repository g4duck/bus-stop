// Haversine formula 
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Fetch Stop List data with sessionStorage caching
const fetchStopList = async () => {
  const cachedStops = sessionStorage.getItem('kmbStops');
  if (cachedStops) return JSON.parse(cachedStops);
  try {
    const response = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/stop');
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    const StopsData = data.data.map(({ stop, name_en, lat, long }) => ({
      stop,
      name_en,
      lat: parseFloat(lat),
      long: parseFloat(long),
    }));
    sessionStorage.setItem('kmbStops', JSON.stringify(StopsData));
    return StopsData;
  } catch (error) {
    console.error('Error fetching Stop List:', error);
    throw error;
  }
};

// Fetch ETA data for a selected stop
const fetchETA = async (stopId) => {
  try {
    const response = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${stopId}`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching ETA:', error);
    return null;
  }
};

// Process ETA data
const processETAData = (etaData) => {
  if (!etaData || etaData.length === 0) return [];
  const routeMap = new Map();
  etaData.forEach((eta) => {
    if (eta.eta === null) return;
    const key = `${eta.route}-${eta.dir}`;
    if (!routeMap.has(key)) {
      routeMap.set(key, {
        route: eta.route,
        dir: eta.dir === 'O' ? 'Outbound' : 'Inbound',
        dest_en: eta.dest_en,
        etas: new Set(),
      });
    }
    routeMap.get(key).etas.add(eta.eta);
  });
  return Array.from(routeMap.values()).map((entry) => ({
    route: entry.route,
    dir: entry.dir,
    dest_en: entry.dest_en,
    etas: Array.from(entry.etas).slice(0, 3),
  }));
};

// Format time as h:mm AM/PM
const formatTime = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

// Calculate midpoint between two coordinates
const getMidpoint = (lat1, lon1, lat2, lon2) => {
  return [(lat1 + lat2) / 2, (lon1 + lon2) / 2];
};

// Different zoom levels based on radius
const getZoomLevel = (radius) => {
  if (radius <= 100) return 18;
  if (radius <= 300) return 17;
  return 16;
};

// Initialize map with OpenLayers
let map = null;
const initMap = (userLat, userLon, radius) => {
  if (map) {
    map.setTarget(null);
    map = null;
  }

  const zoom = getZoomLevel(radius);
  map = new ol.Map({
    target: 'map',
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM(),
      }),
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([userLon, userLat]),
      zoom: zoom,
    }),
  });

  const userFeature = new ol.Feature({
    geometry: new ol.geom.Point(ol.proj.fromLonLat([userLon, userLat])),
  });
  userFeature.setStyle(
    new ol.style.Style({
      image: new ol.style.Icon({
        src: 'map-marker.ico',
        scale: 0.7,
        anchor: [0.5, 1],
      }),
    })
  );

  const vectorLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: [userFeature],
    }),
  });
  map.addLayer(vectorLayer);
};

// Update map with selected stop
const updateMap = (userLat, userLon, stopLat, stopLon, radius) => {
  if (map) {
    map.setTarget(null);
    map = null;
  }

  const [midLat, midLon] = getMidpoint(userLat, userLon, stopLat, stopLon);
  const zoom = getZoomLevel(radius);
  map = new ol.Map({
    target: 'map',
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM(),
      }),
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([midLon, midLat]),
      zoom: zoom,
    }),
  });

  const userFeature = new ol.Feature({
    geometry: new ol.geom.Point(ol.proj.fromLonLat([userLon, userLat])),
  });
  userFeature.setStyle(
    new ol.style.Style({
      image: new ol.style.Icon({
        src: 'map-marker.ico',
        scale: 0.7,
        anchor: [0.5, 1],
      }),
    })
  );

  const stopFeature = new ol.Feature({
    geometry: new ol.geom.Point(ol.proj.fromLonLat([stopLon, stopLat])),
  });
  stopFeature.setStyle(
    new ol.style.Style({
      image: new ol.style.Icon({
        src: 'bus-icon.ico',
        scale: 0.7,
        anchor: [0.5, 1],
      }),
    })
  );

  const vectorLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: [userFeature, stopFeature],
    }),
  });
  map.addLayer(vectorLayer);
};

// Display nearby stops and handle ETA
const updateNearbyStops = async (userLat, userLon, radius) => {
  const outputDiv = document.getElementById('output');
  const container = document.querySelector('.container');
  const mapElement = document.getElementById('map');

  if (mapElement.parentNode !== container) {
    container.appendChild(mapElement);
  }

  outputDiv.innerHTML = 'Loading stops...';

  try {
    const stops = await fetchStopList();
    const stopsWithDistance = stops
      .map((stop) => ({
        ...stop,
        distance: calculateDistance(userLat, userLon, stop.lat, stop.long),
      }))
      .filter((stop) => stop.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    initMap(userLat, userLon, radius);

    if (stopsWithDistance.length > 0) {
      const ul = document.createElement('ul');
      stopsWithDistance.forEach((stop) => {
        const li = document.createElement('li');
        const stopInfo = document.createElement('div');
        stopInfo.classList.add('stop-info');
        stopInfo.innerHTML = `
          <span class="distance">Distance: ${Math.round(stop.distance)}m</span>
          <span class="stop">Stop: <a href="#" class="stop-link">${stop.name_en}</a></span>
        `;
        li.appendChild(stopInfo);

        const etaContainer = document.createElement('div');
        etaContainer.classList.add('eta-details');
        li.appendChild(etaContainer);

        const stopLink = stopInfo.querySelector('.stop-link');
        stopLink.addEventListener('click', async (e) => {
          e.preventDefault();
          const allLis = ul.getElementsByTagName('li');
          for (let item of allLis) {
            item.classList.remove('selected');
            item.querySelector('.eta-details').innerHTML = '';
          }
          li.classList.add('selected');
          li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

          const etaData = await fetchETA(stop.stop);
          const processedETA = processETAData(etaData);
          if (processedETA.length > 0) {
            let etaContent = '<table><tr><th>Route</th><th>Direction</th><th>Destination</th><th>ETAs</th></tr>';
            processedETA.forEach((entry) => {
              const etaTimes = entry.etas.map((eta) => `<span class="eta-time">${formatTime(eta)}</span>`).join(', ');
              etaContent += `<tr><td>${entry.route}</td><td>${entry.dir}</td><td>${entry.dest_en}</td><td>${etaTimes}</td></tr>`;
            });
            etaContent += '</table>';
            etaContainer.innerHTML = etaContent;
          } else {
            etaContainer.innerHTML = '<p class="no-info">No bus route information</p>';
          }

          updateMap(userLat, userLon, stop.lat, stop.long, radius);

          if (window.innerWidth <= 500) {
            setTimeout(() => {
              mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100); 
          }
        });
        ul.appendChild(li);
      });
      outputDiv.innerHTML = '<h3>Nearby Bus Stops</h3>';
      outputDiv.appendChild(ul);
    } else {
      outputDiv.innerHTML = '<p>Cannot locate nearby bus stops</p>';
    }
  } catch (error) {
    outputDiv.innerHTML = '<p>Failed to load bus stop data</p>';
    console.error('Error in updateNearbyStops:', error);
  }
};

// Initialize app on page load or reload
document.addEventListener('DOMContentLoaded', () => {
  const radiusSelect = document.getElementById('meter');
  let currentRadius = parseInt(radiusSelect.value);
  let userLat = null;
  let userLon = null;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLat = position.coords.latitude;
      userLon = position.coords.longitude;
      updateNearbyStops(userLat, userLon, currentRadius);
    },
    (error) => {
      console.error('Geolocation error:', error);
      document.getElementById('output').innerHTML = '<p>Unable to get location. Please enable location services.</p>';
    }
  );

  radiusSelect.addEventListener('change', (e) => {
    currentRadius = parseInt(e.target.value);
    if (userLat !== null && userLon !== null) {
      updateNearbyStops(userLat, userLon, currentRadius);
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLat = position.coords.latitude;
          userLon = position.coords.longitude;
          updateNearbyStops(userLat, userLon, currentRadius);
        },
        (error) => {
          document.getElementById('output').innerHTML = '<p>Location unavailable</p>';
        }
      );
    }
  });
});