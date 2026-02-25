import { useEffect, useCallback, useState } from "react";
import { useAIAgentStore } from "@/hooks/useAIAgentStore";
import { Bot } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * D-ID AI Agent – iframe isolation approach.
 *
 * D-ID's module re-injects DOM nodes and cannot be killed reliably.
 * We load it inside an <iframe> we control.
 * Close = unmount the iframe → the entire D-ID runtime dies with it.
 *
 * We use a `key` counter to force React to create a brand-new iframe
 * each time the user opens the agent, so D-ID always boots fresh.
 */

const SRCDOC = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style>
</head><body>
<script type="module"
  src="https://agent.d-id.com/v2/index.js"
  data-name="did-agent"
  data-mode="fabio"
  data-client-key="Z29vZ2xlLW9hdXRoMnwxMTE1NDg1MzcyMzUzMTMxNTk4MjQ6WTlxMnI4WFpjU25XTEJtWHN5U3JL"
  data-agent-id="v2_agt_HNFyNkLh"
  data-monitor="true"
  data-orientation="horizontal"
  data-position="right"><\/script>
</body></html>`;

export default function DIdAgent() {
  const { visible, toggle, hide } = useAIAgentStore();
  const isMobile = useIsMobile();
  const [iframeKey, setIframeKey] = useState(0);

  const handleOpen = useCallback(() => {
    setIframeKey((k) => k + 1); // force fresh iframe
    toggle();
  }, [toggle]);

  const handleClose = useCallback(() => {
    hide();
  }, [hide]);

  // Escape key
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, handleClose]);

  if (isMobile) return null; // Mobile toggle is in MobileLayout bottom nav

  return (
    <>
      {/* D-ID iframe – full viewport, unmounted when closed */}
      {visible && (
        <iframe
          key={iframeKey}
          srcDoc={SRCDOC}
          title="AI Assistant"
          allow="camera;microphone"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          className="fixed inset-0 w-full h-full z-[9998] border-none"
          style={{ background: "transparent" }}
        />
      )}

      {/* Toggle / Close button – sits ABOVE the iframe */}
      <button
        onClick={visible ? handleClose : handleOpen}
        className={`fixed z-[9999] bottom-6 right-[210px] w-48 h-12 shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center rounded-full gap-2 ${
          visible
            ? "bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700"
            : "bg-gradient-to-r from-emerald-400 to-teal-500 text-white hover:from-emerald-500 hover:to-teal-600"
        }`}
        aria-label={visible ? "Chiudi AI Assistant" : "Apri AI Assistant"}
      >
        <Bot className="w-5 h-5" />
        <span className="font-semibold text-sm">
          {visible ? "Chiudi AI" : "AI Assistant"}
        </span>
      </button>
    </>
  );
}
