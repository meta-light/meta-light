import { useState } from 'react';

export default function GPT() {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const askAI = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/askAI', {method: 'POST', headers: {'Content-Type': 'application/json',}, body: JSON.stringify({ query }),});
            const data = await res.json();
            if (res.ok) {setResponse(data.response);} else {setResponse(`Error: ${data.error}`);}
        } 
        catch (error) {console.error('Error:', error); setResponse('An error occurred while processing your request.');} 
        finally {setIsLoading(false);}
    };

    return (
        <div>
            <h1>Ask AI</h1>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What do you want to ask?"
            />
            <button onClick={askAI} disabled={isLoading}>{isLoading ? 'Loading...' : 'Ask'}</button>
            {response && <p>Response: {response}</p>}
        </div>
    );
}