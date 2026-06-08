<div align="center">
  <h1>Automated Claim Matcher (ACM)</h1>
  <p><strong>An AI-powered fact-checking engine leveraging NLP and Vector Search</strong></p>
</div>

## Project Overview
The Automated Claim Matcher (ACM) aims to combat misinformation by automating the initial steps of fact-checking. When a user inputs a claim, the system leverages a multilingual Natural Language Processing (NLP) model to convert the text into mathematical embeddings. It then performs a semantic vector search across a MongoDB Atlas database of verified claims to find highly relevant, fact-checked context.

## Key Features
- **Semantic Text Matching**: Goes beyond keyword matching by understanding the meaning of a claim using Sentence Transformers.
- **Microservices Architecture**: Decoupled frontend, Node.js API gateway, and Python NLP service.
- **Automated Data Pipeline**: Includes custom web scrapers to gather verified articles and batch-process them into vector embeddings.
- **Confidence Scoring**: Returns a mathematically calculated confidence score for every match.

## Technical Skills & Stack
This project was built to demonstrate proficiency across the full stack and machine learning integration:

* **Machine Learning & NLP**
  * **Hugging Face Sentence-Transformers**: Deployed `paraphrase-multilingual-MiniLM-L12-v2` for generating 384-dimensional dense vectors.
  * **Semantic Search**: Implemented similarity thresholds (0.85) to balance false positives/negatives in information retrieval.
* **Backend API Engineering**
  * **Node.js & Express**: Built the primary API Gateway handling client REST requests and input validation.
  * **Python & FastAPI**: Designed a lightweight internal microservice strictly for CPU-bound vectorization tasks.
* **Database Management**
  * **MongoDB Atlas Vector Search**: Engineered `$vectorSearch` aggregation pipelines to perform K-Nearest Neighbor (KNN) searches on high-dimensional data.
* **Data Engineering (Web Scraping)**
  * **Python (BeautifulSoup4 & Requests)**: Created custom scraping scripts to build the initial dataset of verified facts from various news sources.
* **Frontend Development**
  * **HTML/CSS/Vanilla JS**: Created a responsive UI to consume the REST APIs.

## System Architecture

1. **Client**: User submits a claim via the frontend.
2. **Node.js API Gateway**: Receives the claim, validates length, and forwards the text to the NLP service.
3. **Python FastAPI Service**: Converts the raw text into a mathematical vector array and returns it to the Node server.
4. **MongoDB Atlas**: The Node server queries the database using the vector array. MongoDB performs a semantic search against previously scraped and embedded articles.
5. **Response**: The best match (if it meets the threshold) is returned to the user with a confidence score.

## Project Structure
```text
ACM_detector/
├── api/                  # Node.js Express server handling main API routes
├── nlp_service/          # Python FastAPI service for generating text embeddings
├── data_pipeline/        # Web scrapers and batch embedding generation scripts
├── frontend/             # HTML/CSS/JS user interface files
├── requirements.txt      # Python dependencies
└── package.json          # Node.js dependencies
```

## Installation & Setup

### Prerequisites
* Node.js (v18+)
* Python (3.9+)
* MongoDB Atlas account with a configured Vector Search index on the `embedding` field.

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/ACM_detector.git
cd ACM_detector
```

### 2. Setup the Python NLP Service
```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI service
cd nlp_service
uvicorn vector_service:app --reload --port 8000
```

### 3. Setup the Node.js API Gateway
```bash
# Open a new terminal and navigate to the project root
npm install

# Create a .env file and add your MongoDB connection string
echo "MONGO_URI=your_mongodb_connection_string" > .env

# Start the Express server
cd api
npm run start
```

### 4. Run the Frontend
Serve the `frontend/index.html` file using a local web server (e.g., VS Code Live Server) or open it directly in your browser.
