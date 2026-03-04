#!/usr/bin/env python3
"""
Fetch Madison, WI construction permits from City Reports.

Uses Selenium to interact with the SSRS report and export data.

Usage:
    python fetch_permits.py

Data source: City of Madison Building Inspection
https://cityreports.cityofmadison.com/CityReports/ReportViewer/ReportViewer/?ReportPath=/Web%20Access/Building/Permits/Construction%20Summary
"""

import json
import os
import re
import time
from datetime import datetime, timedelta
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Report URL
REPORT_URL = 'https://cityreports.cityofmadison.com/CityReports/ReportViewer/ReportViewer/?ReportPath=/Web%20Access/Building/Permits/Construction%20Summary'

# Keywords to identify commercial/office/hospitality permits
COMMERCIAL_KEYWORDS = [
    'office', 'commercial', 'hotel', 'motel', 'hospitality',
    'retail', 'restaurant', 'medical', 'clinic', 'hospital',
    'warehouse', 'industrial', 'business', 'corporate',
    'mixed-use', 'mixed use', 'tenant', 'buildout', 'build-out',
    'storefront', 'shopping', 'plaza', 'center',
    'bank', 'financial', 'professional', 'renovation',
    'alteration', 'remodel', 'interior', 'fit-out',
]

# Output paths
OUTPUT_PATH = Path(__file__).parent.parent / 'data' / 'commercial.json'
HISTORICAL_PATH = Path(__file__).parent.parent / 'data' / 'all_commercial.json'


def setup_driver():
    """Set up headless Chrome driver."""
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver


def fetch_permits():
    """Fetch construction permits from the SSRS report."""
    print('Setting up browser...')
    driver = setup_driver()

    try:
        print(f'Loading report page...')
        driver.get(REPORT_URL)

        # Wait for the page to load and parameters to be available
        wait = WebDriverWait(driver, 30)

        # Wait for the Start Date input to be enabled
        print('Waiting for report parameters to load...')
        start_date_input = wait.until(
            EC.element_to_be_clickable((By.ID, 'ctl00_MainContent_rvSiteMapping_ctl08_ctl03_txtValue'))
        )

        # Calculate date range (last 30 days)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)

        # Fill in date parameters
        print(f'Setting date range: {start_date.strftime("%m/%d/%Y")} to {end_date.strftime("%m/%d/%Y")}')

        start_date_input.clear()
        start_date_input.send_keys(start_date.strftime('%m/%d/%Y'))

        end_date_input = driver.find_element(By.ID, 'ctl00_MainContent_rvSiteMapping_ctl08_ctl05_txtValue')
        end_date_input.clear()
        end_date_input.send_keys(end_date.strftime('%m/%d/%Y'))

        # Select permit type (if needed - leaving as default for all types)
        # permit_type_select = Select(driver.find_element(By.ID, 'ctl00_MainContent_rvSiteMapping_ctl08_ctl07_ddValue'))
        # permit_type_select.select_by_visible_text('All')

        # Click View Report button
        print('Submitting report request...')
        view_report_btn = driver.find_element(By.ID, 'ctl00_MainContent_rvSiteMapping_ctl08_ctl00')
        view_report_btn.click()

        # Wait for report to load
        print('Waiting for report to generate...')
        time.sleep(10)  # Initial wait for report generation

        # Wait for report content to appear
        wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'table'))
        )

        # Give additional time for full render
        time.sleep(5)

        # Get the page source and parse the report
        print('Extracting permit data...')
        page_source = driver.page_source

        # Parse the report data from HTML
        permits = parse_report_html(page_source)

        print(f'Found {len(permits)} permits')
        return permits

    except Exception as e:
        print(f'Error fetching permits: {e}')
        # Save screenshot for debugging
        try:
            driver.save_screenshot('/tmp/permit_error.png')
            print('Screenshot saved to /tmp/permit_error.png')
        except:
            pass
        return []

    finally:
        driver.quit()


def parse_report_html(html):
    """Parse permit data from the SSRS report HTML."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, 'html.parser')
    permits = []

    # Find all table rows in the report
    # SSRS reports typically render data in nested tables
    tables = soup.find_all('table')

    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            cells = row.find_all(['td', 'div'])
            if len(cells) >= 3:
                # Try to extract permit data
                text_content = ' '.join(cell.get_text(strip=True) for cell in cells)

                # Look for permit number pattern (e.g., BP-2026-xxxxx)
                permit_match = re.search(r'(BP-\d{4}-\d+)', text_content)
                if permit_match:
                    permit_number = permit_match.group(1)

                    # Extract address (usually follows permit number)
                    address_match = re.search(r'\d+\s+[A-Z][A-Za-z\s]+(?:ST|AVE|RD|DR|LN|CT|WAY|BLVD|PL)', text_content)
                    address = address_match.group(0) if address_match else ''

                    # Extract description
                    description = text_content

                    # Extract cost if present
                    cost_match = re.search(r'\$[\d,]+(?:\.\d{2})?', text_content)
                    cost = cost_match.group(0) if cost_match else None

                    permits.append({
                        'id': permit_number,
                        'permitNumber': permit_number,
                        'address': address,
                        'description': description,
                        'estimatedCost': cost,
                        'rawText': text_content[:500]
                    })

    # Deduplicate by permit number
    seen = set()
    unique_permits = []
    for p in permits:
        if p['id'] not in seen:
            seen.add(p['id'])
            unique_permits.append(p)

    return unique_permits


def is_commercial_permit(permit):
    """Check if a permit is commercial/office/hospitality related."""
    text = (permit.get('description', '') + ' ' + permit.get('address', '')).lower()

    for keyword in COMMERCIAL_KEYWORDS:
        if keyword in text:
            return True

    # Check for high-value permits (likely commercial)
    cost_str = permit.get('estimatedCost', '')
    if cost_str:
        # Parse cost
        cost = int(re.sub(r'[^\d]', '', cost_str) or 0)
        if cost >= 500000:  # $500k+ likely commercial
            return True

    return False


def categorize_permit(permit):
    """Categorize a permit by type."""
    text = (permit.get('description', '') + ' ' + permit.get('address', '')).lower()

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
    elif any(kw in text for kw in ['tenant', 'buildout', 'build-out', 'fit-out', 'interior']):
        return 'Tenant Buildout'
    elif any(kw in text for kw in ['renovation', 'remodel', 'alteration']):
        return 'Renovation'
    else:
        return 'Commercial'


def save_data(permits):
    """Save permits to JSON file."""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Filter for commercial permits
    commercial = [p for p in permits if is_commercial_permit(p)]

    # Add category to each permit
    for p in commercial:
        p['category'] = categorize_permit(p)

    print(f'Filtered to {len(commercial)} commercial permits')

    timestamp = datetime.utcnow().isoformat() + 'Z'

    data = {
        'lastUpdated': timestamp,
        'source': 'City of Madison Building Inspection',
        'sourceUrl': REPORT_URL,
        'totalCount': len(commercial),
        'permits': commercial
    }

    with open(OUTPUT_PATH, 'w') as f:
        json.dump(data, f, indent=2)

    print(f'Saved {len(commercial)} permits to {OUTPUT_PATH}')

    return commercial, timestamp


def update_historical(new_permits, timestamp):
    """Append new permits to historical list."""
    if HISTORICAL_PATH.exists():
        with open(HISTORICAL_PATH) as f:
            historical = json.load(f)
    else:
        historical = {'lastUpdated': timestamp, 'totalCount': 0, 'permits': []}

    existing_ids = {p['id'] for p in historical.get('permits', [])}

    new_count = 0
    for permit in new_permits:
        if permit['id'] not in existing_ids:
            permit['dateAdded'] = timestamp
            historical.setdefault('permits', []).append(permit)
            existing_ids.add(permit['id'])
            new_count += 1

    historical['lastUpdated'] = timestamp
    historical['totalCount'] = len(historical.get('permits', []))

    with open(HISTORICAL_PATH, 'w') as f:
        json.dump(historical, f, indent=2)

    print(f'Added {new_count} new permits to historical list (total: {historical["totalCount"]})')


def main():
    permits = fetch_permits()

    if not permits:
        print('No permits fetched')
        return

    commercial, timestamp = save_data(permits)
    update_historical(commercial, timestamp)

    # Print summary
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
