import React, { useState } from 'react';

export default function SolanaMetadata() {
  const [metadata, setMetadata] = useState({
    name: '',
    symbol: '',
    description: '',
    image: '',
    properties: {
      files: [{ uri: '', type: 'image/png' }],
      category: 'image',
    },
  });
  const [generatedFiles, setGeneratedFiles] = useState([]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setMetadata(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleFilePropertyChange = (e) => {
    const { name, value } = e.target;
    setMetadata(prevState => ({
      ...prevState,
      properties: {
        ...prevState.properties,
        files: [{ ...prevState.properties.files[0], [name]: value }]
      }
    }));
  };

  const generateMetadata = () => {
    let generatedFiles = [];
    for (let counter = 0; counter <= 100; counter++) {
      let currentMetadata = {
        ...metadata,
        image: `${counter}.png`,
        properties: {
          ...metadata.properties,
          files: [{ ...metadata.properties.files[0], uri: `${counter}.glb` }]
        }
      };
      let jsonOutput = JSON.stringify(currentMetadata, null, 2);
      let fileName = `${counter}.json`;
      generatedFiles.push({ name: fileName, content: jsonOutput });
    }
    setGeneratedFiles(generatedFiles);
    console.log("Metadata generation completed.");
  };

  const downloadFile = (fileName, content) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4">Generate Solana Metadata</h2>
      <form onSubmit={(e) => { e.preventDefault(); generateMetadata(); }} className="space-y-4">
        <div>
          <label className="block mb-1">Name:</label>
          <input
            type="text"
            name="name"
            value={metadata.name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Symbol:</label>
          <input
            type="text"
            name="symbol"
            value={metadata.symbol}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Description:</label>
          <textarea
            name="description"
            value={metadata.description}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block mb-1">File Type:</label>
          <input
            type="text"
            name="type"
            value={metadata.properties.files[0].type}
            onChange={handleFilePropertyChange}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Generate Metadata
        </button>
      </form>

      {generatedFiles.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-2">Generated Files:</h3>
          <ul className="space-y-2">
            {generatedFiles.map((file, index) => (
              <li key={index}>
                <button
                  onClick={() => downloadFile(file.name, file.content)}
                  className="text-blue-500 hover:underline"
                >
                  Download {file.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}