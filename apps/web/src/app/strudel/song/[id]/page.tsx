import EditorScreenLoader from '@/components/strudel/editor/EditorScreenLoader';

export default async function SongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorScreenLoader songId={id} />;
}
