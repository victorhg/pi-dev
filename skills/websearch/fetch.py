import sys
import requests
from bs4 import BeautifulSoup

def fetch(url):
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script_or_style in soup(["script", "style"]):
            script_or_style.decompose()

        # Get text
        text = soup.get_text(separator='\n')

        # Break into lines and remove leading/trailing whitespace
        lines = (line.strip() for line in text.splitlines())
        # Break multi-paragraph into single lines
        chunks = (chunk for chunk in lines if chunk)
        text = '\n'.join(chunks)

        print(text)
    except Exception as e:
        print(f"Error fetching content from {url}: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 fetch.py '<url>'")
        sys.exit(1)
    
    url = sys.argv[1]
    fetch(url)
