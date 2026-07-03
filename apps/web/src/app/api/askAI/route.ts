import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key is not configured' }, { status: 500 });
    }
    
    const openai = new OpenAI({ apiKey });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", 
      messages: [{ role: "user", content: query }],
    });
    
    return NextResponse.json({ response: completion.choices[0].message.content }, { status: 200 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'An error occurred while processing your request' }, { status: 500 });
  }
}