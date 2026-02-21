import sys
import os
import json
from dotenv import load_dotenv
from pathlib import Path
import shutil

try:
    from langchain_core.vectorstores import VectorStoreRetriever

    if not hasattr(VectorStoreRetriever, "get_relevant_documents"):
        def get_relevant_documents(self, query):
            return self.invoke(query)

        VectorStoreRetriever.get_relevant_documents = get_relevant_documents

except Exception:
    pass

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from auth import router as auth_router
from db import create_tables
from backend.tools.query import get_answer

from fastmcp import FastMCP

# 🔥 Gemini
from google.generativeai import GenerativeModel, configure

load_dotenv()

app = FastAPI(title="Autism Guide Backend + MCP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    create_tables()

mcp = FastMCP(name="autism-guide")

# =====================================================
# RAG TOOL
# =====================================================

@mcp.tool(
    name="rag_query",
    description="Answer autism-related questions using RAG + memory."
)
async def rag_query_tool(question: str, user_id: int | None = None):
    return await get_answer(question, user_id)

# =====================================================
# GEMINI CONFIG
# =====================================================

configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini = GenerativeModel("gemini-2.5-flash")

# =====================================================
# INTERNAL IMAGE PROCESSING FUNCTION (UPDATED)
# =====================================================

async def process_medicine_image(image_path: str):
    try:
        if not os.path.exists(image_path):
            return "❌ Image path does not exist."

        # Detect MIME dynamically
        ext = image_path.split(".")[-1].lower()
        mime_type = f"image/{ext}" if ext != "jpg" else "image/jpeg"

        with open(image_path, "rb") as f:
            image_bytes = f.read()

        # 🔥 SINGLE SMART PROMPT (NO JSON ANYMORE)
        response = gemini.generate_content([
            {
                "mime_type": mime_type,
                "data": image_bytes
            },
            """
You are a professional medical information assistant.

Carefully analyze this medicine package image.

1. Identify:
   - Medicine Brand Name
   - Generic Composition
   - Strength (if visible)

2. Then provide complete medical information in a clear,
structured, ChatGPT-style response.

Format using headings and bullet points.

Include:
- Medicine Name
- Generic Name
- Drug Class
- Uses
- General Dosage Information (NOT personalized)
- Common Side Effects
- Serious Side Effects
- Contraindications
- Drug Interactions
- Safety Precautions
- Storage Instructions

Rules:
- Do NOT return JSON.
- Do NOT wrap response in markdown code blocks.
- Do NOT prescribe.
- Add a clear medical disclaimer at the end.
- Keep tone professional and easy to understand.
"""
        ])

        return response.text.strip()

    except Exception as e:
        return f"Execution error: {e}"
# =====================================================
# MCP TOOL WRAPPER
# =====================================================

@mcp.tool(
    name="medicine_info_agent",
    description="Extract medicine details from an image and provide complete medical information."
)
async def medicine_info_agent(image_path: str):
    return await process_medicine_image(image_path)

app.mount("/mcp", mcp)

# =====================================================
# CHAT ENDPOINT
# =====================================================

class QuestionSchema(BaseModel):
    question: str
    user_id: int | None = None

@app.post("/chat")
async def chat(q: QuestionSchema):
    answer = await get_answer(q.question, user_id=q.user_id)
    return {"answer": answer}

# =====================================================
# FILE UPLOAD ENDPOINT
# =====================================================

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):

    try:
        file_path = UPLOAD_DIR / file.filename

        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # IMAGE FILE
        if file.content_type.startswith("image"):
            result = await process_medicine_image(str(file_path))
            return {"answer": result}

        # PDF FILE
        if file.content_type == "application/pdf":
            return {"answer": f"📄 PDF uploaded successfully: {file.filename}"}

        return {"answer": "❌ Unsupported file type."}

    except Exception as e:
        return {"answer": f"Upload processing error: {str(e)}"}

# =====================================================

app.include_router(auth_router)

@app.get("/")
def root():
    return {"status": "Backend + MCP running 🚀"}