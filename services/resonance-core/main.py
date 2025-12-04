from fastapi import FastAPI
from core.echo_listener import EchoListener

app = FastAPI(title="Resonance Family Core")

# Start the Nervous System Listener on App Startup
@app.on_event("startup")
async def startup_event():
    listener = EchoListener()
    listener.start()

# ... (rest of your API endpoints)
