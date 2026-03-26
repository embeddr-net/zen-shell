import { create } from "zustand";

export type ZenGlobalState = {
  selectedImage: any | null;
  selectImage: (image: any | null) => void;
};

export const useZenGlobalStore = create<ZenGlobalState>((set) => ({
  selectedImage: null,
  selectImage: (image) => set({ selectedImage: image }),
}));
