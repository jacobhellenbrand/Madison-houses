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

        # Select permit type - required field
        print('Selecting permit type...')
        permit_type_select = wait.until(
            EC.element_to_be_clickable((By.ID, 'ctl00_MainContent_rvSiteMapping_ctl08_ctl07_ddValue'))
        )
        select = Select(permit_type_select)
        # Print available options for debugging
        options = [o.text for o in select.options]
        print(f'Available permit types: {options}')
        # Select first non-empty option (or 'All' if available)
        for opt in select.options:
            if opt.text.strip() and opt.text.strip() not in ['<Select a Value>', 'Select a Value']:
                select.select_by_visible_text(opt.text)
                print(f'Selected permit type: {opt.text}')
                break

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

        # Get total page count
        total_pages_el = driver.find_element(By.ID, 'ctl00_MainContent_rvSiteMapping_ctl09_ctl00_TotalPages')
        total_pages_text = total_pages_el.text.strip().replace('?', '').strip()
        try:
            total_pages = int(total_pages_text)
        except ValueError:
            total_pages = 1
        print(f'Report has {total_pages} page(s)')

        # Parse all pages
        all_permits = []
        for page_num in range(1, total_pages + 1):
            print(f'Extracting page {page_num}/{total_pages}...')
            page_source = driver.page_source
            page_permits = parse_report_html(page_source)
            all_permits.extend(page_permits)
            print(f'  Found {len(page_permits)} permits on page {page_num}')

            if page_num < total_pages:
                # Click next page button
                next_btn = driver.find_element(By.CSS_SELECTOR, '#ctl00_MainContent_rvSiteMapping_ctl09_ctl00_Next_ctl00_ctl00')
                next_btn.find_element(By.XPATH, '..').click()
                time.sleep(4)
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table')))
                time.sleep(2)

        print(f'Found {len(all_permits)} permits total')
        return all_permits

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
    permit_pattern = re.compile(r'^BLD\w+-\d{4}-\d+$')

    # Each permit is a <tr valign="top"> with 13 <td> cells:
    # Permit#, Use, Location, Sqft, EstCost, FeesPaid, Dwell,
    # Owner, OwnerAddr, Description, IssuanceDate, Contractor, ContractorAddr
    for row in soup.find_all('tr', valign='top'):
        cells = row.find_all('td')
        if len(cells) < 11:
            continue

        texts = [c.get_text(strip=True) for c in cells]
        permit_number = texts[0]

        if not permit_pattern.match(permit_number):
            continue

        permits.append({
            'id': permit_number,
            'permitNumber': permit_number,
            'use': texts[1] if len(texts) > 1 else '',
            'address': texts[2] if len(texts) > 2 else '',
            'buildingSqft': texts[3] if len(texts) > 3 else '',
            'estimatedCost': texts[4] if len(texts) > 4 else '',
            'feesPaid': texts[5] if len(texts) > 5 else '',
            'owner': texts[7] if len(texts) > 7 else '',
            'ownerAddress': texts[8] if len(texts) > 8 else '',
            'description': texts[9] if len(texts) > 9 else '',
            'issuanceDate': texts[10] if len(texts) > 10 else '',
            'contractor': texts[11] if len(texts) > 11 else '',
            'contractorAddress': texts[12] if len(texts) > 12 else '',
        })

    return permits


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
        'proposals': commercial
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
        historical = {'lastUpdated': timestamp, 'totalCount': 0, 'proposals': []}

    existing_ids = {p['id'] for p in historical.get('proposals', [])}

    new_count = 0
    for permit in new_permits:
        if permit['id'] not in existing_ids:
            permit['dateAdded'] = timestamp
            historical.setdefault('proposals', []).append(permit)
            existing_ids.add(permit['id'])
            new_count += 1

    historical['lastUpdated'] = timestamp
    historical['totalCount'] = len(historical.get('proposals', []))

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
