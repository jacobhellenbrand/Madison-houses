// Madison Properties - Frontend Logic

const HISTORICAL_URL = 'data/all_properties.json';
const COMMERCIAL_URL = 'data/commercial.json';
const DEVELOPMENTS_URL = 'data/developments.json';

let historicalProperties = [];
let commercialProposals = [];
let developments = [];

// DOM Elements
const allPropertiesBody = document.getElementById('all-properties-body');
const commercialBody = document.getElementById('commercial-body');
const developmentsBody = document.getElementById('developments-body');
const histPriceFilter = document.getElementById('hist-price-filter');
const histBedsFilter = document.getElementById('hist-beds-filter');
const histSortFilter = document.getElementById('hist-sort-filter');
const histDateFilter = document.getElementById('hist-date-filter');
const individualsFilter = document.getElementById('individuals-filter');
const newBuildFilter = document.getElementById('new-build-filter');
const histSkipFilter = document.getElementById('hist-skip-filter');

const BUSINESS_KEYWORDS = [
    'llc', 'inc', 'corp', 'trust', 'tr ', ' tr', 'properties', 'holdings',
    'realty', 'investments', 'partners', 'group', 'association', 'assoc',
    'enterprises', 'company', 'co.', 'fund', 'estate', 'management', 'mgmt',
    'services', 'development', 'ventures', 'limited', 'ltd', 'city of',
    'county of', 'state of', 'village of', 'town of', 'university', 'church',
    'school', 'foundation', 'nonprofit', 'authority'
];

// --- Skip / Vacant tracking (localStorage) ---
function getSkippedIds() {
    try {
        return new Set(JSON.parse(localStorage.getItem('madison_skipped') || '[]'));
    } catch {
        return new Set();
    }
}

function saveSkippedIds(ids) {
    localStorage.setItem('madison_skipped', JSON.stringify([...ids]));
}

function toggleSkip(id) {
    const skipped = getSkippedIds();
    if (skipped.has(id)) {
        skipped.delete(id);
    } else {
        skipped.add(id);
    }
    saveSkippedIds(skipped);
    renderProperties();
    renderHistoricalTable();
}

function buildZillowUrl(address, city, state, zip) {
    const parts = [address, city, state, zip].filter(Boolean).join(' ');
    return `https://www.zillow.com/homes/${encodeURIComponent(parts)}_rb/`;
}

function isIndividualOwner(ownerName) {
    if (!ownerName) return false;
    const lower = ownerName.toLowerCase();
    return !BUSINESS_KEYWORDS.some(kw => lower.includes(kw));
}

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        const [historicalResponse, commercialResponse] = await Promise.all([
            fetch(HISTORICAL_URL),
            fetch(COMMERCIAL_URL)
        ]);

        if (historicalResponse.ok) {
            const historicalData = await historicalResponse.json();
            historicalProperties = historicalData.properties || [];
        }

        if (commercialResponse.ok) {
            const commercialData = await commercialResponse.json();
            commercialProposals = commercialData.proposals || [];
        }

        // Setup event listeners
        document.getElementById('hist-export-btn').addEventListener('click', exportHistoricalCSV);
        setupTabs();

        histPriceFilter.addEventListener('change', renderHistoricalTable);
        histBedsFilter.addEventListener('change', renderHistoricalTable);
        histSortFilter.addEventListener('change', renderHistoricalTable);
        histDateFilter.addEventListener('change', renderHistoricalTable);
        individualsFilter.addEventListener('change', renderHistoricalTable);
        newBuildFilter.addEventListener('change', renderHistoricalTable);
        histSkipFilter.addEventListener('change', renderHistoricalTable);

        renderHistoricalTable();
        renderCommercialTable();

        // Load developments independently so a fetch failure doesn't break the rest
        try {
            const devResponse = await fetch(DEVELOPMENTS_URL);
            if (devResponse.ok) {
                const devData = await devResponse.json();
                developments = devData.proposals || [];
            }
        } catch (devError) {
            console.warn('Could not load developments data:', devError);
        }
        renderDevelopmentsTable();
    } catch (error) {
        console.error('Error loading data:', error);
        allPropertiesBody.innerHTML = `
            <tr><td colspan="11" class="error">Unable to load data.</td></tr>
        `;
    }
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
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

    const fromDate = histDateFilter.value;
    if (fromDate) {
        filtered = filtered.filter(p => {
            const d = p.dateAdded || p.listedDate;
            return d && new Date(d) >= new Date(fromDate);
        });
    }

    if (individualsFilter.value === 'individuals') {
        filtered = filtered.filter(p => isIndividualOwner((p.owner || {}).owner1));
    }

    if (newBuildFilter.value === 'hide') {
        filtered = filtered.filter(p => !p.yearBuilt || p.yearBuilt < 2024);
    }

    const skipped = getSkippedIds();
    if (histSkipFilter.value === 'hide') {
        filtered = filtered.filter(p => !skipped.has(p.id));
    }

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
        allPropertiesBody.innerHTML = '<tr><td colspan="11" class="no-results">No properties match your filters.</td></tr>';
        return;
    }

    const skippedIds = getSkippedIds();
    allPropertiesBody.innerHTML = filtered.map(p => {
        const owner = p.owner || {};
        const agent = p.agent || {};
        const dateAdded = p.dateAdded ? new Date(p.dateAdded).toLocaleDateString() : 'N/A';
        const mapsUrl = buildMapsUrl([p.addressLine1, p.city, p.state, p.zipCode]);
        const zillowUrl = buildZillowUrl(p.addressLine1, p.city, p.state, p.zipCode);
        const isSkipped = skippedIds.has(p.id);
        const isNewBuild = p.yearBuilt && p.yearBuilt >= 2024;
        const yearBuiltDisplay = p.yearBuilt
            ? `${p.yearBuilt}${isNewBuild ? ' <span class="new-build-badge">NEW</span>' : ''}`
            : '--';

        return `
            <tr class="${isSkipped ? 'row-skipped' : ''}${isNewBuild ? ' row-new-build' : ''}">
                <td><a href="${mapsUrl}" target="_blank" rel="noopener">${p.addressLine1 || 'N/A'}</a></td>
                <td>${p.city || 'N/A'}</td>
                <td>${formatPrice(p.price)}</td>
                <td>${p.bedrooms || '--'}</td>
                <td>${p.bathrooms || '--'}</td>
                <td>${formatSqft(p.squareFootage)}</td>
                <td>${owner.owner1 || '--'}</td>
                <td>${agent.name || '--'}</td>
                <td>${yearBuiltDisplay}</td>
                <td>${dateAdded}</td>
                <td class="actions-cell">
                    <a href="${zillowUrl}" target="_blank" rel="noopener" class="action-btn zillow-btn" title="View on Zillow">Zillow</a>
                    <button onclick="toggleSkip('${p.id}')" class="action-btn skip-btn ${isSkipped ? 'skip-btn-active' : ''}" title="${isSkipped ? 'Mark as sendable' : 'Skip (new/vacant)'}">
                        ${isSkipped ? 'Skipped' : 'Skip'}
                    </button>
                </td>
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

function renderDevelopmentsTable() {
    if (developments.length === 0) {
        developmentsBody.innerHTML = '<tr><td colspan="5" class="no-results">No developments found.</td></tr>';
        return;
    }

    const sorted = [...developments].sort((a, b) =>
        new Date(b.submittedDate || 0) - new Date(a.submittedDate || 0)
    );

    developmentsBody.innerHTML = sorted.map(p => {
        const mapsUrl = buildMapsUrl([p.address, 'Madison', 'WI']);
        const detailsShort = (p.details || '').substring(0, 150) + (p.details && p.details.length > 150 ? '...' : '');
        const statusMatch = p.details && p.details.match(/Status:(.*?)(?:$)/);
        const status = statusMatch ? statusMatch[1].trim() : 'Under Review';
        const detailLink = p.detailUrl
            ? `<a href="${p.detailUrl}" target="_blank" rel="noopener">${p.address || 'N/A'}</a>`
            : `<a href="${mapsUrl}" target="_blank" rel="noopener">${p.address || 'N/A'}</a>`;

        return `
            <tr>
                <td class="address-cell">${detailLink}</td>
                <td><span class="category-badge">${p.category || 'Commercial'}</span></td>
                <td class="details-cell">${detailsShort}</td>
                <td>${p.submittedText || 'N/A'}</td>
                <td>${status}</td>
            </tr>
        `;
    }).join('');
}

function buildMapsUrl(parts) {
    const query = parts.filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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

function exportHistoricalCSV() {
    // Export with current filters applied
    let dataToExport = [...historicalProperties];
    const minPrice = histPriceFilter.value;
    if (minPrice) dataToExport = dataToExport.filter(p => p.price >= parseInt(minPrice));
    const minBeds = histBedsFilter.value;
    if (minBeds) dataToExport = dataToExport.filter(p => p.bedrooms >= parseInt(minBeds));
    const fromDate = histDateFilter.value;
    if (fromDate) dataToExport = dataToExport.filter(p => {
        const d = p.dateAdded || p.listedDate;
        return d && new Date(d) >= new Date(fromDate);
    });
    if (individualsFilter.value === 'individuals') {
        dataToExport = dataToExport.filter(p => isIndividualOwner((p.owner || {}).owner1));
    }

    if (dataToExport.length === 0) {
        alert('No properties to export');
        return;
    }

    const headers = [
        'Address', 'City', 'State', 'Zip Code', 'Price', 'Bedrooms', 'Bathrooms',
        'Square Footage', 'Property Type', 'Year Built', 'Listed Date', 'Days on Market',
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
            p.propertyType || '', p.yearBuilt || '',
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
