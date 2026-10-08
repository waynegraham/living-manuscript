export default function PushToTalk() {
  return (
    <div className="text-center">
      <button type="button" disabled aria-describedby="voice-status" className="flex min-h-14 w-full items-center justify-center gap-3 rounded-sm bg-olive px-5 py-4 text-sm text-paper opacity-65 disabled:cursor-not-allowed">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
        </svg>
        Hold to speak <span className="text-xs opacity-80">· Coming soon</span>
      </button>
      <p id="voice-status" className="mt-2 text-xs text-muted">Microphone access and voice playback are not enabled.</p>
    </div>
  );
}
