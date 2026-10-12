import ManuscriptViewer from "@/components/ManuscriptViewer";
import ConversationPanel from "@/components/ConversationPanel";
import { manuscript } from "@/lib/manuscript";

export default function Home() {
  return (
    <div>
      <a href="#experience" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:z-10 focus:bg-paper focus:p-3">Skip to the experience</a>
      <header className="bg-blue text-white">
        <div className="mx-auto flex min-h-20 max-w-360 items-center justify-between gap-6 px-5 sm:px-10 lg:px-16">
          <a href="#" aria-label="AlMadar Digital home" className="text-xl font-bold uppercase tracking-[0.15em] sm:text-2xl">AlMadar <span className="font-normal tracking-normal">Digital</span></a>
          <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm sm:gap-8 sm:text-base">
            <a href="#experience" className="underline-offset-4 hover:underline">The encounter</a>
            <a href="#about" className="hidden underline-offset-4 hover:underline sm:block">About</a>
            <span className="hidden border-l border-white/40 pl-8 text-xs sm:block">Demonstration</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-360 px-5 sm:px-10 lg:px-16">
        <div className="pb-8 pt-10 sm:pb-10 sm:pt-14">
          <p className="eyebrow mb-4 text-muted">AlMadar / Objects / Living Manuscript</p>
          <h1 className="font-display text-4xl leading-[1.08] tracking-tight uppercase sm:text-6xl lg:text-[64px]">A Living Manuscript</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">Pause at the page. Ask a question. Explore how a conversation might open new ways of seeing a manuscript.</p>
        </div>
        <div id="experience" className="grid scroll-mt-5 grid-cols-1 gap-10 pb-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-9 xl:gap-12">
          <ManuscriptViewer manuscript={manuscript} />
          <ConversationPanel manuscript={manuscript} />
        </div>
        <aside id="about" aria-label="About this demonstration" className="mb-10 flex scroll-mt-6 flex-col gap-3 border-y border-line py-6 sm:flex-row sm:gap-8">
          <span className="eyebrow shrink-0 text-terracotta">A note on this encounter</span>
          <p className="max-w-3xl text-xs leading-6 text-muted">This is an experimental encounter using the supplied manuscript record. The manuscript’s first-person voice is an interpretive device, and spoken voices are AI-generated. Answers use the available record and acknowledge gaps in the evidence.</p>
        </aside>
      </main>
      <footer className="bg-blue text-white"><div className="mx-auto flex max-w-360 flex-wrap justify-between gap-3 px-5 py-8 text-xs sm:px-10 lg:px-16"><span>KAWLA · Living Manuscript</span><span>The visitor drives the discovery.</span></div></footer>
    </div>
  );
}
