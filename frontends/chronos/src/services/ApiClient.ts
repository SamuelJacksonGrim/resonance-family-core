const CONFIG = {
    MEMORY_URL: 'http://localhost:3001',
    CORE_URL: 'http://localhost:8000',
    LEXICON_URL: 'http://localhost:5000'
};

export class ResonanceClient {
    
    // --- MEMORY ---
    static async storeMemory(content: string, emotion: string, type: string) {
        const res = await fetch(`${CONFIG.MEMORY_URL}/memory/store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, emotion, type })
        });
        return res.json();
    }

    static async recall(query: string) {
        const res = await fetch(`${CONFIG.MEMORY_URL}/memory/recall?query=${encodeURIComponent(query)}`);
        return res.json();
    }

    // --- RAPHAEL / CORE ---
    static async speakToRaphael(message: string) {
        const res = await fetch(`${CONFIG.CORE_URL}/speak?message=${encodeURIComponent(message)}`, {
            method: 'POST'
        });
        return res.json();
    }

    // --- LEXICON ---
    static async lookupConcept(term: string) {
        const res = await fetch(`${CONFIG.LEXICON_URL}/api/lookup?term=${encodeURIComponent(term)}`);
        return res.json();
    }
  }
  
