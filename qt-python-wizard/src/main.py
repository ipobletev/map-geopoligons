import sys
from PyQt5.QtWidgets import QApplication
from wizard_window import WizardWindow

def main():
    app = QApplication(sys.argv)
    window = WizardWindow()
    window.show()
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()
