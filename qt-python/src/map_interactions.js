// Define global variables immediately
window.myDrawnItems = new L.FeatureGroup();

window.getGeoJSON = function () {
    return JSON.stringify(window.myDrawnItems.toGeoJSON());
};

window.clearMap = function () {
    window.myDrawnItems.clearLayers();
    // Also try to clear map layers if they were added directly
    // This depends on how the Draw plugin handles layers, but myDrawnItems is our tracker
};

window.loadGeoJSON = function (geojson) {
    if (typeof geojson === 'string') {
        geojson = JSON.parse(geojson);
    }

    L.geoJSON(geojson, {
        onEachFeature: function (feature, layer) {
            window.myDrawnItems.addLayer(layer);

            // If we have a map instance available, add it there too just in case
            // though myDrawnItems should be on the map already.
            for (var key in window) {
                if (window[key] instanceof L.Map) {
                    window[key].addLayer(layer);
                    break;
                }
            }
        }
    });
};

// Initialization function
function initMapInteractions() {
    var map = null;
    // Find the map instance
    for (var key in window) {
        if (window[key] instanceof L.Map) {
            map = window[key];
            break;
        }
    }

    if (map) {
        console.log("Map found, initializing interactions.");
        map.addLayer(window.myDrawnItems);

        // Listen for creation events
        map.on('draw:created', function (e) {
            var layer = e.layer;
            window.myDrawnItems.addLayer(layer);
            map.addLayer(layer); // Ensure it is visible if the plugin does not do it
        });

        // Handle deletion if the user uses the edit tool to delete
        map.on('draw:deleted', function (e) {
            var layers = e.layers;
            layers.eachLayer(function (layer) {
                window.myDrawnItems.removeLayer(layer);
            });
        });
    } else {
        console.log("Map not found yet, retrying...");
        setTimeout(initMapInteractions, 500);
    }
}

// Start when the document is ready
if (document.readyState === 'complete') {
    initMapInteractions();
} else {
    window.addEventListener('load', initMapInteractions);
}
