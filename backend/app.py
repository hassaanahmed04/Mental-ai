#### app.py
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from models import analyze_text

app = Flask(__name__)
CORS(app)

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    user_message = data.get("message", "")
    
    if not user_message:
        return jsonify({"error": "No message provided"}), 400
    
    response_data = analyze_text(user_message)
    
    return jsonify(response_data)
@app.route("/", methods=["GET", "POST"])
def index():
    return render_template("index.html")

if __name__ == '__main__':
    app.run(debug=True)
