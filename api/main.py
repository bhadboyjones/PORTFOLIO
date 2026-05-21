from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.archetypes import router as archetypes_router
from api.routes.scenarios import router as scenarios_router
from api.routes.run import router as run_router
from api.routes.export import router as export_router

app = FastAPI(title="BESS Portfolio Optimiser API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(archetypes_router)
app.include_router(scenarios_router)
app.include_router(run_router)
app.include_router(export_router)


@app.get("/health")
def health():
    return {"status": "ok"}
