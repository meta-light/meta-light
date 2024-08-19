import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method === 'POST') {
    const { data } = req.body;
    
    try {
      const uniqueData = Array.from(new Set(data));
      const outputPath = path.join(process.cwd(), 'public', 'uniqueOwners.json');
      fs.writeFileSync(outputPath, JSON.stringify(uniqueData), 'utf-8');
      
      res.status(200).json({ message: 'File processed and saved successfully', path: '/uniqueOwners.json' });
    } catch (error) {
      console.error('Error processing the file:', error);
      res.status(500).json({ error: 'Error processing the file' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}