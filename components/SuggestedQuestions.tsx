"use client";

export default function SuggestedQuestions({ questions, onSelect }: { questions: string[]; onSelect: (question: string) => void }) {
  return (
    <div>
      <h3 className="eyebrow mb-3">A place to begin</h3>
      <div className="flex flex-col gap-2">
        {questions.map((question) => (
          <button key={question} type="button" onClick={() => onSelect(question)} className="group flex min-h-11 items-center justify-between gap-3 rounded-sm border border-line px-4 py-3 text-left text-sm transition-colors hover:border-olive/50 hover:bg-parchment">
            {question}<span aria-hidden="true" className="text-muted transition-transform group-hover:translate-x-1">↗</span>
          </button>
        ))}
      </div>
    </div>
  );
}
