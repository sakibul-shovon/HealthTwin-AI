import sys
print("starting debug")
try:
    print("importing fastapi")
    from fastapi import FastAPI
    print("importing CORS")
    from fastapi.middleware.cors import CORSMiddleware
    print("importing datetime")
    from datetime import datetime
    print("importing config")
    from app.config import settings
    print("importing api_router")
    from app.api import router as api_router
    print("importing db")
    from app.graph.database import get_db
    print("all imported!")
except Exception as e:
    print("Exception:", e)
