"use client";

import Image from "next/image";
import { useState } from "react";
import type { Manuscript } from "@/lib/manuscript";

export default function ManuscriptViewer({ manuscript }: { manuscript: Manuscript }) {
  const [failed, setFailed] = useState(false);

  return (
    <section aria-labelledby="manuscript-title" className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="eyebrow">01 / The object</span>
        <span className="text-xs text-muted">Demonstration illustration</span>
      </div>
      <figure>
        <div className="viewer-stage relative flex min-h-72 items-center justify-center overflow-hidden rounded-sm border border-white/10 p-4 sm:min-h-110 sm:p-7 lg:min-h-130">
          {failed ? (
            <p role="status" className="max-w-xs p-6 text-center text-sm text-paper">The demonstration image could not be loaded. No historical manuscript has been selected yet.</p>
          ) : (
            <Image src={manuscript.image.src} alt={manuscript.image.alt} width={manuscript.image.width} height={manuscript.image.height} priority unoptimized onError={() => setFailed(true)} className="h-auto w-full drop-shadow-2xl" />
          )}
          <span aria-hidden="true" className="absolute bottom-5 left-6 text-[10px] tracking-[0.18em] text-paper/65">ILLUSTRATION / DEMO–001</span>
        </div>
        <figcaption className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="manuscript-title" className="font-display text-2xl sm:text-3xl">{manuscript.title}</h2>
            <span className="eyebrow text-muted">Study view</span>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted">{manuscript.description}</p>
        </figcaption>
      </figure>
      <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
        {[ ["Date", manuscript.date], ["Origin", manuscript.placeOfProduction], ["Language", manuscript.language] ].map(([label, value]) => (
          <div key={label}><dt className="eyebrow text-muted">{label}</dt><dd className="mt-2 text-xs sm:text-sm">{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}
