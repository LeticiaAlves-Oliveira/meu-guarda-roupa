# Meu Guarda-Roupa - Database Setup
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "guarda_roupa.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS registros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            periodo TEXT NOT NULL CHECK(periodo IN ('manha', 'tarde', 'noite')),
            ocasiao TEXT NOT NULL CHECK(ocasiao IN ('trabalho', 'beach_tennis', 'correr', 'lazer', 'noite')),
            descricao TEXT NOT NULL,
            foto_url TEXT,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_registros_data ON registros(data);
        CREATE INDEX IF NOT EXISTS idx_registros_ocasiao ON registros(ocasiao);
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Banco de dados inicializado!")
