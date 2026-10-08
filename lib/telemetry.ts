// Fixed stage labels and elapsed time only: never log visitor text or audio.
export async function timed<T>(stage: "chat" | "transcribe" | "speak", action: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try { return await action(); }
  finally { console.info(JSON.stringify({ stage, durationMs: Math.round(performance.now() - start) })); }
}
