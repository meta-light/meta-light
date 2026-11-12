import { create } from 'zustand';

interface CrmState {
  selectedContactId: string | null;
  contactPanelOpen: boolean;
  setSelectedContact: (id: string | null) => void;
  setContactPanelOpen: (open: boolean) => void;
}

export const useCrmStore = create<CrmState>((set) => ({
  selectedContactId: null,
  contactPanelOpen: false,
  setSelectedContact: (id) => set({ selectedContactId: id, contactPanelOpen: !!id }),
  setContactPanelOpen: (open) => set({ contactPanelOpen: open }),
}));
