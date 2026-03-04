// Madison Properties - Frontend Logic

const DATA_URL = 'data/properties.json';
const HISTORICAL_URL = 'data/all_properties.json';
const COMMERCIAL_URL = 'data/commercial.json';

let allProperties = [];
let historicalProperties = [];
let commercialProposals = [];
let currentCommercialCategory = '';

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

        // Setup tab navigation
        setupTabs();

        // Setup commercial category filters
        setupCommercialFilters();

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
    const maxPrice = priceFilter.value;
    if (maxPrice) {
        filtered = filtered.filter(p => p.price <= parseInt(maxPrice));
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

    // Sort by dateAdded descending (newest first)
    const sorted = [...historicalProperties].sort((a, b) => {
        return new Date(b.dateAdded || b.listedDate) - new Date(a.dateAdded || a.listedDate);
    });

    allPropertiesBody.innerHTML = sorted.map(p => {
        const owner = p.owner || {};
        const agent = p.agent || {};
        const dateAdded = p.dateAdded ? new Date(p.dateAdded).toLocaleDateString() : 'N/A';

        return `
            <tr>
                <td>${p.addressLine1 || 'N/A'}</td>
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

function setupCommercialFilters() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCommercialCategory = btn.dataset.category;
            renderCommercialTable();
        });
    });
}

function renderCommercialTable() {
    if (commercialProposals.length === 0) {
        commercialBody.innerHTML = '<tr><td colspan="5" class="no-results">No commercial proposals found.</td></tr>';
        return;
    }

    // Filter by category if selected
    let filtered = [...commercialProposals];
    if (currentCommercialCategory) {
        filtered = filtered.filter(p => p.category === currentCommercialCategory);
    }

    // Sort by submitted date descending (newest first)
    filtered.sort((a, b) => {
        return new Date(b.submittedDate || 0) - new Date(a.submittedDate || 0);
    });

    if (filtered.length === 0) {
        commercialBody.innerHTML = '<tr><td colspan="5" class="no-results">No proposals in this category.</td></tr>';
        return;
    }

    commercialBody.innerHTML = filtered.map(p => {
        const submitted = p.submittedText || 'N/A';
        const detailsShort = (p.details || '').substring(0, 150) + (p.details && p.details.length > 150 ? '...' : '');
        const meetingsShort = (p.meetings || '').substring(0, 80) + (p.meetings && p.meetings.length > 80 ? '...' : '');

        const addressLink = p.detailUrl
            ? `<a href="${p.detailUrl}" target="_blank" rel="noopener">${p.address}</a>`
            : p.address;

        return `
            <tr>
                <td class="address-cell">${addressLink}</td>
                <td><span class="category-badge category-${p.category?.toLowerCase().replace('-', '')}">${p.category || 'Commercial'}</span></td>
                <td class="details-cell">${detailsShort}</td>
                <td>${submitted}</td>
                <td class="meetings-cell">${meetingsShort}</td>
            </tr>
        `;
    }).join('');
}

function createPropertyCard(property) {
    const formattedPrice = formatPrice(property.price);
    const address = formatAddress(property);
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
                <div class="property-address">${address}</div>
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
    // Export from whichever tab is active
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;

    if (activeTab === 'commercial') {
        exportCommercialCSV();
        return;
    }

    const dataToExport = activeTab === 'all' ? historicalProperties : allProperties;

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

    const filename = activeTab === 'all'
        ? `madison-all-properties-${new Date().toISOString().split('T')[0]}.csv`
        : `madison-properties-${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportCommercialCSV() {
    let dataToExport = [...commercialProposals];

    // Apply current filter
    if (currentCommercialCategory) {
        dataToExport = dataToExport.filter(p => p.category === currentCommercialCategory);
    }

    if (dataToExport.length === 0) {
        alert('No commercial proposals to export');
        return;
    }

    const headers = [
        'Address',
        'Category',
        'Project Details',
        'Submitted Date',
        'Meetings & Review',
        'Detail URL'
    ];

    const rows = dataToExport.map(p => [
        p.address || '',
        p.category || '',
        p.details || '',
        p.submittedText || '',
        p.meetings || '',
        p.detailUrl || ''
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
