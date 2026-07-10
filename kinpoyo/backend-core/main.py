from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, community, programs, records, users, workouts

app = FastAPI(title="kinpoyo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(workouts.router)
app.include_router(records.router)
app.include_router(programs.router)
app.include_router(programs.user_programs_router)
app.include_router(community.router)


@app.get("/")
def health_check():
    return {"status": "ok", "message": "kinpoyo API is running"}
