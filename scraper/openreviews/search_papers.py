import openreview
import os
from datetime import datetime
from config import EMAIL, PASSWORD, DEFAULT_VENUE, DEFAULT_SEARCH_LIMIT

def search_papers(query, venue=DEFAULT_VENUE, limit=DEFAULT_SEARCH_LIMIT):
    """
    Search for papers using OpenReview's search API
    
    Args:
        query (str): Search query
        venue (str): Conference venue to search in
        limit (int): Maximum number of results to return
    """
    # Initialize OpenReview client with credentials from config
    client = openreview.Client(
        username=EMAIL,  # Using EMAIL as username
        password=PASSWORD
    )
    
    # Construct the search query
    search_query = {
        'content': {
            'title': query,
            'abstract': query,
            'keywords': query
        },
        'venue': venue
    }
    
    # Perform the search
    papers = client.search_notes(**search_query, limit=limit)
    
    # Print results
    print(f"\nFound {len(papers)} papers matching query: '{query}'")
    print("-" * 80)
    
    for i, paper in enumerate(papers, 1):
        title = paper.content.get('title', {}).get('value', 'No title')
        abstract = paper.content.get('abstract', {}).get('value', 'No abstract')
        authors = paper.content.get('authors', {}).get('value', [])
        
        print(f"\n{i}. {title}")
        print(f"   Authors: {', '.join(authors)}")
        print(f"   Forum: https://openreview.net/forum?id={paper.forum}")
        print(f"   PDF: https://openreview.net/pdf?id={paper.forum}")
        print("\n   Abstract:")
        print(f"   {abstract[:200]}...")  # Show first 200 chars of abstract
        print("-" * 80)

def main():
    while True:
        query = input("\nEnter search query (or 'exit' to quit): ").strip()
        if query.lower() == 'exit':
            break
            
        try:
            search_papers(query)
        except Exception as e:
            print(f"Error performing search: {str(e)}")

if __name__ == "__main__":
    main() 