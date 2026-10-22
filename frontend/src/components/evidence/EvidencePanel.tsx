import type { ReactNode } from "react";
import type { Turn } from "../../state/chat";
import { useDocuments } from "../../state/documents";
import { IconLayers, IconQuote } from "../icons";
import { Tabs, tabPanelProps } from "../ui/Tabs";
import { RetrievedList } from "./RetrievedList";
import { SourceView } from "./SourceView";
import type { SourceTarget } from "./types";

export type EvidenceTab = "passages" | "source";

interface Props {
  turn: Turn | null;
  tab: EvidenceTab;
  onTab: (t: EvidenceTab) => void;
  target: SourceTarget | null;
  onOpen: (t: SourceTarget) => void;
  onPage: (page: number) => void;
  /** Visual slot above the tabs (the live constellation). */
  header?: ReactNode;
}

/** Right-hand panel: what Verity read (ranked passages) and the cited source page. */
export function EvidencePanel({ turn, tab, onTab, target, onOpen, onPage, header }: Props) {
  const { docs } = useDocuments();
  const chunks = turn?.retrieved ?? null;
  const citations = turn?.answer?.citations ?? [];
  const baseId = "evidence";

  return (
    <div className="evidence">
      {header}
      <Tabs
        baseId={baseId}
        label="Evidence"
        value={tab}
        onChange={onTab}
        tabs={[
          {
            id: "passages",
            label: (
              <>
                <IconLayers size={15} /> Passages
                {chunks && <span className="tab-count">{chunks.length}</span>}
              </>
            ),
          },
          {
            id: "source",
            label: (
              <>
                <IconQuote size={15} /> Source
                {target && <span className="tab-count">p. {target.page}</span>}
              </>
            ),
          },
        ]}
      />
      <div className="evidence-body">
        {tab === "passages" ? (
          <div {...tabPanelProps(baseId, "passages")} className="evidence-tabpanel">
            <RetrievedList
              chunks={chunks}
              citations={citations}
              loading={turn?.status === "retrieving"}
              onOpen={onOpen}
              docTitle={(id) => docs.find((d) => d.id === id)?.title}
            />
          </div>
        ) : (
          <div {...tabPanelProps(baseId, "source")} className="evidence-tabpanel">
            <SourceView target={target} onPage={onPage} />
          </div>
        )}
      </div>
    </div>
  );
}
