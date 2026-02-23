// Madison Properties - Frontend Logic

const DATA_URL = 'data/properties.json';

let allProperties = [];

// DOM Elements
const propertiesContainer = document.getElementById('properties');
const priceFilter = document.getElementById('price-filter');
const bedsFilter = document.getElementById('beds-filter');
const sortFilter = document.getElementById('sort-filter');
const totalListingsEl = document.getElementById('total-listings');
const avgPriceEl = document.getElementById('avg-price');
const lastUpdatedEl = document.getElementById('last-updated');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) {
            throw new Error('Failed to load property data');
        }

        const data = await response.json();
        allProperties = data.properties || [];

        // Update last updated timestamp
        if (data.lastUpdated) {
            const date = new Date(data.lastUpdated);
            lastUpdatedEl.textContent = date.toLocaleDateString();
        }

        // Setup event listeners
        priceFilter.addEventListener('change', renderProperties);
        bedsFilter.addEventListener('change', renderProperties);
        sortFilter.addEventListener('change', renderProperties);

        renderProperties();
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
