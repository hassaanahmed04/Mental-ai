import os
import requests
import json
import csv
import random
from flask import Flask, current_app    
from openai import OpenAI
from config import DEEPSEEK_API_KEY  

app = Flask(__name__)

client = OpenAI(
    base_url="https://api.aimlapi.com/v1",
    api_key=DEEPSEEK_API_KEY
)

def load_video_links():
    video_links = {"Low": [], "Medium": [], "High": []}
    
    with app.app_context():
        try:
            csv_file_path = os.path.join(current_app.root_path, "static", "data", "distress_links.csv")
            if not os.path.exists(csv_file_path):
                print("⚠️ CSV file not found!")
                return video_links
            
            with open(csv_file_path, newline='', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    row = {key.strip(): value.strip() for key, value in row.items()}
                    distress_level = row.get("distress_level", "").strip()
                    link = row.get("link", "").strip()
                    if distress_level in video_links and link:
                        video_links[distress_level].append(link)
        except Exception as e:
            print(f"❌ Error loading CSV file: {e}")
    
    return video_links

with app.app_context():
    VIDEO_LINKS = load_video_links()

def detect_distress_level(message):
    try:
        response = client.chat.completions.create(
            model="deepseek/deepseek-chat",
            messages=[
                {"role": "system", "content": "You are an AI assistant who analyzes emotional distress levels."},
                {"role": "user", "content": f"'{message}'as 'Low', 'Medium', or 'High'. Respond in JSON format like this:\n"
                                            "{\n"
                                            "  \"distress_level\": \"Low/Medium/High\",\n"
                                            "  \"reason\": \"Brief reason here.\"\n"
                                            "}"},
            ],
            max_tokens=100,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        distress_data = json.loads(ai_response.strip("```json\n").strip("```"))
        
        if "distress_level" in distress_data:
            return distress_data
        return {"distress_level": "Unknown", "reason": "No valid response."}
    except Exception as e:
        return {"distress_level": "Error", "reason": f"API error: {str(e)}"}

def generate_ai_response(message):
    try:
        response = client.chat.completions.create(
            model="deepseek/deepseek-chat",
            messages=[
                {"role": "system", "content": "You are a compassionate AI that provides emotional support."},
                {"role": "user", "content": f"Provide a comforting response to the following message: '{message}'"}
            ],
            max_tokens=100,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    except Exception as e:
        return "Error processing your request. Please try again later."

def get_video_recommendations(distress_level):
    links = VIDEO_LINKS.get(distress_level, [])
    return random.sample(links, k=min(2, max(1, len(links)))) if links else []

def analyze_text(message):
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
