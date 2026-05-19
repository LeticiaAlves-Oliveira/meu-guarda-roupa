from fastapi import FastAPI, HTTPException, Query, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
import sqlite3, os
from database import get_connection, init_db

app = FastAPI(title="Meu Guarda-Roupa API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Serve frontend build (SPA-friendly) ─────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "frontend", "dist"))
INDEX_PATH = os.path.join(FRONTEND_DIR, "index.html")

# ─── Database init ────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    init_db()

# ─── Models ─────────────────────────────────────────────────────

class RegistroInput(BaseModel):
    data: str
    periodo: str = Field(pattern=r"^(manha|tarde|noite)$")
    ocasiao: str = Field(pattern=r"^(trabalho|beach_tennis|correr|lazer|noite)$")
    descricao: str = Field(min_length=1, max_length=500)
    foto_url: Optional[str] = None

class RegistroOutput(RegistroInput):
    id: int
    criado_em: str

class RegistroUpdate(BaseModel):
    periodo: Optional[str] = Field(default=None, pattern=r"^(manha|tarde|noite)$")
    ocasiao: Optional[str] = Field(default=None, pattern=r"^(trabalho|beach_tennis|correr|lazer|noite)$")
    descricao: Optional[str] = Field(default=None, min_length=1, max_length=500)
    foto_url: Optional[str] = None

# ─── API Router (registrado primeiro pra ter prioridade) ─────────

api = APIRouter()

def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)

@api.get("/")
def root():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(index_path):
        from fastapi.responses import FileResponse
        return FileResponse(index_path, media_type="text/html")
    return {"message": "Meu Guarda-Roupa API rodando!"}

@api.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@api.get("/registros", response_model=List[RegistroOutput])
def listar_registros(
    data: Optional[str] = Query(None),
    mes: Optional[str] = Query(None),
    ocasiao: Optional[str] = Query(None),
    periodo: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=365),
    offset: int = Query(0, ge=0),
):
    conn = get_connection()
    conditions = []
    params = []
    if data:
        conditions.append("data = ?")
        params.append(data)
    if mes:
        conditions.append("data LIKE ?")
        params.append(f"{mes}%")
    if ocasiao:
        conditions.append("ocasiao = ?")
        params.append(ocasiao)
    if periodo:
        conditions.append("periodo = ?")
        params.append(periodo)
    if q:
        conditions.append("descricao LIKE ?")
        params.append(f"%{q}%")
    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    query = f"SELECT * FROM registros {where} ORDER BY data DESC, id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]

@api.post("/registros", status_code=201)
def criar_registro(registro: RegistroInput):
    try:
        datetime.strptime(registro.data, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Data deve estar no formato YYYY-MM-DD")
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO registros (data, periodo, ocasiao, descricao, foto_url) VALUES (?, ?, ?, ?, ?)",
        (registro.data, registro.periodo, registro.ocasiao, registro.descricao, registro.foto_url),
    )
    conn.commit()
    novo_id = cursor.lastrowid
    row = conn.execute("SELECT * FROM registros WHERE id = ?", (novo_id,)).fetchone()
    conn.close()
    return row_to_dict(row)

@api.get("/registros/{registro_id}", response_model=RegistroOutput)
def buscar_registro(registro_id: int):
    conn = get_connection()
    row = conn.execute("SELECT * FROM registros WHERE id = ?", (registro_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Registro não encontrado")
    return row_to_dict(row)

@api.patch("/registros/{registro_id}")
def atualizar_registro(registro_id: int, dados: RegistroUpdate):
    conn = get_connection()
    row = conn.execute("SELECT * FROM registros WHERE id = ?", (registro_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Registro não encontrado")
    updates = {}
    if dados.periodo is not None:
        updates["periodo"] = dados.periodo
    if dados.ocasiao is not None:
        updates["ocasiao"] = dados.ocasiao
    if dados.descricao is not None:
        updates["descricao"] = dados.descricao
    if dados.foto_url is not None:
        updates["foto_url"] = dados.foto_url
    if not updates:
        conn.close()
        return row_to_dict(row)
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [registro_id]
    conn.execute(f"UPDATE registros SET {set_clause} WHERE id = ?", values)
    conn.commit()
    updated = conn.execute("SELECT * FROM registros WHERE id = ?", (registro_id,)).fetchone()
    conn.close()
    return row_to_dict(updated)

@api.delete("/registros/{registro_id}", status_code=204)
def deletar_registro(registro_id: int):
    conn = get_connection()
    row = conn.execute("SELECT * FROM registros WHERE id = ?", (registro_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Registro não encontrado")
    conn.execute("DELETE FROM registros WHERE id = ?", (registro_id,))
    conn.commit()
    conn.close()
    return

@api.get("/estatisticas")
def estatisticas():
    conn = get_connection()
    descricoes = conn.execute("SELECT descricao FROM registros").fetchall()
    por_ocasiao = dict(conn.execute(
        "SELECT ocasiao, COUNT(*) FROM registros GROUP BY ocasiao ORDER BY COUNT(*) DESC"
    ).fetchall())
    por_periodo = dict(conn.execute(
        "SELECT periodo, COUNT(*) FROM registros GROUP BY periodo ORDER BY COUNT(*) DESC"
    ).fetchall())
    total = conn.execute("SELECT COUNT(*) FROM registros").fetchone()[0]
    ultimos7 = conn.execute(
        "SELECT data, COUNT(*) FROM registros WHERE data >= date('now', '-7 days') GROUP BY data ORDER BY data"
    ).fetchall()
    conn.close()
    return {
        "total_registros": total,
        "por_ocasiao": por_ocasiao,
        "por_periodo": por_periodo,
        "ultimos_7_dias": [{"data": r[0], "count": r[1]} for r in ultimos7],
    }

# Monta API primeiro (prioridade máxima)
app.include_router(api)

# ─── SPA fallback (só pega se nada da API matched) ─────────────
if os.path.isfile(INDEX_PATH):
    @app.api_route("/{path:path}", methods=["GET"])
    async def serve_frontend(path: str):
        from fastapi.responses import FileResponse
        static_path = os.path.normpath(os.path.join(FRONTEND_DIR, path))
        if os.path.isfile(static_path) and static_path.startswith(FRONTEND_DIR):
            return FileResponse(static_path)
        return FileResponse(INDEX_PATH, media_type="text/html")
