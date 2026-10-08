export type Speaker = "manuscript" | "guide" | "visitor";

const labels: Record<Speaker, string> = {
  manuscript: "The Manuscript",
  guide: "Scholarly Guide",
  visitor: "You",
};

export default function SpeakerIndicator({ speaker }: { speaker: Speaker }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium tracking-wide">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${speaker === "manuscript" ? "bg-terracotta" : "bg-olive"}`} />
      {labels[speaker]}
    </span>
  );
}
