import requests
import json

DEEPSEEK_API_KEY = "sk-670c4706f2944d369a51569cd87885ef"
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
    "Content-Type": "application/json"
}

prompt = (
    "Analyze the emotional tone of the following message and categorize the distress level "
    "as 'Low', 'Medium', or 'High'. Provide a short reason for your decision.\n\n"
    "User message: \"I feel really overwhelmed and don't know what to do.\"\n\n"
    "Respond in JSON format like this:\n"
    "{\n"
    "  \"distress_level\": \"Low/Medium/High\",\n"
    "  \"reason\": \"Your reasoning here.\"\n"
    "}"
)

data = {
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": prompt}]
}

response = requests.post(DEEPSEEK_URL, json=data, headers=headers)
print(response.json())  # Check actual API response
