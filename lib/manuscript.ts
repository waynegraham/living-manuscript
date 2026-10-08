import data from "@/data/manuscript.json";
// Keep the supplied source data unchanged; normalize optional display fields only.
if (!data.id || !data.title || !Array.isArray(data.facts) || !Array.isArray(data.uncertainties) || !Array.isArray(data.suggestedQuestions)) throw new Error("Invalid manuscript knowledge data.");
export const manuscript = {
  ...data,
  placeOfProduction: data.place ?? "Not established",
  demoIntroduction: "Ask about these pages, or invite the scholarly guide to explain the available evidence. My first-person voice is an interpretive device.",
  image: { src: data.imageUrl === "/manuscripts/00003-747-AB009300.tif" ? "/manuscripts/00003-747-AB009300.jpg" : data.imageUrl, alt: `Page of ${data.title}`, width: 2262, height: 3656 },
};
export const evidenceIds = data.facts.map(fact => fact.id);
if (new Set(evidenceIds).size !== evidenceIds.length || data.facts.some(fact => !fact.id || !fact.statement || !fact.source)) throw new Error("Invalid manuscript evidence.");
export type Manuscript = typeof manuscript;
