
import express from 'express';
import { MongoClient } from 'mongodb';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors'; 
dotenv.config();

// initialize express
const app = express();
app.use(cors());
app.use(express.json());

// initialize MongoDB Connection
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let collection;

async function connectDB() {
    await client.connect();
    collection = client.db("factcheck_db").collection("verified_claims");
    console.log("Connected to MongoDB Atlas!");
}
connectDB();

// The primary API Endpoint
app.post('/api/v1/verify', async (req, res) => {
    try {

        const { claim: userClaim, startDate, endDate } = req.body;
        
        if (!userClaim) {
            return res.status(400).json({ error: "Missing claim text" });
        }

        if (userClaim.trim().length < 20) {
            return res.status(400).json({ 
                error: "Your claim is too short to accurately fact-check. Please type a full sentence or provide more specific details!" 
            });
        }

        // call the python API (the veectorizer)
        const pythonResponse = await axios.post('http://127.0.0.1:8000/vectorize', {
            text: userClaim
        });

                
        const queryVector = pythonResponse.data.embedding;

        // date vector, no range
        let vectorFilter = undefined
        
        if (startDate && endDate) {
            // specific date range
            vectorFilter = { date_verified: { $gte: startDate, $lte: endDate } };
        } else if (startDate) {
            // date and onwards
            vectorFilter = { date_verified: { $gte: startDate } };
        } else if (endDate) {
            // up to end date
            vectorFilter = { date_verified: { $lte: endDate } };
        }
   
        const vectorSearchStage = {
            index: "vector_index", 
            path: "embedding",
            queryVector: queryVector,
            numCandidates: 100,
            limit: 1 
        };

        if (vectorFilter) {
            vectorSearchStage.filter = vectorFilter;
        }

        // time to query in MongoDB (use $vectorSearch)
        const aggPipeline = [
            {
                "$vectorSearch": vectorSearchStage
            },
            {
                "$project": {
                    "_id": 0,
                    "claim_text": 1,
                    "verdict": 1,
                    "organization": 1,
                    "date_verified": 1,
                    "source_url": 1,
                    "score": { "$meta": "vectorSearchScore" } 
                }
            }
        ];

        const results = await collection.aggregate(aggPipeline).toArray();

        // check the results based on the threshold
        if (results.length === 0) {
            return res.json({ match_found: false, message: "No related facts found." });
        }

        const bestMatch = results[0];
        const THRESHOLD = 0.85;

        if (bestMatch.score >= THRESHOLD) {
            res.json({
                match_found: true,
                confidence_score: bestMatch.score.toFixed(4),
                data: bestMatch
            });
        } else {
            res.json({
                match_found: false,
                confidence_score: bestMatch.score.toFixed(4),
                message: "A related topic was found, but it wasn't a close enough match to verify the claim."
            });
        }

    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


app.listen(3000, () => console.log('Express Server running on port 3000'));