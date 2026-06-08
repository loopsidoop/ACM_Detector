from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
import time
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["factcheck_db"]
collection = db["verified_claims"]

print("Connected to MongoDB successfully!")

# load the NLP model ("paraphrase-multilingual-MiniLM-L12-v2" model)
print("Downloading/Loading the multilingual model... ")

# instantiate the model
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
print("Model loaded and ready!")

# process the documents
query = {"embedding": {"$size": 0}} 
unprocessed_docs = list(collection.find(query))

total_docs = len(unprocessed_docs)
print(f"Found {total_docs} articles that need mathematical embeddings.")

# generate and update the vectors
for index, document in enumerate(unprocessed_docs, 1):
    # the claim text
    text_to_embed = document["claim_text"] 
    
    print(f"Processing {index}/{total_docs}: {text_to_embed[:50]}...")
    
    # generate the 384-dimension vector
    vector = model.encode(text_to_embed).tolist() 
    
    # update the document in MongoDB with the new vector
    collection.update_one(
        {"_id": document["_id"]}, 
        {"$set": {"embedding": vector}}
    )

print("All embeddings updated!")