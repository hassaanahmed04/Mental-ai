import os
import requests
import json
import csv
import random
from flask import Flask, current_app
from config import GEMINI_API_KEY

app = Flask(__name__)  # Ensure Flask app is defined

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

def load_video_links():
    """Loads video links from the CSV file dynamically inside Flask app context."""
    video_links = {"Low": [], "Medium": [], "High": []}
    
    with app.app_context():  # Ensure Flask context is active
        try:
            csv_file_path = os.path.join(current_app.root_path, "static", "data", "distress_links.csv")
            print(f"Checking CSV file at: {csv_file_path}")
            if not os.path.exists(csv_file_path):
                print("⚠️ CSV file not found!")
                return video_links
            
            with open(csv_file_path, newline='', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    row = {key.strip(): value.strip() for key, value in row.items()}  # Clean spaces
                    distress_level = row.get("distress_level", "").strip()
                    link = row.get("link", "").strip()
                    if distress_level in video_links and link:
                        video_links[distress_level].append(link)

            # print("✅ Loaded video links:", video_links)
        
        except Exception as e:
            print(f"❌ Error loading CSV file: {e}")
    
    return video_links

# Load video links once at startup **inside app context**
with app.app_context():
    VIDEO_LINKS = load_video_links()


def detect_distress_level(message):
    """Analyzes the distress level of the user's message."""
    headers = {"Content-Type": "application/json"}

    prompt = (
        "Analyze the emotional tone of the message. Categorize the distress level as 'Low', 'Medium', or 'High'.\n\n"
        f"User message: \"{message}\"\n\n"
        "Respond in JSON format like this:\n"
        "{\n"
        "  \"distress_level\": \"Low/Medium/High\",\n"
        "  \"reason\": \"Reason here.\"\n"
        "}"
    )

    data = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 100}
    }

    try:
        response = requests.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=data, headers=headers)
        response_json = response.json()

        if "candidates" in response_json and len(response_json["candidates"]) > 0:
            ai_response = response_json["candidates"][0]["content"]["parts"][0]["text"]
            ai_response_cleaned = ai_response.strip('```json\n').strip('```')
            distress_data = json.loads(ai_response_cleaned)

            if "distress_level" in distress_data and "reason" in distress_data:
                return distress_data
        return {"distress_level": "Unknown", "reason": "No valid response."}
    
    except Exception as e:
        return {"distress_level": "Error", "reason": "API error. Try again later."}


def generate_ai_response(message):
    """Generates a supportive AI response."""
    headers = {"Content-Type": "application/json"}

    data = {
        "contents": [{"parts": [{"text": message}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 100}
    }

    try:
        response = requests.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=data, headers=headers)
        response_json = response.json()

        if "candidates" in response_json and len(response_json["candidates"]) > 0:
            return response_json["candidates"][0]["content"]["parts"][0]["text"]
        else:
            return "I'm here to support you. Please try again later."
    
    except Exception as e:
        return "Error processing your request. Please try again later."


def get_video_recommendations(distress_level):
    """Randomly selects at least one and at most two links based on distress level."""
    links = VIDEO_LINKS.get(distress_level, [])
    return random.sample(links, k=min(2, max(1, len(links)))) if links else []

def analyze_text(message):
    """Analyzes distress level and generates a response."""
    distress_info = detect_distress_level(message)
    distress_level = distress_info.get("distress_level", "Unknown")
    reasoning = distress_info.get("reason", "No reasoning provided.")

    ai_response = generate_ai_response(message)
    video_recommendations = get_video_recommendations(distress_level)

    recommendation = ""
    if distress_level == "High":
        recommendation = "Please contact a crisis helpline immediately."
    elif distress_level == "Medium":
        recommendation = "Try deep breathing, mindfulness, or talk to someone you trust."
    else:
        recommendation = "You're doing great! Keep practicing self-care and mindfulness."

    return {
        "distress_level": distress_level,
        "reasoning": reasoning,
        "ai_response": ai_response,
        "recommendation": recommendation,
        "video_recommendations": video_recommendations
    }
