import sys
from pathlib import Path

# Ensure imports work when running from llm_agent/
ROOT = Path(__file__).resolve().parents[1]
OPENREVIEWS_DIR = ROOT / "scraper" / "openreviews"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(OPENREVIEWS_DIR))

from utils import load_papers

pkl_path = ROOT / "results" / "ICLR_2025.pkl"
papers = load_papers(pkl_path)

print('groups:', list(papers))
for venue, notes in papers['conference'].items():
    print(venue, len(notes))
    # for n in notes:
    #     abstract = n.content.get('abstract')
    #     abstract_text = abstract.get('value') if isinstance(abstract, dict) else abstract
    #     print(n.content.get('title'), abstract_text)

first = next(iter(papers['conference'].values()))[0]
print('forum:', first.forum)
print('title:', first.content.get('title'))
abstract = first.content.get('abstract')
abstract_text = abstract.get('value') if isinstance(abstract, dict) else abstract
print('abstract:', abstract_text)
print('pdf:', first.content.get('pdf'))
v = first.content.get('venue')
label = v.get('value') if isinstance(v, dict) else v
presentation = next((k for k in ("Oral", "Spotlight", "Poster")
                        if label and k.lower() in label.lower()), None)
print('presentation:', presentation)