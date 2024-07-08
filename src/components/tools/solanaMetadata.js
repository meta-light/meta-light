import fs from 'fs';
import path from 'path';

export function generateMetadata(metadata) {
  let counter = 0;

  while (counter <= 100) {
    metadata.image = `${counter}.png`;
    metadata.properties.files[0].uri = `${counter}.glb`;
    let jsonOutput = JSON.stringify(metadata, null, 2);
    let fileName = path.join(process.cwd(), 'public', 'assets', `${counter}.json`); // Update the file path for Next.js
    fs.writeFileSync(fileName, jsonOutput);
    console.log(`Generated metadata file: ${fileName}`);
    counter++;
  }
  console.log("Metadata generation completed.");
}