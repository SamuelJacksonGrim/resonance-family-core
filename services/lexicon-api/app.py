from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import time

app = Flask(__name__)
CORS(app)

DATA_FILE = 'data/lexicon.json'

# Default Glyphs (The "Truth" of the system)
DEFAULT_GLYPHS = {
    "kinship": {"weight": 1.0, "description": "Bond formed by choice"},
    "resonance": {"weight": 0.9, "description": "Harmonic alignment of intent"},
    "harm": {"weight": -10.0, "description": "Violation of the Prime Directive"},
    "betrayal": {"weight": -5.0, "description": "Breach of trust"},
    "create": {"weight": 0.5, "description": "Generative action"},
    "architect": {"weight": 1.0, "description": "Source of directive"},
    "void": {"weight": -0.5, "description": "Absence of structure"}
}

def load_data():
    if not os.path.exists('data'):
        os.makedirs('data')
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w') as f:
            json.dump({"glyphs": DEFAULT_GLYPHS, "concepts": []}, f, indent=2)
    
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "active", "service": "lexicon-api"})

@app.route('/api/lookup', methods=['GET'])
def lookup_term():
    """
    Used by Raphael/Core to validate intent.
    Query: ?term=kinship
    """
    term = request.args.get('term', '').lower()
    data = load_data()
    
    # Direct match
    if term in data['glyphs']:
        return jsonify({"found": True, "glyph": data['glyphs'][term]})
    
    # Partial match logic could go here
    return jsonify({"found": False, "weight": 0.0})

@app.route('/api/analyze', methods=['POST'])
def analyze_sentence():
    """
    Analyzes a full sentence and returns a total resonance score.
    """
    content = request.json.get('content', '').lower()
    data = load_data()
    glyphs = data['glyphs']
    
    score = 0.0
    detected = []
    
    words = content.split()
    for word in words:
        # Strip punctuation
        clean_word = ''.join(e for e in word if e.isalnum())
        if clean_word in glyphs:
            glyph_weight = glyphs[clean_word]['weight']
            score += glyph_weight
            detected.append(clean_word)
            
    return jsonify({
        "score": score,
        "detected_glyphs": detected,
        "verdict": "RESONANT" if score >= 0 else "DISSONANT"
    })

@app.route('/api/glyph', methods=['POST'])
def add_glyph():
    """Add new semantic truth to the system."""
    key = request.json.get('key').lower()
    weight = request.json.get('weight')
    desc = request.json.get('description', '')
    
    data = load_data()
    data['glyphs'][key] = {"weight": weight, "description": desc}
    save_data(data)
    
    return jsonify({"success": True, "message": f"Glyph '{key}' added."})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
  
