---
name: websearch
description: Performs web searches and retrieves content from websites. Use this when you need to find up-to-date information, documentation, or specific web content.
---

# Web Search

## Setup

No setup required for basic functionality. For advanced features, ensure you have a search API key configured in your environment variables.

## Usage

### Search the web
Use the `search` script to perform a web search and get a list of results.
```bash
python3 search.py "<query>"
```

### Fetch page content
Use the `fetch` script to retrieve the text content of a specific URL.
```bash
python3 fetch.py "<url>"
```
