import { useState } from 'react';
import { remark } from 'remark';
import html from 'remark-html';
import path from 'path';

export default function GuidesComponent({ filenames = [] }) {
  const [contentHtml, setContentHtml] = useState('');
  
  const loadFile = async (filename) => {
    const filePath = path.join('/guides', filename); // Adjusted path
    const response = await fetch(filePath);
    const fileContents = await response.text();
    const processedContent = await remark().use(html).process(fileContents);
    setContentHtml(processedContent.toString());
  };

  return (
    <div>
      <div>{filenames.length > 0 ? (filenames.map((filename) => (<button key={filename} onClick={() => loadFile(filename)}>{filename}</button>))) : (<p>No guides found.</p>)}</div>
      <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
    </div>
  );
} 