from scraper import Scraper
from extract import Extractor
from filters import title_filter, keywords_filter, abstract_filter
from selector import Selector
from utils import save_papers, load_papers


years = [
    '2025',
    # '2023',
    # '2022',
    # '2021'
]
conferences = [
    'ICLR',
    # 'NeurIPS',
    # 'CVPR',
]
keywords = []

def modify_paper(paper):
    paper.forum = f"https://openreview.net/forum?id={paper.forum}"
    paper.content['pdf'] = f"https://openreview.net{paper.content['pdf']}"
    return paper

# what fields to extract
extractor = Extractor(fields=['forum'], subfields={'content':['title', 'keywords', 'abstract', 'pdf', 'match']})

# if you want to select papers manually among the scraped papers
# selector = Selector()

# select all scraped papers
for conf in conferences:
    selector = None

    scraper = Scraper(conferences=[conf], years=years, keywords=keywords, extractor=extractor, fpath='example.csv', fns=[modify_paper], selector=selector)

    # adding filters to filter on
    scraper.add_filter(title_filter)
    scraper.add_filter(keywords_filter)
    scraper.add_filter(abstract_filter)

    scraper()

    # if you want to save scraped papers as OpenReview objects using pickle
    filename = f"results/{conf}_{'-'.join(years)}.pkl"
    save_papers(scraper.papers, fpath=filename)
    # saved_papers = load_papers(fpath='papers.pkl')