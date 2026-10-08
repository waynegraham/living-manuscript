"use client";
import { useEffect, useRef, useState } from "react";

export default function PushToTalk({ disabled, onAudio, onError, onStart }: {
  disabled: boolean;
  onAudio: (audio: Blob, duration: number) => void;
  onError: (message: string) => void;
  onStart: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "starting" | "recording">("idle");
  const session = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useRef(false);
  const wanted = useRef(false);

  function stop(cancelled = false) {
    wanted.current = false;
    cancel.current = cancelled;
    session.current++;
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    setPhase("idle");
  }
  useEffect(() => {
    const sessionRef = session;
    return () => {
      wanted.current = false; sessionRef.current++; cancel.current = true;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current) { recorder.current.onstop = null; recorder.current.ondataavailable = null; recorder.current.onerror = null; }
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  async function start() {
    if (disabled || wanted.current || recorder.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { onError("Recording is unavailable in this browser. Please type your question."); return; }
    wanted.current = true; cancel.current = false;
    const id = ++session.current;
    setPhase("starting"); onStart();
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (id !== session.current || !wanted.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = recording;
      const chunks: BlobPart[] = []; const started = performance.now(); let bytes = 0;
      recording.ondataavailable = event => {
        chunks.push(event.data); bytes += event.data.size;
        if (bytes > 5 * 1024 * 1024) { stop(true); onError("Recording exceeded 5 MB. Please use a shorter question."); }
      };
      recording.onerror = () => { stop(true); onError("Recording failed. Please try again or type your question."); };
      recording.onstop = () => {
        if (!cancel.current) onAudio(new Blob(chunks, { type: recording.mimeType }), Math.min((performance.now() - started) / 1000, 30));
        recorder.current = null;
      };
      recording.start(250); setPhase("recording");
      timer.current = setTimeout(() => stop(), 30000);
    } catch {
      if (id !== session.current) return;
      stop(true); onError("Microphone access failed. Allow microphone permission or type your question.");
    }
  }
  return (
    <div className="text-center">
      <button type="button" disabled={disabled} aria-describedby="voice-status" aria-label="Hold to record a question" className="flex min-h-14 w-full touch-none select-none items-center justify-center rounded-sm bg-olive px-5 py-4 text-sm text-paper disabled:opacity-50"
        onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); void start(); }}
        onPointerUp={() => stop()} onPointerCancel={() => stop(true)} onLostPointerCapture={() => { if (wanted.current) stop(true); }}
        onKeyDown={event => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); void start(); } if (event.key === "Escape") stop(true); }}
        onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); stop(); } }} onBlur={() => { if (wanted.current) stop(true); }}>
        {phase === "recording" ? "● Recording — release to send" : phase === "starting" ? "Waiting for microphone…" : "Hold to speak"}
      </button>
      <div className="mt-2 flex justify-center gap-4 text-xs text-muted">
        <button type="button" disabled={disabled} onClick={() => phase === "idle" ? void start() : stop()}>{phase === "idle" ? "Start recording" : "Stop and send"}</button>
        {phase !== "idle" && <button type="button" onClick={() => stop(true)}>Cancel</button>}
      </div>
      <p id="voice-status" role="status" className="mt-2 text-xs text-muted">{phase === "recording" ? "Recording microphone · Maximum 30 seconds" : "Hold Space or Enter, or use Start recording. Escape cancels."}</p>
    </div>
  );
}
