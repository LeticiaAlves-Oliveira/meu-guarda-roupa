import sys
import os

# Adiciona o diretório backend ao path
sys.path.insert(0, os.path.dirname(__file__))

from main import app
