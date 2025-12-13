import os

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATED_DIR = os.path.join(BACKEND_DIR, "generated")
os.makedirs(GENERATED_DIR, exist_ok=True)