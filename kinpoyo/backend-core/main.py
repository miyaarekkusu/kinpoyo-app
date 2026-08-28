import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.uploads import UPLOAD_ROOT
from app.routers import auth, community, exercises, programs, records, users, workout_templates, workouts

# Windowsのコンソールはデフォルトでcp1252などのコードページを使うため、
# count-repsのログ（日本語の関節名など）を print() すると UnicodeEncodeError で
# リクエストごと500になる。stdout/stderrをUTF-8に固定して回避する。
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

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
app.include_router(exercises.router)
app.include_router(workouts.router)
app.include_router(records.router)
app.include_router(programs.router)
app.include_router(programs.user_programs_router)
app.include_router(workout_templates.router)
app.include_router(community.router)

UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_ROOT)), name="uploads")


@app.get("/")
def health_check():
    return {"status": "ok", "message": "kinpoyo API is running"}
