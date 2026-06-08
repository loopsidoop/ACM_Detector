import { useState } from 'react';

export default function FactChecker() {
    const [claim, setClaim] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); 
    const [error, setError] = useState(null);   

    const getDateFeedback = () => {
        const formatDate = (dateString) => {
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            return new Date(dateString + 'T12:00:00').toLocaleDateString(undefined, options);
        };

        if (startDate && endDate) {
            return <>Searching from <span className="text-blue-700 font-bold">{formatDate(startDate)}</span> to <span className="text-blue-700 font-bold">{formatDate(endDate)}</span>.</>;
        } else if (startDate) {
            return <>Searching from <span className="text-blue-700 font-bold">{formatDate(startDate)}</span> onwards.</>;
        } else if (endDate) {
            return <>Searching everything up to <span className="text-blue-700 font-bold">{formatDate(endDate)}</span>.</>;
        }
        return 'Searching the entire database (No date limits).';
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        
        setLoading(true);
        setResult(null);
        setError(null);

        const payload = { claim };
        if (startDate) payload.startDate = startDate;
        if (endDate) payload.endDate = endDate;

        try {
            const response = await fetch('http://localhost:3000/api/v1/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "An error occurred.");
            } else {
                setResult(data);
            }
        } catch (err) {
            setError("Failed to connect to the backend. Are Express and FastAPI running?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen p-10 font-sans">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
                <h1 className="text-2xl font-bold mb-6 text-gray-800">Automated Claim Matcher</h1>
                
                <form onSubmit={handleVerify} className="space-y-4">
                    {/* Claim Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Suspicious Claim</label>
                        <textarea 
                            value={claim}
                            onChange={(e) => setClaim(e.target.value)}
                            rows="3" 
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                            placeholder="E.g., May ipinapamahaging P150,000 na ayuda para sa mga OFW..." 
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">💡 For the best results, type a complete sentence with specific details.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Start Date (Optional)</label>
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm transition-colors focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">End Date (Optional)</label>
                            <input 
                                type="date" 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm transition-colors focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    
                    <div className={`border rounded p-3 flex items-center space-x-2 shadow-sm transition-all duration-300 ${startDate || endDate ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                        <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span className="text-sm text-gray-600">
                            {getDateFeedback()}
                        </span>
                    </div>

                    <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white font-bold p-3 rounded-md hover:bg-blue-700 transition disabled:opacity-50">
                        {loading ? 'Verifying...' : 'Verify Claim'}
                    </button>
                </form>

                {loading && (
                    <div className="mt-6 text-center text-blue-600 font-semibold flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Running semantic search...</span>
                    </div>
                )}

                {error && !loading && (
                    <div className="mt-8 p-4 rounded-md border-l-4 border-yellow-500 bg-yellow-50">
                        <h3 className="text-lg font-bold mb-2 text-yellow-700">Need More Information</h3>
                        <p className="text-gray-700 mb-2 leading-relaxed">{error}</p>
                    </div>
                )}

                {result && !loading && !error && (
                    <div className={`mt-8 p-4 rounded-md border-l-4 ${result.match_found ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-400 bg-gray-50'}`}>
                        <h3 className={`text-lg font-bold mb-2 ${result.match_found ? 'text-green-700' : 'text-gray-700'}`}>
                            {result.match_found ? 'Match Found!' : 'No Clear Match Found'}
                        </h3>
                        
                        {result.match_found ? (
                            <>
                                <p className="text-gray-700 mb-2 leading-relaxed">
                                    <span className="text-sm text-green-800 bg-green-200 px-2 py-1 rounded-full">AI Confidence Score: {result.confidence_score}</span>
                                </p>
                                <div className="bg-gray-50 p-4 border rounded text-sm space-y-2 mt-4">
                                    <p><strong>Database Match:</strong> <span className="text-gray-800">{result.data.claim_text}</span></p>
                                    <p><strong>Verdict:</strong> <span className={`font-bold uppercase tracking-wide ${result.data.verdict.toLowerCase().includes('false') ? 'text-red-600' : 'text-yellow-600'}`}>{result.data.verdict}</span></p>
                                    <p><strong>Date Verified:</strong> <span className="text-gray-600">{result.data.date_verified}</span></p>
                                    <p><strong>Source:</strong> <a href={result.data.source_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 font-semibold underline">Read Official Article &rarr;</a></p>
                                </div>
                            </>
                        ) : (
                            <p className="text-gray-700 mb-2 leading-relaxed">{result.message}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}