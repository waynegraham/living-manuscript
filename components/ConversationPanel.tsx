"use client";

import { useEffect, useRef, useState } from "react";
import type { Manuscript } from "@/lib/manuscript";
import type { ChatResponse, ResponseLanguage, Turn } from "@/lib/schemas";
import PushToTalk from "./PushToTalk";
import SpeakerIndicator from "./SpeakerIndicator";
import SuggestedQuestions from "./SuggestedQuestions";

type Health = Record<"llm" | "stt" | "tts" | "ttsAr", { provider: string; available: boolean; message: string }>;
async function checked(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "The service could not complete this request.");
  }
  return response;
}
export default function ConversationPanel({ manuscript }: { manuscript: Manuscript }) {
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState<ResponseLanguage>("en");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState("");
  const [playing, setPlaying] = useState<ChatResponse["speaker"] | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [retryAudio, setRetryAudio] = useState<{ blob: Blob; duration: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const session = useRef(0);
  const playback = useRef(0);
  const request = useRef<AbortController | null>(null);
  const speechRequest = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  async function checkHealth() {
    try {
      const response = await checked(await fetch("/api/health"));
      setHealth(await response.json()); setHealthError("");
    } catch { setHealthError("Health check failed. Check server configuration and try again."); }
  }
  useEffect(() => {
    const sessionRef = session; const playbackRef = playback;
    const timer = setTimeout(() => { void checkHealth(); }, 0);
    return () => {
    clearTimeout(timer); sessionRef.current++; playbackRef.current++;
    request.current?.abort(); speechRequest.current?.abort(); audio.current?.pause();
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
  }; }, []);

  function stopAudio(clear = false) {
    playback.current++; speechRequest.current?.abort();
    audio.current?.pause(); setPlaying(null);
    if (clear) {
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = null; audio.current = null; setAudioReady(false);
    }
  }
  function reset() {
    session.current++; request.current?.abort(); stopAudio(true); inFlight.current = false;
    setQuestion(""); setTurns([]); setBusy(false); setRetryAudio(null); setResetKey(k => k + 1);
    setStatus("Conversation reset.");
  }
  async function play(answer: ChatResponse, generate: boolean, answerLanguage: ResponseLanguage = language) {
    stopAudio(generate);
    const id = playback.current;
    try {
      if (generate || !audio.current) {
        const controller = new AbortController(); speechRequest.current = controller;
        const response = await checked(await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: answer.text, speaker: answer.speaker, language: answerLanguage }), signal: controller.signal }));
        const blob = await response.blob();
        if (id !== playback.current) return;
        audioUrl.current = URL.createObjectURL(blob);
        audio.current = new Audio(audioUrl.current); setAudioReady(true);
        audio.current.onended = () => setPlaying(null);
        audio.current.onerror = () => { setPlaying(null); setStatus("Audio could not be played. The text response remains available."); };
      }
      if (id !== playback.current || !audio.current) return;
      audio.current.currentTime = 0;
      await audio.current.play();
      if (id === playback.current) setPlaying(answer.speaker);
    } catch (error) {
      if (id !== playback.current) return;
      setStatus(`${error instanceof Error ? error.message : "Speech playback failed."} The text response remains available. Use Replay to retry playback.`);
    }
  }
  async function send(message: string, id: number, signal: AbortSignal) {
    stopAudio(true);
    const response = await checked(await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history: turns.slice(-18), language }), signal }));
    const answer: ChatResponse = await response.json();
    if (id !== session.current) return;
    setTurns(previous => [...previous, { role: "user", text: message, language } as Turn, { role: "assistant", response: answer, language } as Turn].slice(-20));
    setQuestion(""); setStatus("Response received.");
    const speech = language === "ar" ? health?.ttsAr : health?.tts;
    if (speech?.provider !== "disabled") void play(answer, true, language);
  }
  async function interact(message?: string, recording?: { blob: Blob; duration: number }) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); stopAudio(true); setResetKey(k => k + 1);
    const id = session.current; const controller = new AbortController(); request.current = controller;
    try {
      if (recording) {
        setRetryAudio(recording); setStatus("Transcribing your question…");
        const form = new FormData();
        const extension = recording.blob.type.includes("mp4") ? "mp4" : recording.blob.type.includes("ogg") ? "ogg" : "webm";
        form.set("file", recording.blob, `question.${extension}`); form.set("duration", String(recording.duration)); form.set("language", language);
        const response = await checked(await fetch("/api/transcribe", { method: "POST", body: form, signal: controller.signal }));
        const result = await response.json(); message = result.text;
        if (id !== session.current) return;
        setQuestion(message || ""); setRetryAudio(null);
      }
      if (!message?.trim()) return;
      setStatus("Considering your question…");
      await send(message.trim(), id, controller.signal);
    } catch (error) {
      if (id !== session.current) return;
      setStatus(`${error instanceof Error ? error.message : "Request failed."} You can type or retry your question.`);
    } finally {
      if (id === session.current) { inFlight.current = false; setBusy(false); }
    }
  }
  function changeLanguage(next: ResponseLanguage) {
    stopAudio(true); setRetryAudio(null); setResetKey(k => k + 1);
    setLanguage(next);
    setStatus(next === "ar" ? "Future responses will be in Arabic. Conversation history is preserved." : "Future responses will be in English. Conversation history is preserved.");
  }
  const last = [...turns].reverse().find(turn => turn.role === "assistant");
  const lastSpeech = last?.language === "ar" ? health?.ttsAr : health?.tts;
  return (
    <section aria-labelledby="conversation-title" className="min-w-0 border-t border-line pt-7 lg:border-t-0 lg:border-l lg:pl-9 lg:pt-0 xl:pl-12">
      <div className="mb-5 flex items-center justify-between gap-4">
        <span className="eyebrow">02 / The encounter</span>
        <button onClick={reset} type="button" className="min-h-10 px-2 text-xs text-muted underline underline-offset-4">Reset conversation</button>
      </div>
      <h2 id="conversation-title" className="font-display text-3xl">Begin with curiosity.</h2>
      <p className="mt-3 text-sm leading-6 text-muted">A manuscript offers an invitation. A scholarly guide helps you examine the evidence.</p>
      <div className="mt-4">
        <label htmlFor="response-language" className="mr-3 text-xs text-muted">Response language / <span lang="ar">لغة الرد</span></label>
        <select id="response-language" value={language} disabled={busy} onChange={event => {
          const next = event.target.value;
          if (next === "en" || next === "ar") changeLanguage(next);
        }} className="min-h-10 rounded-sm border border-line bg-white/40 px-3 text-sm disabled:opacity-50">
          <option value="en">English</option>
          <option value="ar" lang="ar">العربية</option>
        </select>
        <p className="mt-2 text-xs text-muted">Applies to new responses and speech recognition. Earlier messages stay in their original language.</p>
        {language === "ar" && health?.ttsAr?.provider === "nabra" && <p lang="ar" dir="rtl" className="mt-2 text-xs leading-6 text-muted">يستخدم المخطوط والدليل العلمي صوتًا سعوديًا واحدًا من Nabra.</p>}
      </div>
      <div aria-label="Conversation transcript" role="log" aria-live="polite" aria-relevant="additions" className="mt-6 h-64 overflow-y-auto rounded-sm border border-line bg-white/35 p-5">
        <article><SpeakerIndicator speaker="manuscript" /><p lang={language} dir={language === "ar" ? "rtl" : "ltr"} className="mt-3 font-display text-lg leading-7">{language === "ar" ? "اسأل عن هذه الصفحات، أو اطلب من الدليل العلمي شرح الأدلة المتاحة. حديث المخطوط بضمير المتكلم أسلوب تفسيري." : manuscript.demoIntroduction}</p></article>
        {turns.map((turn, index) => (
          <article key={index} className="mt-5 border-t border-line pt-4">
            <SpeakerIndicator speaker={turn.role === "user" ? "visitor" : turn.response.speaker} />
            <p lang={turn.role === "assistant" ? turn.language ?? "en" : undefined} dir={turn.role === "assistant" ? (turn.language === "ar" ? "rtl" : "ltr") : "auto"} className="mt-2 break-words text-sm leading-6">{turn.role === "user" ? turn.text : turn.response.text}</p>
            {turn.role === "assistant" && <p className="mt-2 text-xs text-muted">{turn.response.certainty}{turn.response.evidenceIds.length > 0 && ` · Evidence: ${turn.response.evidenceIds.join(", ")}`}</p>}
          </article>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{playing ? <><SpeakerIndicator speaker={playing} /> · Speaking</> : "AI-generated voices"}</span>
        <div className="flex gap-3">
          <button type="button" title="Replay the last response in its original language" disabled={!last || busy || lastSpeech?.provider === "disabled"} onClick={() => { if (last?.role === "assistant") void play(last.response, !audioReady, last.language ?? "en"); }} className="min-h-8 disabled:opacity-50">↺ Replay</button>
          <button type="button" onClick={() => stopAudio()} className="min-h-8">□ Stop audio</button>
        </div>
      </div>
      <div className="mt-5"><PushToTalk key={resetKey} disabled={busy || health?.stt.provider === "disabled"} onStart={() => stopAudio()} onError={setStatus} onAudio={(blob, duration) => { void interact(undefined, { blob, duration }); }} /></div>
      {retryAudio && <button type="button" disabled={busy} className="mt-2 text-xs underline" onClick={() => { void interact(undefined, retryAudio); }}>Retry transcription</button>}
      <form className="mt-4" onSubmit={event => { event.preventDefault(); if (question.trim()) void interact(question); }}>
        <label htmlFor="visitor-question" className="mb-2 block text-xs text-muted">Or type a question</label>
        <div className="flex overflow-hidden rounded-sm border border-line bg-white/40 focus-within:border-olive">
          <input ref={inputRef} id="visitor-question" dir="auto" value={question} onChange={event => setQuestion(event.target.value)} maxLength={500} placeholder="What would you like to discover?" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm" />
          <button type="submit" disabled={!question.trim() || busy} aria-label="Send question" className="m-1 min-h-10 min-w-10 rounded-sm px-3 text-olive disabled:opacity-35">↑</button>
        </div>
        <p className="mt-2 text-xs text-muted">Conversation stays in this tab until reset or reload. Audio is processed without being saved.</p>
      </form>
      <p role="status" className="mt-3 text-xs leading-5 text-terracotta">{status}</p>
      <details className="mt-4 text-xs text-muted"><summary>Model service status</summary>
        {health && Object.entries(health).map(([kind, service]) => <p key={kind} className="mt-2">{kind === "ttsAr" ? "Arabic speech" : kind.toUpperCase()} ({service.provider}): {service.available ? "Available" : "Unavailable"}. {service.message}</p>)}
        <p>{healthError}</p><button type="button" onClick={() => { void checkHealth(); }} className="mt-2 min-h-8 underline">Refresh status</button>
      </details>
      <div className="mt-6"><SuggestedQuestions questions={manuscript.suggestedQuestions} onSelect={selected => { setQuestion(selected); inputRef.current?.focus(); }} /></div>
    </section>
  );
}
