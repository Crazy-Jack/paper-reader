#!/usr/bin/env python3
"""
Convert pickle files to JSON for use in Electron app.
Run this script once to convert all pickle files to JSON format.
"""
import sys
import json
from pathlib import Path

# Add the scraper directory to path
ROOT = Path(__file__).resolve().parents[1]
OPENREVIEWS_DIR = ROOT / "scraper" / "openreviews"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(OPENREVIEWS_DIR))

from utils import load_papers

def convert_pickle_to_json(dataset_name):
    """Convert a pickle file to JSON format."""
    pkl_path = ROOT / "results" / f"{dataset_name}.pkl"
    
    if not pkl_path.exists():
        print(f"Error: Dataset file not found: {pkl_path}")
        return False
    
    print(f"Loading {dataset_name} from pickle...")
    papers = load_papers(pkl_path)
    
    # Convert to list format
    papers_list = []
    if isinstance(papers, dict):
        for group, grouped_venues in papers.items():
            if isinstance(grouped_venues, dict):
                for venue, venue_papers in grouped_venues.items():
                    for paper in venue_papers:
                        paper_data = extract_paper_data(paper)
                        papers_list.append(paper_data)
            else:
                for paper in grouped_venues:
                    paper_data = extract_paper_data(paper)
                    papers_list.append(paper_data)
    else:
        for paper in papers:
            paper_data = extract_paper_data(paper)
            papers_list.append(paper_data)
    
    # Create output directory
    output_dir = ROOT / "local-desktop-agent" / "data"
    output_dir.mkdir(exist_ok=True)
    
    # Save as JSON
    output_path = output_dir / f"{dataset_name}.json"
    result = {
        "dataset": dataset_name,
        "count": len(papers_list),
        "papers": papers_list
    }
    
    print(f"Saving to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Converted {len(papers_list)} papers from {dataset_name}.pkl to {dataset_name}.json")
    return True

def extract_paper_data(paper):
    """Extract relevant data from a paper object."""
    paper_data = {
        "forum": paper.forum if hasattr(paper, 'forum') else None,
        "title": None,
        "abstract": None,
        "pdf": None,
        "venue": None,
        "presentation": None,
        "authors": None
    }
    
    if hasattr(paper, 'content') and paper.content:
        title_obj = paper.content.get('title')
        paper_data["title"] = title_obj.get('value') if isinstance(title_obj, dict) else title_obj
        
        abstract_obj = paper.content.get('abstract')
        paper_data["abstract"] = abstract_obj.get('value') if isinstance(abstract_obj, dict) else abstract_obj
        
        pdf_obj = paper.content.get('pdf')
        paper_data["pdf"] = pdf_obj.get('value') if isinstance(pdf_obj, dict) else pdf_obj
        
        venue_obj = paper.content.get('venue')
        venue_label = venue_obj.get('value') if isinstance(venue_obj, dict) else venue_obj
        paper_data["venue"] = venue_label
        
        # Determine presentation type
        if venue_label:
            for pres_type in ("Oral", "Spotlight", "Poster"):
                if pres_type.lower() in venue_label.lower():
                    paper_data["presentation"] = pres_type
                    break
        
        # Extract authors if available
        authors_obj = paper.content.get('authors')
        if authors_obj:
            if isinstance(authors_obj, list):
                paper_data["authors"] = [a.get('value') if isinstance(a, dict) else a for a in authors_obj]
            elif isinstance(authors_obj, dict):
                paper_data["authors"] = [authors_obj.get('value')] if authors_obj.get('value') else []
    
    return paper_data

if __name__ == "__main__":
    # Get datasets from results directory
    results_dir = ROOT / "results"
    pkl_files = list(results_dir.glob("*.pkl"))
    
    if len(sys.argv) > 1:
        # Convert specific dataset
        dataset = sys.argv[1]
        convert_pickle_to_json(dataset)
    else:
        # Convert all pickle files found
        print(f"Found {len(pkl_files)} pickle files in results directory")
        for pkl_file in pkl_files:
            dataset_name = pkl_file.stem  # filename without extension
            print(f"\nConverting {dataset_name}...")
            convert_pickle_to_json(dataset_name)
        
        print("\n✓ Conversion complete!")

