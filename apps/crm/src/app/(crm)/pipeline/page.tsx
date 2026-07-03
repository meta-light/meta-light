'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ContactInPipeline {
  id: string;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  avatarColor: string;
  contactTags: { tag: { id: string; name: string; color: string } }[];
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  contacts: ContactInPipeline[];
}

export default function PipelinePage() {
  const qc = useQueryClient();
  const [activeContact, setActiveContact] = useState<ContactInPipeline | null>(null);

  const { data, isLoading } = useQuery<{ board: PipelineStage[] }>({
    queryKey: ['pipeline'],
    queryFn: () => fetch('/api/pipeline').then((r) => r.json()),
    refetchOnWindowFocus: false,
  });

  const moveContact = useMutation({
    mutationFn: ({ contactId, stageId }: { contactId: string; stageId: string | null }) =>
      fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', contactId, stageId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline'] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragStart(event: DragStartEvent) {
    const contact = data?.board.flatMap((s) => s.contacts).find((c) => c.id === event.active.id);
    setActiveContact(contact ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveContact(null);
    if (!over) return;

    const contactId = active.id as string;
    const stageId = over.id as string;

    const currentStage = data?.board.find((s) => s.contacts.some((c) => c.id === contactId));
    if (currentStage?.id === stageId) return;

    moveContact.mutate({ contactId, stageId });

    qc.setQueryData<{ board: PipelineStage[] }>(['pipeline'], (old) => {
      if (!old) return old;
      const movingContact = old.board
        .flatMap((s) => s.contacts)
        .find((c) => c.id === contactId);
      return {
        board: old.board.map((stage) => ({
          ...stage,
          contacts:
            stage.id === stageId
              ? [...stage.contacts.filter((c) => c.id !== contactId), ...(movingContact ? [movingContact] : [])]
              : stage.contacts.filter((c) => c.id !== contactId),
        })),
      };
    });
  }

  const board = data?.board ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Drag contacts between stages to track deals</p>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {isLoading ? (
          <div className="flex gap-4 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-60 shrink-0">
                <div className="h-6 w-24 bg-muted animate-pulse rounded mb-3" />
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="h-16 bg-muted animate-pulse rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 p-6 h-full items-start min-h-0">
              {board.map((stage) => (
                <KanbanColumn key={stage.id} stage={stage} />
              ))}
            </div>
            <DragOverlay>
              {activeContact && <ContactCard contact={activeContact} isDragging />}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ stage }: { stage: PipelineStage }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="w-60 shrink-0 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="text-sm font-medium">{stage.name}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {stage.contacts.length}
        </span>
      </div>

      <SortableContext
        id={stage.id}
        items={stage.contacts.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn('min-h-24 rounded-xl transition-colors flex flex-col gap-2', isOver && 'bg-accent/50')}
        >
          {stage.contacts.length === 0 ? (
            <div className="h-20 border-2 border-dashed border-border rounded-xl flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Drop here</p>
            </div>
          ) : (
            stage.contacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function ContactCard({
  contact,
  isDragging,
}: {
  contact: ContactInPipeline;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortDragging } =
    useSortable({ id: contact.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortDragging ? 0.4 : 1,
  };

  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'bg-card border border-border rounded-xl p-3 cursor-grab active:cursor-grabbing shadow-sm',
        isDragging && 'shadow-lg rotate-2'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
          style={{ backgroundColor: contact.avatarColor }}
        >
          {fullName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{fullName || 'Unknown'}</p>
          {contact.username && (
            <p className="text-[10px] text-muted-foreground">@{contact.username}</p>
          )}
        </div>
        <Link
          href={`/inbox/user-${contact.id.replace('tg-', '')}`}
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </Link>
      </div>
      {contact.contactTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {contact.contactTags.slice(0, 2).map(({ tag }) => (
            <span
              key={tag.id}
              className="px-1.5 py-0.5 rounded-full text-[9px] text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {contact.contactTags.length > 2 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-muted text-muted-foreground">
              +{contact.contactTags.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
