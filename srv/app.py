from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import Optional
import json
import os

from ai import run_inpaint, run_outpaint, run_deblur, run_describe

app = FastAPI()

@app.get("/api/hello")
async def welcome():
    return {"message": "AI-Image Editor FastAPI"}

@app.post("/api/inpaint")
async def inpaint(
    image: UploadFile = File(...),
    mask: UploadFile = File(...),
    prompt: Optional[str] = Form(None)
):
    try:
        output_path = run_inpaint(
            image.file,
            mask.file,
            prompt
        )
        return FileResponse(output_path, media_type="image/png")
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/outpaint")
async def outpaint(
    image: UploadFile = File(...),
    directions: str = Form(...),
    prompt: Optional[str] = Form(None)
):
    try:
        directions_data = json.loads(directions)

        output_path = run_outpaint(
            image.file,
            directions_data,
            prompt
        )

        return FileResponse(output_path, media_type="image/png")

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid directions JSON")
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/deblur")
async def deblur(
    image: UploadFile = File(...),
    prompt: Optional[str] = Form(None)
):
    try:
        output_path = run_deblur(
            image.file,
            prompt
        )

        return FileResponse(output_path, media_type="image/png")

    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/describeme")
async def describeme(
    image: UploadFile = File(...)
):
    try:
        description = run_describe(image.file)
        return JSONResponse(content={"description": description})
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

# Serve SPA
app.mount(
    "/",
    StaticFiles(directory="../frontend/dist", html=True),
    name="static"
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )