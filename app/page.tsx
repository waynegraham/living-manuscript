import ManuscriptViewer from "@/components/ManuscriptViewer";
import ConversationPanel from "@/components/ConversationPanel";
import { manuscript } from "@/lib/manuscript";

export default function Home() {
  return (
    <div className="mx-auto max-w-360 px-5 sm:px-10 lg:px-16">
      <a href="#experience" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:z-10 focus:bg-paper focus:p-3">Skip to the experience</a>
      <header className="flex items-center justify-between gap-4 border-b border-line py-6 sm:py-8">
        <div className="flex items-center gap-4"><span className="text-xl font-medium tracking-[0.25em]">KAWLA</span><span aria-hidden="true" className="h-5 w-px bg-line" /><span className="hidden text-xs tracking-wide text-muted sm:block">An experiment in close looking</span></div>
        <span className="rounded-full border border-line px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-muted">Demonstration</span>
      </header>
      <main>
        <div className="pb-9 pt-10 sm:pb-12 sm:pt-14">
          <p className="eyebrow mb-4 text-terracotta">Objects, voices & discovery</p>
          <h1 className="font-display text-5xl leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">Living Manuscript</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">Pause at the page. Ask a question. Explore how a conversation might open new ways of seeing a manuscript.</p>
        </div>
        <div id="experience" className="grid scroll-mt-5 grid-cols-1 gap-10 pb-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-9 xl:gap-12">
          <ManuscriptViewer manuscript={manuscript} />
          <ConversationPanel manuscript={manuscript} />
        </div>
        <aside aria-label="About this demonstration" className="mb-10 flex flex-col gap-3 border-y border-line py-5 sm:flex-row sm:gap-8">
          <span className="eyebrow shrink-0 text-terracotta">A note on this encounter</span>
          <p className="max-w-3xl text-xs leading-6 text-muted">The image and introduction are demonstration content. No historical KAWLA manuscript is represented. The manuscript’s first-person voice is an interpretive device; future voices will be AI-generated. Historical claims will be grounded in documented evidence.</p>
        </aside>
      </main>
      <footer className="flex flex-wrap justify-between gap-3 pb-7 text-[10px] uppercase tracking-[0.15em] text-muted"><span>KAWLA · Living Manuscript</span><span>The visitor drives the discovery.</span></footer>
    </div>
  );
}
