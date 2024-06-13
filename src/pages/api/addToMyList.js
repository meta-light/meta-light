import fs from 'fs';

export default function handler(req, res) {
  if (req.method === 'POST') {
    const { title } = req.body;
    const filePath = 'public/myList.txt';

    fs.appendFile(filePath, '\n' + title, (error) => {
      if (error) {
        console.error('Error adding movie to list:', error);
        res.status(500).json({ error: 'Error adding movie to list' });
      } else {
        console.log('Movie added to list successfully');
        res.status(200).json({ message: 'Movie added to list successfully' });
      }
    });
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}