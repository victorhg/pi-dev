import sys
from ddgs import DDGS

def search(query):
    try:
        with DDGS() as ddgs:
            results = [r for r in ddgs.text(query, max_results=5)]
            for r in results:
                print(f"Title: {r['title']}")
                print(f"Link: {r['href']}")
                print(f"Snippet: {r['body']}")
                print("-" * 20)
    except Exception as e:
        print(f"Error performing search: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 search.py '<query>'")
        sys.exit(1)
    
    query = sys.argv[1]
    search(query)
