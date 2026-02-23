#!/usr/bin/env python3
"""
Fetch Madison, WI property listings from RentCast API.

Usage:
    python fetch_properties.py

Environment variables:
    RENTCAST_API_KEY: Your RentCast API key (required)
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import requests

# Configuration
RENTCAST_API_KEY = os.environ.get('RENTCAST_API_KEY')
BASE_URL = 'https://api.rentcast.io/v1'

# Madison, WI area (center point for radius search)
CITY = 'Madison'
STATE = 'WI'
MADISON_LAT = 43.0731
MADISON_LNG = -89.4012
SEARCH_RADIUS_MILES = 15  # Includes Middleton, Sun Prairie, Fitchburg, Verona, etc.

# Output path (relative to repo root)
OUTPUT_PATH = Path(__file__).parent.parent / 'data' / 'properties.json'


def fetch_listings():
    """Fetch property listings for sale in Madison, WI."""
    if not RENTCAST_API_KEY:
        print('Error: RENTCAST_API_KEY environment variable not set')
        sys.exit(1)

    headers = {
        'Accept': 'application/json',
        'X-Api-Key': RENTCAST_API_KEY
    }

    # RentCast listings/sale endpoint
    # Docs: https://developers.rentcast.io/reference/sale-listings
    # Using radius search to include Madison suburbs
    params = {
        'latitude': MADISON_LAT,
        'longitude': MADISON_LNG,
        'radius': SEARCH_RADIUS_MILES,
        'status': 'Active',
        'daysOld': 7,       # Only listings from the last 7 days
        'priceMin': 200000, # Minimum $200k to filter out land/lots
        'limit': 50         # Adjust based on your API quota
    }

    print(f'Fetching listings within {SEARCH_RADIUS_MILES} miles of {CITY}, {STATE}...')

    try:
        response = requests.get(
            f'{BASE_URL}/listings/sale',
            headers=headers,
            params=params,
            timeout=30
        )
        response.raise_for_status()

        listings = response.json()
        print(f'Received {len(listings)} listings')

        return listings

    except requests.exceptions.HTTPError as e:
        print(f'HTTP Error: {e}')
        print(f'Response: {e.response.text}')
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f'Request failed: {e}')
        sys.exit(1)


def transform_listing(listing):
    """Transform RentCast listing to our frontend format."""
    agent = listing.get('listingAgent') or {}
    office = listing.get('listingOffice') or {}

    return {
        'id': listing.get('id'),
        'addressLine1': listing.get('addressLine1') or listing.get('formattedAddress'),
        'city': listing.get('city', CITY),
        'state': listing.get('state', STATE),
        'zipCode': listing.get('zipCode'),
        'price': listing.get('price'),
        'bedrooms': listing.get('bedrooms'),
        'bathrooms': listing.get('bathrooms'),
        'squareFootage': listing.get('squareFootage'),
        'propertyType': listing.get('propertyType'),
        'listedDate': listing.get('listedDate'),
        'daysOnMarket': listing.get('daysOnMarket'),
        'latitude': listing.get('latitude'),
        'longitude': listing.get('longitude'),
        'agent': {
            'name': agent.get('name'),
            'phone': agent.get('phone'),
            'email': agent.get('email'),
        },
        'office': {
            'name': office.get('name'),
            'phone': office.get('phone'),
        },
    }


def save_data(listings):
    """Save listings to JSON file for frontend consumption."""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    transformed = [transform_listing(l) for l in listings]

    data = {
        'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        'city': CITY,
        'state': STATE,
        'totalCount': len(transformed),
        'properties': transformed
    }

    with open(OUTPUT_PATH, 'w') as f:
        json.dump(data, f, indent=2)

    print(f'Saved {len(transformed)} properties to {OUTPUT_PATH}')


def main():
    listings = fetch_listings()
    save_data(listings)
    print('Done!')


if __name__ == '__main__':
    main()
