# agent_medicine_info.py

import os
from fastmcp import FastMCP
from google.generativeai import GenerativeModel, configure
from dotenv import load_dotenv

load_dotenv()

# -----------------------------
# MCP Setup
# -----------------------------
mcp = FastMCP(name="medicine-info-agent")

# -----------------------------
# Gemini Configuration
# -----------------------------
configure(api_key=os.getenv("GEMINI_API_KEY"))

# Vision-capable model
gemini = GenerativeModel("gemini-2.5-flash")


# -----------------------------
# MCP Tool
# -----------------------------
@mcp.tool(
    name="medicine_info_agent",
    description="Analyze a medicine image and provide complete medical information in a ChatGPT-style format."
)
async def medicine_info_tool(image_path: str):

    try:
        if not os.path.exists(image_path):
            return "❌ Image path does not exist."

        # Read image
        with open(image_path, "rb") as f:
            image_bytes = f.read()

        # -----------------------------
        # Single Smart Prompt (Image + Info Together)
        # -----------------------------
        response = gemini.generate_content([
            {
                "mime_type": "image/jpeg",
                "data": image_bytes
            },
            """
You are a professional medical information assistant.

1. Carefully analyze this medicine package image.
2. Identify:
   - Brand name
   - Generic name / composition
   - Strength (if visible)
3. Then provide complete medical information in a natural, ChatGPT-style response.

Structure the response clearly using headings and bullet points:

Include:
- Medicine Name
- Generic Name
- Drug Class
- Uses
- Recommended Dosage (general info only, not personalized)
- Common Side Effects
- Serious Side Effects
- Contraindications
- Drug Interactions
- Safety Precautions
- Storage Instructions

Guidelines:
- Do NOT prescribe or modify dosage.
- Do NOT give personalized medical advice.
- Add a clear medical disclaimer at the end.
- Keep tone professional, clear, and easy to understand.
"""
        ])

        return response.text.strip()

    except Exception as e:
        return f"Execution error: {e}"


# -----------------------------
# Run Server
# -----------------------------
if __name__ == "__main__":
    print("🚀 Medicine Info Agent running at http://0.0.0.0:8002")
    mcp.run(host="0.0.0.0", port=8002, transport="http")