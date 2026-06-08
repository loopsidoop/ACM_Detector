import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient
import random
import time
from datetime import datetime
import traceback
import json 
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os

load_dotenv()

# Initialize Gemini Client
gemini_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# Connect to MongoDB
MONGO_URI = os.getenv("MONGO_URI")
mongo_client = MongoClient(MONGO_URI)
db = mongo_client["factcheck_db"]
collection = db["verified_claims"]

print("Connected to MongoDB successfully!")

user_agent = '<replace with header info>'
cookie_data = '<replace with header info>'

session = requests.Session()    
session.headers.update({
    'User-Agent': user_agent,
    'Cookie': cookie_data,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Referer': 'https://www.factrakers.org/', 
})

failed_scrapes = []

def get_article_links(archive_url):
    print(f"Scanning archive page: {archive_url}")
    response = session.get(archive_url)
    
    if response.status_code != 200:
        print("Blocked or page not found. Update your clearance cookie!")
        return []
    
    soup = BeautifulSoup(response.text, 'html.parser')
    article_links = []
    headlines = soup.find_all('div', class_='JMCi2v blog-post-homepage-link-hashtag-hover-color so9KdE TBrkhx')
    
    for headline in headlines:
        link_tag = headline.find('a')
        if link_tag and 'href' in link_tag.attrs:
            url = link_tag['href']
            if url.startswith('/'):
                url = "https://www.factrakers.org" + url
            article_links.append(url)

    print(f"Found {len(article_links)} articles to scrape!")
    return article_links


# grab raw text
def extract_raw_html_data(url, organization):
    response = session.get(url)

    if response.status_code != 200:
        print(f"Failed to fetch {url}")
        return None
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    try:
        # find the date
        json_scripts = soup.find_all('script', type='application/ld+json')

        for script in json_scripts:
            try:
                data = json.loads(script.get_text(strip=True))
            
                if isinstance(data, list):
                    data_dict = next((item for item in data if 'dateModified' in item), {})
                else:
                    data_dict = data

                if 'dateModified' in data_dict:
                    raw_date_str = data_dict['dateModified'] 
                    date_obj = datetime.fromisoformat(raw_date_str.replace('Z', '+00:00'))
                    
                    # format it to match the db
                    date_verified = date_obj.strftime("%Y-%m-%d")
                    
                    break 
                    
            except (json.JSONDecodeError, TypeError):
                continue

        headline_element = soup.find('h1', attrs={'data-hook': 'post-title'})
        headline = headline_element.get_text(strip=True) if headline_element else "No headline"
        
        # GRAB THE FIRST 5 PARAGRAPHS
        paragraph_blocks = soup.find_all('div', attrs={'data-breakout': 'normal'})

        extracted_paragraphs = []

        for block in paragraph_blocks[:5]:
            
            clean_text = block.get_text(separator=" ", strip=True)
            
            if clean_text and len(clean_text) > 3: 
                extracted_paragraphs.append(clean_text)
        body_text = "\n\n".join(extracted_paragraphs)
        
        # dictionary of the raw data 
        return {
            "source_url": url,
            "organization": organization,
            "date_verified": date_verified,
            "headline": headline,
            "body_text": body_text
        }

    except Exception as e:
        print(f"Error parsing HTML for {url}: {e}")
        return None


# send 10 articles to gemini
def process_batch_with_ai(batch_list):
    print(f"\nSending batch of {len(batch_list)} articles to Gemini...")
    
    # construct the giant prompt with temporary IDs to keep track of which is which
    articles_text = ""
    for index, item in enumerate(batch_list):
        articles_text += f"\n--- ARTICLE ID: {index} ---\n"
        articles_text += f"Headline: {item['headline']}\n"
        articles_text += f"Body: {item['body_text']}\n"
    
    prompt = f"""
    You are a data extraction tool for a fact-checking database.
    I am providing you with {len(batch_list)} fact-check articles. 
    For each article, extract the exact false claim being debunked, and the official verdict.

    {articles_text}
    
    Provide the output as a JSON ARRAY of objects. Each object MUST have exactly these three keys:
    - "id": The integer ARTICLE ID I provided above.
    - "claim_text": The false statement being debunked.
    - "verdict": The verdict (e.g., False, Missing Context, Misleading).
    """
    
    try:
        ai_response = gemini_client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
        
        extracted_array = json.loads(ai_response.text)
        
        # match the AI results back to our original raw data list
        final_documents = []
        for result in extracted_array:
            original_data = batch_list[result["id"]]
            
            fact_check_document = {
                "claim_text": result.get("claim_text", "Claim text not found"),
                "verdict": result.get("verdict", "Verdict text not found"),
                "date_verified": original_data["date_verified"],
                "organization": original_data["organization"],
                "source_url": original_data["source_url"],
                "embedding": [] 
            }
            final_documents.append(fact_check_document)
            
        return final_documents

    except Exception as e:
        print(f"Batch AI Processing Failed: {e}")
        traceback.print_exc()
        return []

# -------------------------------------------------------
archive_page = "https://www.factrakers.org/"
current_page = 70 # current page I'm in
max_pages = 80
all_urls_to_scrape = []

print("Starting pagination crawler...\n")
while current_page <= max_pages:
    cur_page_url = archive_page if current_page == 1 else f"{archive_page}/blog/page/{current_page}"
    print(f"Fetching page: {current_page}")
    cur_urls_to_scrape = get_article_links(cur_page_url)

    if not cur_urls_to_scrape: 
        print("no more articles found")
        break
    
    all_urls_to_scrape.extend(cur_urls_to_scrape)
    current_page += 1
    time.sleep(random.uniform(3.0, 8.0))
    
print(f"\nFound a total of {len(all_urls_to_scrape)} to scrape!\n") 

# BATCH PROCESSING LOGIC
BATCH_SIZE = 40
current_batch = []
success = 0

for target_url in all_urls_to_scrape:
    if collection.find_one({"source_url": target_url}):
        print(f"Skipping {target_url} — already in database.")
        continue
    
    # scrape the raw text
    print(f"Scraping HTML: {target_url}...")
    raw_data = extract_raw_html_data(target_url, "Fact Rakers")
    
    if raw_data:
        current_batch.append(raw_data)
    else:
        failed_scrapes.append(target_url)
    
    time.sleep(random.uniform(2.0, 5.0))

    # process batch if full
    if len(current_batch) >= BATCH_SIZE:
        final_docs = process_batch_with_ai(current_batch)
        
        if final_docs:
            valid_docs = [doc for doc in final_docs if doc["claim_text"] != "Claim text not found"]
            if valid_docs:
                collection.insert_many(valid_docs)
                print(f"Successfully inserted {len(valid_docs)} articles into MongoDB!\n")
                success += len(valid_docs)
            
            # log any failed AI batch
            for doc in final_docs:
                if doc["claim_text"] == "Claim text not found":
                    failed_scrapes.append(doc["source_url"])
        else:
            # if the whole AI batch failed, add all to failed list
            failed_scrapes.extend([item["source_url"] for item in current_batch])
            
        # clear the batch for the next round
        current_batch = []

# leftovers from the last batch
if len(current_batch) > 0:
    final_docs = process_batch_with_ai(current_batch)
    if final_docs:
        valid_docs = [doc for doc in final_docs if doc["claim_text"] != "Claim text not found"]
        if valid_docs:
            collection.insert_many(valid_docs)
            print(f"Successfully inserted final {len(valid_docs)} articles into MongoDB!\n")
            success += len(valid_docs)

print(f"Successful scrapes: {success} / {len(all_urls_to_scrape)}\n")    
    
if failed_scrapes:
    print("Writing the .txt file to store failed scrapped article links")
    with open("rakers_unscraped.txt", "a") as file:
        for link in failed_scrapes:
            file.write(f"{link}\n")
    print("Done updating the .txt file!")