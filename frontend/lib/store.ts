import { create } from 'zustand';

interface TwinState {
  household: any;
  activeMember: any;
  orbState: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
  lastResponse: any;
  transcript: string;
  setHousehold: (household: any) => void;
  setActiveMember: (member: any) => void;
  setOrbState: (state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error') => void;
  setLastResponse: (response: any) => void;
  setTranscript: (transcript: string) => void;
}

export const useTwinStore = create<TwinState>((set) => ({
  household: null,
  activeMember: null,
  orbState: 'idle',
  lastResponse: null,
  transcript: '',
  setHousehold: (household) => set({ household }),
  setActiveMember: (activeMember) => set({ activeMember }),
  setOrbState: (orbState) => set({ orbState }),
  setLastResponse: (lastResponse) => set({ lastResponse }),
  setTranscript: (transcript) => set({ transcript }),
}));
