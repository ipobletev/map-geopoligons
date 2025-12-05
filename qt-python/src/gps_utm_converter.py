import utm

class GpsUtmConverter:
    """
    Class to convert GPS coordinates (latitude, longitude) to UTM.
    Utilizes the 'utm' library to automatically handle zone conversion.
    """
    
    @staticmethod
    def to_utm(lat, lon):
        """
        Convert latitude and longitude to UTM coordinates.
        
        Args:
            lat (float): Latitude
            lon (float): Longitude
            
        Returns:
            dict: Dictionary with 'easting', 'northing', 'zone_number', 'zone_letter'
        """
        try:
            easting, northing, zone_number, zone_letter = utm.from_latlon(lat, lon)
            return {
                'easting': easting,
                'northing': northing,
                'zone_number': zone_number,
                'zone_letter': zone_letter
            }
        except Exception as e:
            print(f"Error converting coordinates: {e}")
            return None