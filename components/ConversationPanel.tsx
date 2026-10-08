"use client";

import { useRef, useState } from "react";
import type { Manuscript } from "@/lib/manuscript";
import PushToTalk from "./PushToTalk";
import SpeakerIndicator from "./SpeakerIndicator";
import SuggestedQuestions from "./SuggestedQuestions";

export default function ConversationPanel({ manuscript }: { manuscript: Manuscript }) {
  const [question, setQuestion] = useState("");
  const [drafts, setDrafts] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setQuestion("");
    setDrafts([]);
    setStatus("Conversation reset. The demonstration introduction remains.");
  }

  return (
    <section aria-labelledby="conversation-title" className="min-w-0 border-t border-line pt-7 lg:border-t-0 lg:border-l lg:pl-9 lg:pt-0 xl:pl-12">
      <div className="mb-5 flex items-center justify-between gap-4">
        <span className="eyebrow">02 / The encounter</span>
        <button onClick={reset} type="button" className="min-h-10 px-2 text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink">Reset conversation</button>
      </div>
      <h2 id="conversation-title" className="font-display text-3xl">Begin with curiosity.</h2>
      <p className="mt-3 text-sm leading-6 text-muted">A manuscript offers an invitation. A scholarly guide helps you examine the evidence.</p>
      <div aria-label="Conversation transcript" role="log" aria-live="polite" aria-relevant="additions" className="mt-6 h-56 overflow-y-auto rounded-sm border border-line bg-white/35 p-5">
        <article>
          <div className="flex flex-wrap items-center gap-3"><SpeakerIndicator speaker="manuscript" /><span className="text-[10px] uppercase tracking-wider text-muted">Sample introduction</span></div>
          <p className="mt-3 font-display text-lg leading-7">{manuscript.demoIntroduction}</p>
        </article>
        {drafts.map((draft, index) => (
          <article key={index} className="mt-5 border-t border-line pt-4">
            <SpeakerIndicator speaker="visitor" />
            <p className="mt-2 break-words text-sm leading-6">{draft}</p>
            <p className="mt-2 text-xs text-muted">Preview only — no response is generated.</p>
          </article>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>Text preview · Voice coming soon</span>
        <div className="flex gap-3">
          <button type="button" disabled className="min-h-8 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Replay audio, unavailable in this demonstration">↺ Replay</button>
          <button type="button" disabled className="min-h-8 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Stop audio, unavailable in this demonstration">□ Stop</button>
        </div>
      </div>
      <div className="mt-5"><PushToTalk /></div>
      <form className="mt-4" onSubmit={(event) => {
        event.preventDefault();
        const trimmed = question.trim();
        if (!trimmed) return;
        setDrafts((previous) => [...previous, trimmed].slice(-10));
        setQuestion("");
        setStatus("Question added to the local preview. Responses are not connected yet.");
      }}>
        <label htmlFor="visitor-question" className="mb-2 block text-xs text-muted">Or type a question</label>
        <div className="flex overflow-hidden rounded-sm border border-line bg-white/40 focus-within:border-olive">
          <input ref={inputRef} id="visitor-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="What would you like to discover?" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm placeholder:text-muted/80" />
          <button type="submit" disabled={!question.trim()} aria-label="Add question to demonstration transcript" className="m-1 min-h-10 min-w-10 rounded-sm px-3 text-olive hover:bg-parchment disabled:cursor-not-allowed disabled:opacity-35">↑</button>
        </div>
        <p className="mt-2 text-xs text-muted">UI preview only. Questions stay in this tab until reset or reload.</p>
      </form>
      <p role="status" className="sr-only">{status}</p>
      <div className="mt-6"><SuggestedQuestions questions={manuscript.suggestedQuestions} onSelect={(selected) => {
        setQuestion(selected);
        setStatus("Suggested question selected. You can edit it before adding it to the preview.");
        inputRef.current?.focus();
      }} /></div>
    </section>
  );
}
