import fs from 'fs';
import path from 'path';
import GuidesComponent from './GuidesComponent';

export async function getStaticProps() {
  const guidesDir = path.join(process.cwd(), 'public', 'guides');
  let filenames = [];
  try {filenames = fs.readdirSync(guidesDir).filter(file => file.endsWith('.md'));} catch (error) {console.error('Error reading guides directory:', error);}
  return { props: { filenames } };
}

export default function Guides({ filenames = [] }) {
  return <GuidesComponent filenames={filenames} />;
}