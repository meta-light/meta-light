import { useState } from 'react';
import { OpenAI } from 'langchain';
import { SimpleDirectoryReader, GPTSimpleVectorIndex, LLMPredictor, PromptHelper, ServiceContext } from 'llama_index';
import Markdown from 'react-markdown';

export default function Home() {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');

    const constructIndex = async (directoryPath) => {
        const maxInputSize = 4096;
        const numOutputs = 2000;
        const maxChunkOverlap = 20;
        const chunkSizeLimit = 600;

        const promptHelper = new PromptHelper(maxInputSize, numOutputs, maxChunkOverlap, chunkSizeLimit);
        const llmPredictor = new LLMPredictor(new OpenAI({ temperature: 0.5, modelName: "gpt-3.5-turbo-0613", maxTokens: numOutputs }));

        const documents = await new SimpleDirectoryReader(directoryPath).loadData();
        const serviceContext = ServiceContext.fromDefaults({ llmPredictor, promptHelper });
        const index = await GPTSimpleVectorIndex.fromDocuments(documents, { serviceContext });

        await index.saveToDisk('index.json');
        return index;
    };

    const askAI = async () => {
        const index = await GPTSimpleVectorIndex.loadFromDisk('index.json');
        const response = await index.query(query);
        setResponse(response.response);
    };

    const llmPredictor = new LLMPredictor(new OpenAI({ 
        temperature: 0.5, 
        modelName: "gpt-3.5-turbo-0613", 
        maxTokens: numOutputs,
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY 
    }));

    return (
        <div>
            <h1>Ask AI</h1>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What do you want to ask?"
            />
            <button onClick={askAI}>Ask</button>
            {response && <Markdown>{`Response: **${response}**`}</Markdown>}
        </div>
    );
}