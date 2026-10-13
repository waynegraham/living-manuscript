"use client";

import { useState } from "react";
import type { Manuscript } from "@/lib/manuscript";
import type { ViewerAction } from "@/lib/schemas";
import ManuscriptViewer from "./ManuscriptViewer";
import ConversationPanel from "./ConversationPanel";

export default function ManuscriptExperience({ manuscript }: { manuscript: Manuscript }) {
  const [focus, setFocus] = useState({ regionId: null as string | null, sequence: 0 });
  function view(action: ViewerAction | null) {
    if (action && !manuscript.regions.some(region => region.id === action.regionId)) return;
    setFocus(previous => ({ regionId: action?.regionId ?? null, sequence: previous.sequence + 1 }));
  }
  return <div id="experience" className="grid scroll-mt-5 grid-cols-1 gap-10 pb-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-9 xl:gap-12">
    <ManuscriptViewer manuscript={manuscript} focus={focus} onResetView={() => view(null)} />
    <ConversationPanel manuscript={manuscript} onViewerAction={view} onResetView={() => view(null)} />
  </div>;
}
