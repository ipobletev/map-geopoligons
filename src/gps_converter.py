import utm

class GPSConverter:
    """
    Clase para convertir coordenadas GPS (latitud, longitud) a UTM.
    Utiliza la librería 'utm' para realizar la conversión automática de zona.
    """
    
    @staticmethod
    def to_utm(lat, lon):
        """
        Convierte latitud y longitud a coordenadas UTM.
        
        Args:
            lat (float): Latitud
            lon (float): Longitud
            
        Returns:
            dict: Diccionario con 'easting', 'northing', 'zone_number', 'zone_letter'
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
            print(f"Error al convertir coordenadas: {e}")
            return None