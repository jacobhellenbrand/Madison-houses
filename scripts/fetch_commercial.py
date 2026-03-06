#!/usr/bin/env python3
"""
Fetch Madison, WI commercial development proposals from City of Madison.

Scrapes the Current Development Proposals page and filters for
commercial, office, and hospitality projects.

Usage:
    python fetch_commercial.py

Data source: City of Madison Planning Division
https://www.cityofmadison.com/dpced/planning/current-development-proposals-/1599/
"""

import json
import re
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# Source URL
PROPOSALS_URL = 'https://www.cityofmadison.com/dpced/planning/current-development-proposals-/1599/'

# Keywords to identify commercial/office/hospitality projects
COMMERCIAL_KEYWORDS = [
    'office', 'commercial', 'hotel', 'motel', 'hospitality',
    'retail', 'restaurant', 'medical', 'clinic', 'hospital',
    'warehouse', 'industrial', 'business', 'corporate',
    'mixed-use', 'mixed use', 'tenant', 'buildout', 'build-out',
    'storefront', 'shopping', 'plaza', 'center',
    'bank', 'financial', 'professional',
]

# Keywords that indicate residential-only (to exclude)
RESIDENTIAL_ONLY_KEYWORDS = [
    'single-family', 'single family', 'duplex', 'triplex',
    'townhouse', 'townhome', 'subdivision lot',
]

# Only include proposals submitted on or after this date
CUTOFF_DATE = datetime(2025, 11, 1)

# Output path
OUTPUT_PATH = Path(__file__).parent.parent / 'data' / 'developments.json'


def fetch_proposals():
    """Fetch and parse development proposals from City of Madison."""
    print(f'Fetching development proposals from {PROPOSALS_URL}...')

    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; MadisonHouses/1.0; +https://github.com/jacobhellenbrand/Madison-houses)'
    }

    try:
        response = requests.get(PROPOSALS_URL, headers=headers, timeout=30)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f'Error fetching proposals: {e}')
        return []

    soup = BeautifulSoup(response.text, 'html.parser')

    # Find the main proposals table
    table = soup.find('table')
    if not table:
        print('Error: Could not find proposals table')
        return []

    rows = table.find_all('tr')
    print(f'Found {len(rows) - 1} proposals')

    proposals = []
    for row in rows[1:]:  # Skip header row
        # Address is in a th element, rest are td elements
        project_cell = row.find('th')
        cells = row.find_all('td')

        if not project_cell or len(cells) < 3:
            continue

        submitted_cell = cells[0]
        details_cell = cells[1]
        meetings_cell = cells[2]

        # Get address (may be a link)
        address_link = project_cell.find('a')
        address = address_link.get_text(strip=True) if address_link else project_cell.get_text(strip=True)
        detail_url = address_link.get('href', '') if address_link else ''

        # Parse submitted date
        submitted_text = submitted_cell.get_text(strip=True)
        try:
            submitted_date = datetime.strptime(submitted_text, '%m/%d/%Y').isoformat() + 'Z'
        except ValueError:
            submitted_date = None

        # Get project details
        details = details_cell.get_text(strip=True)

        # Get meetings info
        meetings = meetings_cell.get_text(strip=True)

        # Extract any Legistar links (legislative file numbers)
        legistar_links = []
        for link in meetings_cell.find_all('a'):
            href = link.get('href', '')
            if 'legistar' in href.lower():
                legistar_links.append({
                    'text': link.get_text(strip=True),
                    'url': href
                })

        proposal = {
            'id': re.sub(r'[^a-zA-Z0-9]', '-', address),
            'address': address,
            'submittedDate': submitted_date,
            'submittedText': submitted_text,
            'details': details,
            'meetings': meetings,
            'legistarLinks': legistar_links,
            'detailUrl': f"https://www.cityofmadison.com{detail_url}" if detail_url.startswith('/') else detail_url,
        }

        proposals.append(proposal)

    return proposals


def is_commercial_project(proposal):
    """Check if a proposal is a commercial/office/hospitality project."""
    text = (proposal.get('details', '') + ' ' + proposal.get('address', '')).lower()

    # Check for residential-only keywords (exclude these)
    for keyword in RESIDENTIAL_ONLY_KEYWORDS:
        if keyword in text:
            # But allow if it also has commercial keywords
            has_commercial = any(kw in text for kw in COMMERCIAL_KEYWORDS)
            if not has_commercial:
                return False

    # Check for commercial keywords
    for keyword in COMMERCIAL_KEYWORDS:
        if keyword in text:
            return True

    # Check for large multi-family (often has commercial component)
    # Look for patterns like "200 units" or "150-unit"
    unit_match = re.search(r'(\d+)[- ]?unit', text)
    if unit_match:
        units = int(unit_match.group(1))
        if units >= 50:  # Large developments often have commercial space
            return True

    # Check for square footage mentions (commercial indicator)
    sqft_match = re.search(r'(\d{1,3}(?:,\d{3})*)\s*(?:sq\.?\s*ft|square\s*feet)', text)
    if sqft_match:
        sqft_str = sqft_match.group(1).replace(',', '')
        sqft = int(sqft_str)
        if sqft >= 10000:  # 10k+ sqft likely commercial
            return True

    return False


def categorize_project(proposal):
    """Categorize a project by type."""
    text = (proposal.get('details', '') + ' ' + proposal.get('address', '')).lower()

    if any(kw in text for kw in ['hotel', 'motel', 'hospitality', 'lodging']):
        return 'Hospitality'
    elif any(kw in text for kw in ['office', 'corporate', 'professional']):
        return 'Office'
    elif any(kw in text for kw in ['medical', 'clinic', 'hospital', 'healthcare']):
        return 'Medical'
    elif any(kw in text for kw in ['retail', 'shopping', 'storefront', 'restaurant']):
        return 'Retail'
    elif any(kw in text for kw in ['warehouse', 'industrial', 'manufacturing']):
        return 'Industrial'
    elif any(kw in text for kw in ['mixed-use', 'mixed use']):
        return 'Mixed-Use'
    else:
        return 'Commercial'


def save_data(proposals):
    """Save proposals to JSON file."""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Filter for commercial projects submitted since cutoff date
    commercial = []
    for p in proposals:
        if not is_commercial_project(p):
            continue
        submitted = p.get('submittedDate')
        if submitted:
            try:
                if datetime.fromisoformat(submitted.replace('Z', '')) < CUTOFF_DATE:
                    continue
            except ValueError:
                pass
        p['category'] = categorize_project(p)
        commercial.append(p)

    print(f'Filtered to {len(commercial)} proposals from Nov 2025+')

    data = {
        'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        'source': 'City of Madison Planning Division',
        'sourceUrl': PROPOSALS_URL,
        'totalCount': len(commercial),
        'proposals': commercial
    }

    with open(OUTPUT_PATH, 'w') as f:
        json.dump(data, f, indent=2)

    print(f'Saved {len(commercial)} proposals to {OUTPUT_PATH}')

    return commercial


def main():
    proposals = fetch_proposals()

    if not proposals:
        print('No proposals fetched')
        return

    commercial = save_data(proposals)

    # Print summary by category
    categories = {}
    for p in commercial:
        cat = p.get('category', 'Other')
        categories[cat] = categories.get(cat, 0) + 1

    print('\nBy category:')
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f'  {cat}: {count}')

    print('\nDone!')


if __name__ == '__main__':
    main()
