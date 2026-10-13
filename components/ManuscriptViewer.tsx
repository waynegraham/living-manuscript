"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Viewer } from "openseadragon";
import type { Manuscript } from "@/lib/manuscript";

export default function ManuscriptViewer({ manuscript, focus, onResetView }: { manuscript: Manuscript; focus: { regionId: string | null; sequence: number }; onResetView: () => void }) {
  const [failed, setFailed] = useState(false);
  const [viewerStatus, setViewerStatus] = useState<"loading" | "ready" | "failed">("loading");
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const serviceUrl = manuscript.imageServiceUrl;
  const [useLocal, setUseLocal] = useState(false);
  const region = manuscript.regions.find(region => region.id === focus.regionId);

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let instance: Viewer | undefined;
    // OpenSeadragon accesses browser globals, so load it only after mounting.
    void import("openseadragon").then(({ default: OpenSeadragon }) => {
      if (cancelled || !container.current) return;
      instance = OpenSeadragon({
        element: container.current,
        tileSources: serviceUrl && !useLocal ? `${serviceUrl.replace(/\/$/, "")}/info.json` : { type: "image", url: manuscript.image.src },
        showNavigationControl: false,
        showNavigator: false,
        visibilityRatio: 1,
        constrainDuringPan: true,
        crossOriginPolicy: "Anonymous",
        timeout: 15000,
        animationTime: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.3,
        gestureSettingsMouse: { scrollToZoom: false },
      });
      viewer.current = instance;
      instance.addHandler("open", () => { if (!cancelled) setViewerStatus("ready"); });
      function failed() {
        if (cancelled) return;
        if (serviceUrl && !useLocal) { setUseLocal(true); setViewerStatus("loading"); }
        else setViewerStatus("failed");
      }
      instance.addHandler("open-failed", failed);
      instance.addHandler("tile-load-failed", failed);
    }).catch(() => { if (!cancelled) setViewerStatus("failed"); });
    return () => {
      cancelled = true;
      instance?.destroy();
      viewer.current = null;
    };
  }, [serviceUrl, useLocal, manuscript.image.src]);

  useEffect(() => {
    const instance = viewer.current;
    const item = instance?.world.getItemAt(0);
    if (viewerStatus !== "ready" || !instance || !item) return;
    if (!region) { instance.viewport.goHome(); return; }
    const size = item.getContentSize();
    const { x, y, width, height } = region.bounds;
    // Coordinates come only from the approved record, relative to the full image.
    instance.viewport.fitBounds(item.imageToViewportRectangle(x * size.x, y * size.y, width * size.x, height * size.y));
  }, [region, focus.sequence, viewerStatus]);

  function zoom(factor: number) {
    viewer.current?.viewport.zoomBy(factor);
    viewer.current?.viewport.applyConstraints();
  }

  return (
    <section aria-labelledby="manuscript-title" className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="eyebrow">01 / The object</span>
        <span className="text-xs text-muted">{serviceUrl ? "IIIF manuscript viewer" : "Manuscript study image"}</span>
      </div>
      <figure>
        <div className="viewer-stage relative flex h-[520px] items-center justify-center overflow-hidden sm:h-[680px]">
          <div ref={container} role="region" aria-label={`Zoomable image: ${manuscript.image.alt}`} className={`absolute inset-0 ${viewerStatus === "failed" ? "invisible" : ""}`} />
          {viewerStatus === "loading" && <p role="status" className="pointer-events-none absolute z-10 text-sm text-white">Loading manuscript…</p>}
          {viewerStatus === "failed" && (failed ? (
            <p role="status" className="max-w-xs p-6 text-center text-sm text-paper">This image could not be displayed. TIFF images may need conversion to PNG or JPEG for this browser. You can still ask questions about the supplied manuscript data.</p>
          ) : (
            <Image src={manuscript.image.src} alt={manuscript.image.alt} width={manuscript.image.width} height={manuscript.image.height} priority unoptimized onError={() => setFailed(true)} className="h-auto max-h-full w-full object-contain p-5 sm:p-9" />
          ))}
          <span aria-hidden="true" className="absolute bottom-5 left-6 text-[10px] tracking-[0.18em] text-paper/65">KAWLA / STUDY VIEW</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
          <p role="status" className="text-xs text-muted">{viewerStatus === "failed" ? "Zoom unavailable. Showing the study image." : region ? `Close look: ${region.label}` : useLocal ? "Local study image. Drag to explore or use the controls to zoom." : "Drag to explore. Pinch or use the controls to zoom."}</p>
          <div role="group" aria-label="Image viewer controls" className="flex gap-2">
            <button type="button" disabled={viewerStatus !== "ready"} onClick={() => zoom(1.5)} aria-label="Zoom in" className="min-h-10 min-w-10 border border-line px-3 text-lg disabled:opacity-40">+</button>
            <button type="button" disabled={viewerStatus !== "ready"} onClick={() => zoom(1 / 1.5)} aria-label="Zoom out" className="min-h-10 min-w-10 border border-line px-3 text-lg disabled:opacity-40">−</button>
            <button type="button" disabled={viewerStatus !== "ready"} onClick={onResetView} className="min-h-10 border border-line px-3 text-xs disabled:opacity-40">Reset view</button>
          </div>
        </div>
        <figcaption className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="manuscript-title" className="font-display text-2xl uppercase sm:text-3xl">{manuscript.title}</h2>
            <span className="eyebrow text-muted">Study view</span>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted">{manuscript.description}</p>
        </figcaption>
      </figure>
      <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
        {[ ["Date", manuscript.date ?? "Not established"], ["Origin", manuscript.placeOfProduction], ["Language", manuscript.language] ].map(([label, value]) => (
          <div key={label}><dt className="eyebrow text-muted">{label}</dt><dd className="mt-2 text-xs sm:text-sm">{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}
