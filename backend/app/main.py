import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import (
    app_settings,
    background_images,
    backup,
    custom_emojis,
    entries,
    goals,
    labels,
    link_preview,
    lists,
    llm,
    mcp,
    notes,
    reminders,
    reports,
    search,
    search_history,
    uploads,
)

# Create database tables only if not in test mode
if os.getenv('TESTING') != 'true':
    Base.metadata.create_all(bind=engine)

app = FastAPI(title='Track the Thing API', version='1.0.0')

# Configure CORS
# Allow all origins for now (restrict in production if needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=False,  # Set to False when using allow_origins=["*"]
    allow_methods=['*'],
    allow_headers=['*'],
)

# Include routers
app.include_router(notes.router, prefix='/api/notes', tags=['notes'])
app.include_router(entries.router, prefix='/api/entries', tags=['entries'])
app.include_router(uploads.router, prefix='/api/uploads', tags=['uploads'])
app.include_router(labels.router, prefix='/api/labels', tags=['labels'])
app.include_router(lists.router)
app.include_router(backup.router, prefix='/api/backup', tags=['backup'])
app.include_router(reports.router, prefix='/api/reports', tags=['reports'])
app.include_router(search.router, prefix='/api/search', tags=['search'])
app.include_router(search_history.router, prefix='/api/search-history', tags=['search-history'])
app.include_router(link_preview.router, prefix='/api/link-preview', tags=['link-preview'])
app.include_router(background_images.router, prefix='/api/background-images', tags=['background-images'])
app.include_router(custom_emojis.router)
app.include_router(app_settings.router)
app.include_router(goals.router)
app.include_router(reminders.router)
app.include_router(llm.router)
app.include_router(mcp.router)


@app.get('/')
async def root():
    return {'message': 'Track the Thing API', 'version': '1.0.0'}


@app.get('/health')
async def health():
    return {'status': 'healthy'}
