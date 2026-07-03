'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, X, StickyNote, Tag, GitBranch, Phone, AtSign } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ContactWithRelations {
  id: string;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  phone?: string | null;
  avatarColor: string;
  pipelineStageId?: string | null;
  contactTags: { tag: { id: string; name: string; color: string } }[];
  notes: { id: string; body: string; createdAt: number }[];
}

interface Stage {
  id: string;
  name: string;
  color: string;
}

export function ContactPanel({ contactId }: { contactId: string }) {
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const { data: contactData, isLoading } = useQuery<{ contact: ContactWithRelations }>({
    queryKey: ['contact', contactId],
    queryFn: () => fetch(`/api/contacts/${contactId}`).then((r) => r.json()),
    retry: false,
  });

  const { data: tagsData } = useQuery<{ tags: { id: string; name: string; color: string }[] }>({
    queryKey: ['tags'],
    queryFn: () => fetch('/api/tags').then((r) => r.json()),
  });

  const { data: pipelineData } = useQuery<{ board: { id: string; name: string; color: string }[] }>({
    queryKey: ['pipeline'],
    queryFn: () => fetch('/api/pipeline').then((r) => r.json()),
  });

  const updateStage = useMutation({
    mutationFn: (stageId: string | null) =>
      fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStageId: stageId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact', contactId] }),
  });

  const addNote = useMutation({
    mutationFn: (body: string) =>
      fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, body }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', contactId] });
      setNoteText('');
      setAddingNote(false);
    },
  });

  const deleteNote = useMutation({
    mutationFn: (id: string) => fetch(`/api/notes?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact', contactId] }),
  });

  const addTag = useMutation({
    mutationFn: (tagId: string) =>
      fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_to_contact', contactId, tagId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact', contactId] }),
  });

  const removeTag = useMutation({
    mutationFn: (tagId: string) =>
      fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_from_contact', contactId, tagId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact', contactId] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const contact = contactData?.contact;
  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
        <p className="text-sm text-muted-foreground">Contact not yet synced</p>
        <p className="text-xs text-muted-foreground">Send a message to sync this contact</p>
      </div>
    );
  }

  const contactTagIds = new Set(contact.contactTags.map((ct) => ct.tag.id));
  const availableTags = (tagsData?.tags ?? []).filter((t) => !contactTagIds.has(t.id));
  const stages = pipelineData?.board ?? [];
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-0 p-4">
        {/* Contact header */}
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold"
            style={{ backgroundColor: contact.avatarColor }}
          >
            {fullName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{fullName || 'Unknown'}</h3>
            {contact.username && (
              <p className="text-xs text-muted-foreground">@{contact.username}</p>
            )}
          </div>
          {contact.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              {contact.phone}
            </div>
          )}
        </div>

        <Separator className="my-2" />

        {/* Pipeline stage */}
        <Section icon={<GitBranch className="w-3.5 h-3.5" />} title="Pipeline Stage">
          <Select
            value={contact.pipelineStageId ?? ''}
            onValueChange={(v) => updateStage.mutate(v || null)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="No stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No stage</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>

        <Separator className="my-2" />

        {/* Tags */}
        <Section icon={<Tag className="w-3.5 h-3.5" />} title="Tags">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {contact.contactTags.map(({ tag }) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
                <button onClick={() => removeTag.mutate(String(tag.id))}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
          {availableTags.length > 0 && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <Select onValueChange={(tagId: any) => addTag.mutate(String(tagId))}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Add tag..." />
              </SelectTrigger>
              <SelectContent>
                {availableTags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Section>

        <Separator className="my-2" />

        {/* Notes */}
        <Section
          icon={<StickyNote className="w-3.5 h-3.5" />}
          title="Notes"
          action={
            !addingNote && (
              <button
                onClick={() => setAddingNote(true)}
                className="text-primary hover:text-primary/80"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )
          }
        >
          {addingNote && (
            <div className="flex flex-col gap-2 mb-3">
              <Textarea
                placeholder="Write a note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                className="text-xs resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs flex-1"
                  disabled={!noteText.trim() || addNote.isPending}
                  onClick={() => addNote.mutate(noteText)}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => { setAddingNote(false); setNoteText(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {contact.notes.length === 0 && !addingNote && (
              <p className="text-xs text-muted-foreground">No notes yet</p>
            )}
            {contact.notes.map((note) => (
              <div
                key={note.id}
                className="group relative bg-muted/60 rounded-lg p-2.5 text-xs"
              >
                <p className="whitespace-pre-wrap break-words leading-relaxed">{note.body}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-muted-foreground text-[10px]">
                    {format(new Date(note.createdAt), 'MMM d, HH:mm')}
                  </span>
                  <button
                    onClick={() => deleteNote.mutate(note.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}

function Section({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {icon}
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
