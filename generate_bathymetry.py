#!/usr/bin/env python3
"""
Generate realistic bathymetry GeoJSON for Lanai, Hawaii.
Creates depth contours at 10m, 20m, 50m, 100m, and 200m depths.
"""

import json
import math
from typing import List, Tuple

# Lanai's center coordinates
CENTER_LAT = 20.83
CENTER_LON = -156.92

# Island dimensions (approximate)
ISLAND_LENGTH_KM = 29  # E-W
ISLAND_WIDTH_KM = 21   # N-S

# Convert km to degrees (approximate at this latitude)
# 1 degree latitude ≈ 111 km
# 1 degree longitude ≈ 111 * cos(latitude) km
LAT_KM_TO_DEG = 1 / 111.0
LON_KM_TO_DEG = 1 / (111.0 * math.cos(math.radians(CENTER_LAT)))

# Island half-dimensions in degrees
ISLAND_HALF_LENGTH_DEG = (ISLAND_LENGTH_KM / 2) * LON_KM_TO_DEG
ISLAND_HALF_WIDTH_DEG = (ISLAND_WIDTH_KM / 2) * LAT_KM_TO_DEG


def create_island_shape(num_points: int = 64) -> List[Tuple[float, float]]:
    """
    Create an elliptical approximation of Lanai's coastline.
    Returns list of (lon, lat) points.
    """
    points = []
    
    # Create an ellipse centered at Lanai's center
    for i in range(num_points):
        angle = (2 * math.pi * i) / num_points
        
        # Base elliptical shape
        x = ISLAND_HALF_LENGTH_DEG * math.cos(angle)
        y = ISLAND_HALF_WIDTH_DEG * math.sin(angle)
        
        # Add some irregularities based on actual Lanai geography
        # South coast steeper (near Hulopo'e/Manele)
        if -math.pi/4 < angle < math.pi/4:  # South side
            y -= 0.003 * math.sin(angle)  # Indent slightly
        
        # West coast (Kaumalapau) - bulge out
        if math.pi/4 < angle < 3*math.pi/4:  # West side
            x -= 0.002 * math.sin(angle - math.pi/2)
        
        # North coast exposure
        if 3*math.pi/4 < angle < 5*math.pi/4:  # North side
            y += 0.002 * math.sin(angle - math.pi)
        
        lon = CENTER_LON + x
        lat = CENTER_LAT + y
        points.append((lon, lat))
    
    # Close the shape
    points.append(points[0])
    
    return points


def create_depth_contour(depth_m: int, num_points: int = 36) -> List[Tuple[float, float]]:
    """
    Create a depth contour around Lanai.
    Distance offshore is based on the depth and regional bathymetry patterns.
    
    Returns list of (lon, lat) points.
    """
    points = []
    
    # Determine offshore distance based on depth and coastline characteristics
    # Shallow depths close to shore, deeper ones further out
    # This is highly variable around Lanai
    
    if depth_m == 10:
        # 10m contour: very close to shore, varies by coast
        base_offset_deg = 0.008  # ~900m average
    elif depth_m == 20:
        # 20m contour: still close shore
        base_offset_deg = 0.015  # ~1.7km average
    elif depth_m == 50:
        # 50m contour: moderate distance
        base_offset_deg = 0.035  # ~3.9km average
    elif depth_m == 100:
        # 100m contour: further offshore
        base_offset_deg = 0.065  # ~7.2km average
    elif depth_m == 200:
        # 200m contour: significant distance
        base_offset_deg = 0.12  # ~13.3km average
    else:
        base_offset_deg = 0.02
    
    # Create contour points around island
    for i in range(num_points):
        angle = (2 * math.pi * i) / num_points
        
        # Calculate offset based on coast characteristics
        # South coast (Hulopo'e/Manele): steeper, less offset
        if -math.pi/6 < angle < math.pi/6:  # South
            offset_mult = 0.6 if depth_m <= 20 else 0.7
            lon_offset = ISLAND_HALF_LENGTH_DEG * math.cos(angle) * (1 + base_offset_deg / (ISLAND_HALF_LENGTH_DEG * 2))
            lat_offset = ISLAND_HALF_WIDTH_DEG * math.sin(angle) * (1 + base_offset_deg / (ISLAND_HALF_WIDTH_DEG * 2)) * offset_mult
        
        # Southwest (Kaunolu): rocky, steep drop-offs
        elif -math.pi/3 < angle < 0:  # SW
            offset_mult = 0.65 if depth_m <= 20 else 0.75
            lon_offset = ISLAND_HALF_LENGTH_DEG * math.cos(angle) * (1 + base_offset_deg / (ISLAND_HALF_LENGTH_DEG * 2))
            lat_offset = ISLAND_HALF_WIDTH_DEG * math.sin(angle) * (1 + base_offset_deg / (ISLAND_HALF_WIDTH_DEG * 2)) * offset_mult
        
        # West coast (Kaumalapau): moderate shelf, gradual slope
        elif math.pi/3 < angle < 2*math.pi/3:  # West
            offset_mult = 0.85
            lon_offset = ISLAND_HALF_LENGTH_DEG * math.cos(angle) * (1 + base_offset_deg / (ISLAND_HALF_LENGTH_DEG * 2))
            lat_offset = ISLAND_HALF_WIDTH_DEG * math.sin(angle) * (1 + base_offset_deg / (ISLAND_HALF_WIDTH_DEG * 2)) * offset_mult
        
        # North coast: exposed, steeper near Shipwreck Beach
        elif 2*math.pi/3 < angle < 4*math.pi/3:  # North
            offset_mult = 0.7
            lon_offset = ISLAND_HALF_LENGTH_DEG * math.cos(angle) * (1 + base_offset_deg / (ISLAND_HALF_LENGTH_DEG * 2))
            lat_offset = ISLAND_HALF_WIDTH_DEG * math.sin(angle) * (1 + base_offset_deg / (ISLAND_HALF_WIDTH_DEG * 2)) * offset_mult
        
        # East coast: trade wind exposed, moderate shelf
        else:  # East (4*pi/3 to -pi/3)
            offset_mult = 0.8
            lon_offset = ISLAND_HALF_LENGTH_DEG * math.cos(angle) * (1 + base_offset_deg / (ISLAND_HALF_LENGTH_DEG * 2))
            lat_offset = ISLAND_HALF_WIDTH_DEG * math.sin(angle) * (1 + base_offset_deg / (ISLAND_HALF_WIDTH_DEG * 2)) * offset_mult
        
        lon = CENTER_LON + lon_offset
        lat = CENTER_LAT + lat_offset
        
        points.append((lon, lat))
    
    # Close the contour
    points.append(points[0])
    
    return points


def create_bathymetry_geojson() -> dict:
    """Create the complete bathymetry GeoJSON FeatureCollection."""
    
    features = []
    
    # Add depth contours
    depths = [10, 20, 50, 100, 200]
    
    for depth in depths:
        coords = create_depth_contour(depth)
        
        feature = {
            "type": "Feature",
            "properties": {
                "depth": depth,
                "type": "contour",
                "unit": "meters"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            }
        }
        features.append(feature)
    
    # Create the FeatureCollection
    geojson = {
        "type": "FeatureCollection",
        "name": "Lanai Bathymetry Contours",
        "description": "Depth contours around Lanai, Hawaii",
        "features": features
    }
    
    return geojson


def main():
    """Generate and save the bathymetry GeoJSON."""
    
    print("Generating Lanai bathymetry contours...")
    geojson = create_bathymetry_geojson()
    
    output_path = "/sessions/ecstatic-magical-planck/mnt/lanai-dive/public/data/lanai-bathymetry.geojson"
    
    with open(output_path, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"Successfully saved to {output_path}")
    print(f"Created {len(geojson['features'])} depth contour features")
    
    # Print summary
    for feature in geojson['features']:
        depth = feature['properties']['depth']
        coords = feature['geometry']['coordinates']
        print(f"  - {depth}m contour: {len(coords)} points")


if __name__ == "__main__":
    main()
