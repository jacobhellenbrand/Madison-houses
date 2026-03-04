#!/usr/bin/env python3
"""
Look up property owners from Wisconsin Statewide Parcel Map data.

Uses the ArcGIS REST API to query parcels by location and retrieve owner names.

Usage:
    python lookup_owners.py

Data source: Wisconsin Statewide Parcel Map Initiative
https://www.sco.wisc.edu/parcels/data/
"""

import json
import time
from pathlib import Path

import requests

# ArcGIS REST API endpoint for Wisconsin Parcels
PARCEL_API_URL = 'https://services3.arcgis.com/n6uYoouQZW75n5WI/arcgis/rest/services/Wisconsin_Statewide_Parcels/FeatureServer/0/query'

# Properties data
PROPERTIES_PATH = Path(__file__).parent.parent / 'data' / 'properties.json'


def lookup_owner_by_point(lat, lng):
    """
    Query the ArcGIS API to find the parcel at a given lat/lng.

    Returns dict with owner1, owner2 (or None if not found).
    """
    if lat is None or lng is None:
        return {'owner1': None, 'owner2': None}

    # Query parameters for point intersection
    params = {
        'f': 'json',
        'geometry': f'{lng},{lat}',  # x,y format (lng, lat)
        'geometryType': 'esriGeometryPoint',
        'spatialRel': 'esriSpatialRelIntersects',
        'outFields': 'OWNERNME1,OWNERNME2,SITEADRESS',
        'returnGeometry': 'false',
        'inSR': '4326',  # WGS84
    }

    try:
        response = requests.get(PARCEL_API_URL, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        features = data.get('features', [])
        if not features:
            return {'owner1': None, 'owner2': None}

        # Get first matching parcel
        attrs = features[0].get('attributes', {})

        owner1 = attrs.get('OWNERNME1')
        owner2 = attrs.get('OWNERNME2')

        # Clean up "NOT AVAILABLE" and empty values
        if owner1 and owner1.upper() in ('NOT AVAILABLE', 'N/A', 'NA', ''):
            owner1 = None
        if owner2 and owner2.upper() in ('NOT AVAILABLE', 'N/A', 'NA', ''):
            owner2 = None

        return {'owner1': owner1, 'owner2': owner2}

    except requests.exceptions.RequestException as e:
        print(f'    API error for ({lat}, {lng}): {e}')
        return {'owner1': None, 'owner2': None}


def update_properties_with_owners():
    """Main function to update properties.json with owner information."""
    # Load properties
    if not PROPERTIES_PATH.exists():
        print(f'Properties file not found at {PROPERTIES_PATH}')
        return

    with open(PROPERTIES_PATH) as f:
        data = json.load(f)

    properties = data.get('properties', [])
    print(f'Looking up owners for {len(properties)} properties via ArcGIS API...')

    # Look up owner for each property
    found_count = 0
    for i, prop in enumerate(properties):
        lat = prop.get('latitude')
        lng = prop.get('longitude')

        # Skip if already has owner data
        if prop.get('owner', {}).get('owner1'):
            found_count += 1
            continue

        owner_info = lookup_owner_by_point(lat, lng)
        prop['owner'] = owner_info

        if owner_info['owner1']:
            found_count += 1
            print(f'  [{i+1}/{len(properties)}] {prop.get("addressLine1")}: {owner_info["owner1"]}')
        else:
            print(f'  [{i+1}/{len(properties)}] {prop.get("addressLine1")}: (not found)')

        # Rate limiting - be nice to the API
        time.sleep(0.2)

    print(f'\nFound owners for {found_count}/{len(properties)} properties')

    # Save updated properties
    with open(PROPERTIES_PATH, 'w') as f:
        json.dump(data, f, indent=2)

    print(f'Updated {PROPERTIES_PATH}')


if __name__ == '__main__':
    update_properties_with_owners()
