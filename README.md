# KMB Bus Service App

The KMB Bus Service App is a web-based application that helps users find nearby Kowloon Motor Bus (KMB) stops in Hong Kong based on their current location. It displays stop names, distances, associated bus route numbers, and estimated arrival times (ETA) for buses, along with an interactive map showing the user’s location and selected stops. Built with JavaScript, OpenLayers, and the KMB Open API, the app is fully responsive for mobile and desktop use.

## Features
-Geolocation-Based Stop Finder: Locates nearby KMB bus stops within a user-selected radius (100m to 500m) using the browser’s geolocation API.

-Route Display: Shows bus route numbers next to each stop name, allowing users to see available routes without clicking.

-ETA Information: Displays detailed ETA for selected stops, including route, direction, destination, and up to three arrival times.

-Interactive Map: Uses OpenLayers to show the user’s location and selected stop on an OpenStreetMap, with a "Your Location" popup above the user marker.

## Tech Stack
-Frontend: HTML, CSS, JavaScript

-Map Library: OpenLayers (v9.4.0)

-API: KMB Open Data API (https://data.etabus.gov.hk)



