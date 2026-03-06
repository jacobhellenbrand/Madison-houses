// Madison Properties - Frontend Logic

const DATA_URL = 'data/properties.json';
const HISTORICAL_URL = 'data/all_properties.json';
const COMMERCIAL_URL = 'data/commercial.json';

let allProperties = [];
let historicalProperties = [];
let commercialProposals = [];

// DOM Elements
const propertiesContainer = document.getElementById('properties');
const priceFilter = document.getElementById('price-filter');
const bedsFilter = document.getElementById('beds-filter');
const sortFilter = document.getElementById('sort-filter');
const exportBtn = document.getElementById('export-btn');
const totalListingsEl = document.getElementById('total-listings');
const avgPriceEl = document.getElementById('avg-price');
const lastUpdatedEl = document.getElementById('last-updated');
const allPropertiesBody = document.getElementById('all-properties-body');
const commercialBody = document.getElementById('commercial-body');
const histPriceFilter = document.getElementById('hist-price-filter');
const histBedsFilter = document.getElementById('hist-beds-filter');
const histSortFilter = document.getElementById('hist-sort-filter');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        // Load all data files in parallel
        const [todayResponse, historicalResponse, commercialResponse] = await Promise.all([
            fetch(DATA_URL),
            fetch(HISTORICAL_URL),
            fetch(COMMERCIAL_URL)
        ]);

        if (!todayResponse.ok) {
            throw new Error('Failed to load property data');
        }

        const todayData = await todayResponse.json();
        allProperties = todayData.properties || [];

        // Load historical data (may not exist yet)
        if (historicalResponse.ok) {
            const historicalData = await historicalResponse.json();
            historicalProperties = historicalData.properties || [];
        }

        // Load commercial data (may not exist yet)
        if (commercialResponse.ok) {
            const commercialData = await commercialResponse.json();
            commercialProposals = commercialData.proposals || [];
        }

        // Update last updated timestamp
        if (todayData.lastUpdated) {
            const date = new Date(todayData.lastUpdated);
            lastUpdatedEl.textContent = date.toLocaleDateString();
        }

        // Setup event listeners
        priceFilter.addEventListener('change', renderProperties);
        bedsFilter.addEventListener('change', renderProperties);
        sortFilter.addEventListener('change', renderProperties);
        exportBtn.addEventListener('click', exportToCSV);
        document.getElementById('hist-export-btn').addEventListener('click', exportHistoricalCSV);

        // Setup tab navigation
        setupTabs();

        histPriceFilter.addEventListener('change', renderHistoricalTable);
        histBedsFilter.addEventListener('change', renderHistoricalTable);
        histSortFilter.addEventListener('change', renderHistoricalTable);

        renderProperties();
        renderHistoricalTable();
        renderCommercialTable();
    } catch (error) {
        console.error('Error loading properties:', error);
        propertiesContainer.innerHTML = `
            <div class="error">
                <p>Unable to load properties.</p>
                <p>Make sure the data file exists at ${DATA_URL}</p>
            </div>
        `;
    }
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active tab button
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show corresponding content
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

function renderProperties() {
    let filtered = [...allProperties];

    // Apply price filter
    const minPrice = priceFilter.value;
    if (minPrice) {
        filtered = filtered.filter(p => p.price >= parseInt(minPrice));
    }

    // Apply beds filter
    const minBeds = bedsFilter.value;
    if (minBeds) {
        filtered = filtered.filter(p => p.bedrooms >= parseInt(minBeds));
    }

    // Apply sorting
    const sortBy = sortFilter.value;
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'price-asc':
                return a.price - b.price;
            case 'price-desc':
                return b.price - a.price;
            case 'date-asc':
                return new Date(a.listedDate) - new Date(b.listedDate);
            case 'date-desc':
            default:
                return new Date(b.listedDate) - new Date(a.listedDate);
        }
    });

    // Update stats
    updateStats(filtered);

    // Render cards
    if (filtered.length === 0) {
        propertiesContainer.innerHTML = `
            <div class="no-results">
                <p>No properties match your filters.</p>
                <p>Try adjusting your search criteria.</p>
            </div>
        `;
        return;
    }

    propertiesContainer.innerHTML = filtered.map(property => createPropertyCard(property)).join('');
}

function renderHistoricalTable() {
    if (historicalProperties.length === 0) {
        allPropertiesBody.innerHTML = '<tr><td colspan="9" class="no-results">No historical data yet.</td></tr>';
        return;
    }

    let filtered = [...historicalProperties];

    const minPrice = histPriceFilter.value;
    if (minPrice) filtered = filtered.filter(p => p.price >= parseInt(minPrice));

    const minBeds = histBedsFilter.value;
    if (minBeds) filtered = filtered.filter(p => p.bedrooms >= parseInt(minBeds));

    const sortBy = histSortFilter.value;
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'price-asc': return a.price - b.price;
            case 'price-desc': return b.price - a.price;
            case 'date-asc': return new Date(a.dateAdded || a.listedDate) - new Date(b.dateAdded || b.listedDate);
            case 'date-desc':
            default: return new Date(b.dateAdded || b.listedDate) - new Date(a.dateAdded || a.listedDate);
        }
    });

    if (filtered.length === 0) {
        allPropertiesBody.innerHTML = '<tr><td colspan="9" class="no-results">No properties match your filters.</td></tr>';
        return;
    }

    allPropertiesBody.innerHTML = filtered.map(p => {
        const owner = p.owner || {};
        const agent = p.agent || {};
        const dateAdded = p.dateAdded ? new Date(p.dateAdded).toLocaleDateString() : 'N/A';
        const mapsUrl = buildMapsUrl([p.addressLine1, p.city, p.state, p.zipCode]);

        return `
            <tr>
                <td><a href="${mapsUrl}" target="_blank" rel="noopener">${p.addressLine1 || 'N/A'}</a></td>
                <td>${p.city || 'N/A'}</td>
                <td>${formatPrice(p.price)}</td>
                <td>${p.bedrooms || '--'}</td>
                <td>${p.bathrooms || '--'}</td>
                <td>${formatSqft(p.squareFootage)}</td>
                <td>${owner.owner1 || '--'}</td>
                <td>${agent.name || '--'}</td>
                <td>${dateAdded}</td>
            </tr>
        `;
    }).join('');
}


function renderCommercialTable() {
    if (commercialProposals.length === 0) {
        commercialBody.innerHTML = '<tr><td colspan="7" class="no-results">No permits found.</td></tr>';
        return;
    }

    // Sort by issuance date descending (newest first)
    const sorted = [...commercialProposals].sort((a, b) => {
        return new Date(b.issuanceDate || 0) - new Date(a.issuanceDate || 0);
    });

    commercialBody.innerHTML = sorted.map(p => {
        const descShort = (p.description || '').substring(0, 120) + (p.description && p.description.length > 120 ? '...' : '');
        const mapsUrl = buildMapsUrl([p.address, 'Madison', 'WI']);
        return `
            <tr>
                <td class="permit-number-cell">${p.permitNumber || 'N/A'}</td>
                <td class="address-cell"><a href="${mapsUrl}" target="_blank" rel="noopener">${p.address || 'N/A'}</a></td>
                <td class="details-cell">${descShort}</td>
                <td>${p.owner || 'N/A'}</td>
                <td class="owner-address-cell">${p.ownerAddress || 'N/A'}</td>
                <td>${p.estimatedCost || 'N/A'}</td>
                <td>${p.issuanceDate || 'N/A'}</td>
            </tr>
        `;
    }).join('');
}

function buildMapsUrl(parts) {
    const query = parts.filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function createPropertyCard(property) {
    const formattedPrice = formatPrice(property.price);
    const address = formatAddress(property);
    const mapsUrl = buildMapsUrl([property.addressLine1, property.city, property.state, property.zipCode]);
    const listedDate = property.listedDate
        ? new Date(property.listedDate).toLocaleDateString()
        : 'N/A';

    const agent = property.agent || {};
    const office = property.office || {};
    const agentInfo = formatAgentInfo(agent, office);

    return `
        <article class="property-card">
            <div class="property-image">
                🏠
            </div>
            <div class="property-details">
                <div class="property-price">${formattedPrice}</div>
                <div class="property-address"><a href="${mapsUrl}" target="_blank" rel="noopener">${address}</a></div>
                <div class="property-features">
                    <span class="feature"><strong>${property.bedrooms || '--'}</strong> beds</span>
                    <span class="feature"><strong>${property.bathrooms || '--'}</strong> baths</span>
                    <span class="feature"><strong>${formatSqft(property.squareFootage)}</strong> sqft</span>
                </div>
                ${agentInfo}
                <div class="property-meta">
                    <span class="property-type">${property.propertyType || 'Residential'}</span>
                    <span>Listed: ${listedDate}</span>
                </div>
            </div>
        </article>
    `;
}

function formatAgentInfo(agent, office) {
    const parts = [];

    if (agent.name) {
        let agentLine = `<strong>${agent.name}</strong>`;
        if (agent.phone) {
            agentLine += ` <a href="tel:${agent.phone}">${formatPhone(agent.phone)}</a>`;
        }
        parts.push(agentLine);
    }

    if (agent.email) {
        parts.push(`<a href="mailto:${agent.email}">${agent.email}</a>`);
    }

    if (office.name) {
        parts.push(`<span class="office-name">${office.name}</span>`);
    }

    if (parts.length === 0) return '';

    return `<div class="agent-info">${parts.join('<br>')}</div>`;
}

function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

function updateStats(properties) {
    totalListingsEl.textContent = properties.length;

    if (properties.length > 0) {
        const totalPrice = properties.reduce((sum, p) => sum + (p.price || 0), 0);
        const avg = totalPrice / properties.length;
        avgPriceEl.textContent = formatPrice(avg);
    } else {
        avgPriceEl.textContent = '--';
    }
}

function formatPrice(price) {
    if (!price) return 'Price N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(price);
}

function formatAddress(property) {
    const parts = [
        property.addressLine1,
        property.city,
        property.state,
        property.zipCode
    ].filter(Boolean);

    return parts.join(', ') || 'Address not available';
}

function formatSqft(sqft) {
    if (!sqft) return '--';
    return new Intl.NumberFormat('en-US').format(sqft);
}

function exportToCSV() {
    const dataToExport = allProperties;

    if (dataToExport.length === 0) {
        alert('No properties to export');
        return;
    }

    const headers = [
        'Address',
        'City',
        'State',
        'Zip Code',
        'Price',
        'Bedrooms',
        'Bathrooms',
        'Square Footage',
        'Property Type',
        'Listed Date',
        'Days on Market',
        'Owner 1',
        'Owner 2',
        'Agent Name',
        'Agent Phone',
        'Agent Email',
        'Office Name',
        'Office Phone',
        'Latitude',
        'Longitude',
        'Date Added'
    ];

    const rows = dataToExport.map(p => {
        const agent = p.agent || {};
        const office = p.office || {};
        const owner = p.owner || {};
        return [
            p.addressLine1 || '',
            p.city || '',
            p.state || '',
            p.zipCode || '',
            p.price || '',
            p.bedrooms || '',
            p.bathrooms || '',
            p.squareFootage || '',
            p.propertyType || '',
            p.listedDate ? new Date(p.listedDate).toLocaleDateString() : '',
            p.daysOnMarket || '',
            owner.owner1 || '',
            owner.owner2 || '',
            agent.name || '',
            agent.phone || '',
            agent.email || '',
            office.name || '',
            office.phone || '',
            p.latitude || '',
            p.longitude || '',
            p.dateAdded ? new Date(p.dateAdded).toLocaleDateString() : ''
        ];
    });

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const filename = `madison-properties-${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportHistoricalCSV() {
    // Export with current filters applied
    let dataToExport = [...historicalProperties];
    const minPrice = histPriceFilter.value;
    if (minPrice) dataToExport = dataToExport.filter(p => p.price >= parseInt(minPrice));
    const minBeds = histBedsFilter.value;
    if (minBeds) dataToExport = dataToExport.filter(p => p.bedrooms >= parseInt(minBeds));

    if (dataToExport.length === 0) {
        alert('No properties to export');
        return;
    }

    const headers = [
        'Address', 'City', 'State', 'Zip Code', 'Price', 'Bedrooms', 'Bathrooms',
        'Square Footage', 'Property Type', 'Listed Date', 'Days on Market',
        'Owner 1', 'Owner 2', 'Agent Name', 'Agent Phone', 'Agent Email',
        'Office Name', 'Office Phone', 'Latitude', 'Longitude', 'Date Added'
    ];

    const rows = dataToExport.map(p => {
        const agent = p.agent || {};
        const office = p.office || {};
        const owner = p.owner || {};
        return [
            p.addressLine1 || '', p.city || '', p.state || '', p.zipCode || '',
            p.price || '', p.bedrooms || '', p.bathrooms || '', p.squareFootage || '',
            p.propertyType || '',
            p.listedDate ? new Date(p.listedDate).toLocaleDateString() : '',
            p.daysOnMarket || '', owner.owner1 || '', owner.owner2 || '',
            agent.name || '', agent.phone || '', agent.email || '',
            office.name || '', office.phone || '',
            p.latitude || '', p.longitude || '',
            p.dateAdded ? new Date(p.dateAdded).toLocaleDateString() : ''
        ];
    });

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `madison-all-residential-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportCommercialCSV() {
    const dataToExport = [...commercialProposals];

    if (dataToExport.length === 0) {
        alert('No permits to export');
        return;
    }

    const headers = [
        'Permit #',
        'Address',
        'Description',
        'Owner',
        'Owner Address',
        'Est. Cost',
        'Issuance Date'
    ];

    const rows = dataToExport.map(p => [
        p.permitNumber || '',
        p.address || '',
        p.description || '',
        p.owner || '',
        p.ownerAddress || '',
        p.estimatedCost || '',
        p.issuanceDate || ''
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `madison-commercial-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
