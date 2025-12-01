// --- SUPABASE CONFIG ---
const SUPABASE_URL = "https://vkrqtawjhrxmtuthhhdq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcnF0YXdqaHJ4bXR1dGhoaGRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDY5NTUsImV4cCI6MjA3OTg4Mjk1NX0.JtR03A5VWlc5Xe95V2_jS5TWOweawlcgPFBOjeu-dUA";

// --- LAYERS CONFIGURATION (Original Labels Preserved) ---
const layersConfig = [
    // POINTS
    { table: 'ravines', type: 'point', color: '#e63946', label: 'Ravines points' },
    { table: 'gestion_dechet', type: 'point', color: '#d35400', label: 'Gestion Dechet' },
    { table: 'protection_resurgence', type: 'point', color: '#3498db', label: 'Protection resurgence' },
    
    // LINES
    { table: 'line_protection_riviere', type: 'line', color: '#f1c40f', label: 'Line protection riviere' },
    { table: 'projection_de_ravins', type: 'line', color: '#2980b9', label: 'Projection de ravins' },
    
    // POLYGONS
    { table: 'zone_de_culture_perenne_100m', type: 'polygon', color: '#2ecc71', label: 'Zone de culture perenne' },
    { table: 'limite_baraderes_cayemites', type: 'polygon', color: '#27ae60', label: 'Limite Baraderes' },
    { table: 'parcelle_socioeconomique', type: 'polygon', color: '#f39c12', label: 'Parcelle Socioec.' },
    { table: 'restauration_mangroves', type: 'polygon', color: '#16a085', label: 'Restauration mangroves' },
    { table: 'versants_degrades', type: 'polygon', color: '#c0392b', label: 'Versants degrades' },
    { table: 'zone_bande_riveraine_15m', type: 'polygon', color: '#8e44ad', label: 'Zone bande riveraine' }
];

// Map Initialization
const map = L.map('map', { zoomControl: false }).setView([18.5, -73.8], 11);
L.control.zoom({ position: 'topright' }).addTo(map);

// References
const mapLayers = {}; 
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' });
const satLayer = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '© Google Satellite' });

// --- PANE Z-INDEX SETUP (Order Priority) ---
map.createPane('polygonsPane'); map.getPane('polygonsPane').style.zIndex = 400;
map.createPane('linesPane');    map.getPane('linesPane').style.zIndex = 450;
map.createPane('pointsPane');   map.getPane('pointsPane').style.zIndex = 500;

// --- CORE FUNCTIONS ---

function changeBasemap(type) {
    if (type === 'osm') {
        map.addLayer(osmLayer);
        map.removeLayer(satLayer);
    } else {
        map.addLayer(satLayer);
        map.removeLayer(osmLayer);
    }
}

async function fetchLayerData(config) {
    const url = `${SUPABASE_URL}/rest/v1/${config.table}?select=*`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Accept': 'application/geo+json'
            }
        });
        if (!response.ok) throw new Error(`Error ${config.table}`);
        return await response.json();
    } catch (err) {
        console.error(err);
        return null;
    }
}

function createGeoJsonLayer(data, config) {
    // Determine Correct Pane
    let paneName = 'pointsPane';
    if(config.type === 'line') paneName = 'linesPane';
    if(config.type === 'polygon') paneName = 'polygonsPane';

    return L.geoJSON(data, {
        pane: paneName,
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 6,
                fillColor: config.color,
                color: "#fff",
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.9
            });
        },
        style: function (feature) {
            return {
                color: config.color,
                weight: config.type === 'line' ? 3 : 2,
                opacity: 1,
                fillOpacity: config.type === 'polygon' ? 0.4 : 0
            };
        },
        onEachFeature: function (feature, layer) {
            // Modern Popup
            let popupContent = `
                <div class="popup-header" style="background:${config.color}">${config.label}</div>
                <div class="popup-body">
                <table class="popup-table">`;
            
            for (const [key, value] of Object.entries(feature.properties)) {
                const displayValue = value === null ? '-' : value;
                popupContent += `<tr><td class="popup-key">${key}</td><td class="popup-val">${displayValue}</td></tr>`;
            }
            popupContent += `</table></div>`;
            layer.bindPopup(popupContent);
        }
    });
}

// Window functions for HTML interaction
window.toggleLayer = function(tableName) {
    if (map.hasLayer(mapLayers[tableName])) {
        map.removeLayer(mapLayers[tableName]);
    } else {
        map.addLayer(mapLayers[tableName]);
    }
}

window.changeBasemap = changeBasemap;

// --- APP INIT ---
async function initApp() {
    // 1. Load default basemap
    osmLayer.addTo(map);

    const layersContainer = document.getElementById('layers-container');
    const statsContainer = document.getElementById('stats-container');
    const loader = document.getElementById('global-loader');

    // UI Groups (English)
    const groups = { 
        'point': { icon: 'fa-location-dot', name: 'POINTS' }, 
        'line': { icon: 'fa-route', name: 'LINES' }, 
        'polygon': { icon: 'fa-vector-square', name: 'POLYGONS' } 
    };

    let currentType = '';
    
    // Generate Sidebar Items
    layersConfig.forEach(config => {
        // Group Titles
        if (config.type !== currentType) {
            currentType = config.type;
            const groupTitle = document.createElement('div');
            groupTitle.className = 'layer-group-title';
            groupTitle.innerHTML = `<i class="fa-solid ${groups[config.type].icon}"></i> ${groups[config.type].name}`;
            layersContainer.appendChild(groupTitle);
        }

        // Layer Item
        const div = document.createElement('div');
        div.className = 'layer-item';
        div.innerHTML = `
            <div class="layer-info">
                <span class="color-dot" style="background:${config.color}"></span>
                ${config.label}
            </div>
            <label class="switch">
                <input type="checkbox" id="chk-${config.table}" checked onchange="toggleLayer('${config.table}')">
                <span class="slider"></span>
            </label>
        `;
        layersContainer.appendChild(div);
    });

    // Clear loading stats
    statsContainer.innerHTML = '';

    // Fetch and Load Data
    const promises = layersConfig.map(async (config) => {
        const data = await fetchLayerData(config);
        
        let count = 0;
        if (data && data.features) {
            const layer = createGeoJsonLayer(data, config);
            mapLayers[config.table] = layer;
            layer.addTo(map);
            count = data.features.length;
        }

        return { label: config.label, count: count, color: config.color };
    });

    const results = await Promise.all(promises);

    // Render Stats
    results.forEach(stat => {
        const div = document.createElement('div');
        div.className = 'stat-item';
        div.innerHTML = `
            <span style="border-left: 3px solid ${stat.color}; padding-left:8px;">${stat.label}</span>
            <span class="stat-badge" style="background:${stat.count > 0 ? '#2ecc71' : '#ccc'}">${stat.count}</span>
        `;
        statsContainer.appendChild(div);
    });

    // Hide Loader
    loader.style.display = 'none';
}

// Start
initApp();