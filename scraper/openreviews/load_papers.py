import pickle
import pandas as pd
import os
import subprocess

# Load the papers from the pickle file
with open('results/ICLR_2025.pkl', 'rb') as f:
    papers = pickle.load(f)

print(f"\nPapers loaded from: results/ICLR_2025.pkl")
print("\nPapers structure:", type(papers))
if isinstance(papers, dict):
    print("Keys:", papers.keys())

# First convert papers to a list if it's in a different structure
papers_list = []
if isinstance(papers, dict):
    for group, grouped_venues in papers.items():
        if isinstance(grouped_venues, dict):
            for venue, venue_papers in grouped_venues.items():
                papers_list.extend(venue_papers)
        else:
            papers_list.extend(grouped_venues)
else:
    papers_list = list(papers)

# Create pdfs directory if it doesn't exist
os.makedirs('pdfs', exist_ok=True)

# Download PDFs for first 10 papers
print("\nDownloading PDFs for first 10 papers:\n")
for i, paper in enumerate(papers_list[:10], 1):
    if hasattr(paper, 'content'):
        title = paper.content.get('title', {}).get('value', '')
        forum_id = paper.forum
    else:
        title = paper.get('content', {}).get('title', {}).get('value', '')
        forum_id = paper.get('id')
    
    # Create PDF URL and filename
    pdf_url = f"https://openreview.net/pdf?id={forum_id}"
    pdf_filename = f"pdfs/{forum_id}.pdf"
    
    print(f"{i}. Downloading: {title}")
    print(f"   URL: {pdf_url}")
    
    # Download PDF using curl
    try:
        subprocess.run(['curl', '-L', '-o', pdf_filename, pdf_url], check=True)
        print(f"   ✓ Saved to: {pdf_filename}\n")
    except subprocess.CalledProcessError as e:
        print(f"   ✗ Failed to download: {e}\n")

print("\nDownload complete. PDFs are saved in the 'pdfs' directory.")

# Display first 5 papers with complete PDF URLs
print("\nFirst 5 papers with PDF links:\n")
for i, paper in enumerate(papers_list[:5], 1):
    if hasattr(paper, 'content'):
        title = paper.content.get('title', {}).get('value', '')
        forum_id = paper.forum
    else:
        title = paper.get('content', {}).get('title', {}).get('value', '')
        forum_id = paper.get('id')
    
    # Create PDF URL using forum ID
    pdf_url = f"https://openreview.net/pdf?id={forum_id}"
    
    print(f"{i}. {title}")
    print(f"   PDF: {pdf_url}")
    print(f"   Forum: https://openreview.net/forum?id={forum_id}\n")

# Save all papers to CSV for easier viewing
papers_data = []
for paper in papers_list:
    if hasattr(paper, 'content'):
        title = paper.content.get('title', {}).get('value', '')
        abstract = paper.content.get('abstract', {}).get('value', '')
        forum_id = paper.forum
    else:
        title = paper.get('content', {}).get('title', {}).get('value', '')
        abstract = paper.get('content', {}).get('abstract', {}).get('value', '')
        forum_id = paper.get('id')
        
    papers_data.append({
        'title': title,
        'abstract': abstract,
        'pdf_url': f"https://openreview.net/pdf?id={forum_id}",
        'forum_url': f"https://openreview.net/forum?id={forum_id}"
    })

df = pd.DataFrame(papers_data)
df.to_csv('results/ICLR_2025_papers.csv', index=False)
print("Saved all papers to results/ICLR_2025_papers.csv") 