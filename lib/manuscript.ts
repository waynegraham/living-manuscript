import data from "@/data/manuscript.json";
// Normalize optional display fields and approved navigation regions.
if (!data.id || !data.title || !Array.isArray(data.facts) || !Array.isArray(data.uncertainties) || !Array.isArray(data.suggestedQuestions)) throw new Error("Invalid manuscript knowledge data.");
export const manuscript = {
  ...data,
  regions: data.regions ?? [],
  placeOfProduction: data.place ?? "Not established",
  demoIntroduction: "Ask about these pages, or invite the scholarly guide to explain the available evidence. My first-person voice is an interpretive device.",
  image: { src: data.imageUrl === "/manuscripts/00003-747-AB009300.tif" ? "/manuscripts/00003-747-AB009300.jpg" : data.imageUrl, alt: `Page of ${data.title}`, width: 2262, height: 3656 },
};
export const evidenceIds = data.facts.map(fact => fact.id);
if (new Set(evidenceIds).size !== evidenceIds.length || data.facts.some(fact => !fact.id || !fact.statement || !fact.source)) throw new Error("Invalid manuscript evidence.");
export const regionIds = manuscript.regions.map(region => region.id);
if (new Set(regionIds).size !== regionIds.length || manuscript.regions.some(region => {
  const { x, y, width, height } = region.bounds;
  return !region.id || !region.label || ![x, y, width, height].every(Number.isFinite)
    || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1;
})) throw new Error("Invalid manuscript regions.");
export type Manuscript = typeof manuscript;
