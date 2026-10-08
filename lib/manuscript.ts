import data from "@/data/manuscript.json";

// The local JSON is the sole source of object content for this interface.
export const manuscript = data;
export type Manuscript = typeof manuscript;
