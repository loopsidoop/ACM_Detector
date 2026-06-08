from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI()

# load the model 
print("Loading NLP Model...")
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
print("Model ready to serve requests!")

# expecteed JSON payload shape
class TextRequest(BaseModel):
    text: str

# create the single internal endpoint
@app.post("/vectorize")
async def vectorize_text(request: TextRequest):
    # convert text to vector and format as standard Python list
    vector = model.encode(request.text).tolist()
    
    return {"embedding": vector}