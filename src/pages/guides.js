import fs from 'fs';
import path from 'path';
import { useState, useEffect } from 'react';
import { remark } from 'remark';
import html from 'remark-html';

export async function getStaticProps() {
  const guidesDir = path.join(process.cwd(), 'public', 'guides');
  let filenames = [];
  try {
    filenames = fs.readdirSync(guidesDir).filter(file => file.endsWith('.md'));
  } catch (error) {
    console.error('Error reading guides directory:', error);
  }

  return { props: { filenames } };
}

export default function MarkdownPage({ filenames = [] }) {
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
      <div>
        {filenames.length > 0 ? (
          filenames.map((filename) => (
            <button key={filename} onClick={() => loadFile(filename)}>
              {filename}
            </button>
          ))
        ) : (
          <p>No guides found.</p>
        )}
      </div>
      <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
    </div>
  );
}