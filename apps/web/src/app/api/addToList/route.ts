import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json();
    const filePath = 'public/myList.txt';
    
    return new Promise<NextResponse>((resolve, reject) => {
      fs.appendFile(filePath, '\n' + title, (error) => {
        if (error) {
          console.error('Error adding movie to list:', error);
          resolve(NextResponse.json({ error: 'Error adding movie to list' }, { status: 500 }));
        } else {
          console.log('Movie added to list successfully');
          resolve(NextResponse.json({ message: 'Movie added to list successfully' }, { status: 200 }));
        }
      });
    });
  } catch (error) {
    console.error('Error parsing request:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}