import sys
from PyQt5.QtWidgets import QApplication
from folium_qt_app import MapWindow

if __name__ == "__main__":

    LOCATION = [-33.4489, -70.6693]
    SAVE_FOLDER = "draws" 
    RESIZE = (1000, 800)

    app = QApplication(sys.argv)
    window = MapWindow(LOCATION, SAVE_FOLDER, RESIZE)
    window.show()
    sys.exit(app.exec_())