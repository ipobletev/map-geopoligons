// Define global variables immediately
window.myDrawnItems = new L.FeatureGroup();
window.staticLayers = new L.FeatureGroup();

window.getGeoJSON = function () {
    return JSON.stringify(window.myDrawnItems.toGeoJSON());
};

window.clearMap = function () {
    window.myDrawnItems.clearLayers();
};

window.clearAll = function () {
    window.myDrawnItems.clearLayers();
    window.staticLayers.clearLayers();
};

window.clearStaticLayers = function () {
    window.staticLayers.clearLayers();
};

window.addStaticGeoJSON = function (geojson, color) {
    if (typeof geojson === 'string') {
        geojson = JSON.parse(geojson);
    }

    L.geoJSON(geojson, {
        style: function (feature) {
            return { color: color || '#888888', weight: 2, opacity: 0.6 };
        },
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 6,
                fillColor: color || "#888888",
                color: "#000",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.6
            });
        },
        onEachFeature: function (feature, layer) {
            window.staticLayers.addLayer(layer);
        }
    });
};

window.setEditableGeoJSON = function (geojson) {
    window.myDrawnItems.clearLayers();
    if (typeof geojson === 'string') {
        geojson = JSON.parse(geojson);
    }

    L.geoJSON(geojson, {
        onEachFeature: function (feature, layer) {
            window.myDrawnItems.addLayer(layer);
            // Ensure it is added to the map if not already handled by FeatureGroup
            // But since myDrawnItems is on the map, it should be fine.
            // However, for editing to work, the Draw plugin needs to know about these layers?
            // The Draw plugin works on the FeatureGroup passed to it.
            // So adding to myDrawnItems is correct.
        }
    });
};

window.loadGeoJSON = function (geojson) {
    // Legacy support or direct load
    window.setEditableGeoJSON(geojson);
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
        map.addLayer(window.staticLayers);

        // Listen for creation events
        map.on('draw:created', function (e) {
            var layer = e.layer;
            window.myDrawnItems.addLayer(layer);
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
