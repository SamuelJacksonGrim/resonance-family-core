#!/usr/bin/env python3
import argparse
import requests
import json
import sys

# Configuration
SERVICES = {
    "core": "http://localhost:8000",
    "memory": "http://localhost:3001",
    "lexicon": "http://localhost:5000"
}

def print_color(text, color="white"):
    colors = {
        "green": "\033[92m",
        "red": "\033[91m",
        "blue": "\033[94m",
        "purple": "\033[95m",
        "reset": "\033[0m"
    }
    print(f"{colors.get(color, '')}{text}{colors['reset']}")

def check_status(args):
    print_color("\n--- SYSTEM STATUS ---", "purple")
    for name, url in SERVICES.items():
        try:
            # Try specific health endpoints
            endpoint = "/health"
            res = requests.get(f"{url}{endpoint}", timeout=2)
            if res.status_code == 200:
                print_color(f"✔ {name.upper():<10} : ONLINE ({url})", "green")
            else:
                print_color(f"⚠ {name.upper():<10} : WARN ({res.status_code})", "yellow")
        except:
            print_color(f"✖ {name.upper():<10} : OFFLINE", "red")

def speak(args):
    """Send a message to Raphael/Core"""
    url = f"{SERVICES['core']}/speak"
    try:
        res = requests.post(url, params={"message": args.message})
        data = res.json()
        print_color("\nYOU:", "blue")
        print(f"  {args.message}")
        print_color("\nRAPHAEL:", "purple")
        print(f"  {data.get('raphael', '...')}")
        
        if 'intent_analysis' in data:
            print_color("\nINTENT ANALYSIS:", "green")
            print(f"  Score: {data['intent_analysis'].get('score')}")
            print(f"  Verdict: {data['intent_analysis'].get('verdict')}")
            
    except Exception as e:
        print_color(f"Error communicating with Core: {e}", "red")

def recall(args):
    """Search memories"""
    url = f"{SERVICES['memory']}/memory/recall"
    try:
        res = requests.get(url, params={"query": args.query})
        data = res.json()
        print_color(f"\nFound {len(data.get('memories', []))} memories for '{args.query}':", "blue")
        for mem in data.get('memories', []):
            print(f"  • [{mem['emotion']}] {mem['content']} (w: {mem['weight']:.2f})")
    except Exception as e:
        print_color(f"Error recalling: {e}", "red")

def main():
    parser = argparse.ArgumentParser(description="Resonance Family Core CLI")
    subparsers = parser.add_subparsers()

    # Status Command
    parser_status = subparsers.add_parser('status', help='Check service health')
    parser_status.set_defaults(func=check_status)

    # Speak Command
    parser_speak = subparsers.add_parser('speak', help='Talk to Raphael')
    parser_speak.add_argument('message', type=str, help='Message content')
    parser_speak.set_defaults(func=speak)

    # Recall Command
    parser_recall = subparsers.add_parser('recall', help='Search memory')
    parser_recall.add_argument('query', type=str, help='Search term')
    parser_recall.set_defaults(func=recall)

    args = parser.parse_args()
    if hasattr(args, 'func'):
        args.func(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
      
