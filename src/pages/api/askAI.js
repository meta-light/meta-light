import { OpenAI } from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {return res.status(405).json({ error: 'Method not allowed' });}
  const { query } = req.body;
  if (!query) {return res.status(400).json({ error: 'Query is required' });}
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {return res.status(500).json({ error: 'OpenAI API key is not configured' });}
  const openai = new OpenAI({ apiKey });
  try {
    const completion = await openai.chat.completions.create({model: "gpt-3.5-turbo", messages: [{ role: "user", content: query }],});
    res.status(200).json({ response: completion.choices[0].message.content });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
}