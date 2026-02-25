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

  // When visible becomes true (e.g. from mobile bottom nav toggle), ensure fresh iframe
  useEffect(() => {
    if (visible) {
      setIframeKey((k) => k + 1);
    }
  }, [visible]);

  // Escape key
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, handleClose]);

  return (
    <>
      {/* D-ID iframe – full viewport, unmounted when closed (works on both mobile & desktop) */}
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

      {/* Close button when AI is open – works on both mobile & desktop, sits ABOVE the iframe */}
      {visible && (
        <button
          onClick={handleClose}
          className="fixed z-[9999] top-4 right-4 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-full px-5 py-2.5 shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-2"
          aria-label="Chiudi AI Assistant"
        >
          <Bot className="w-5 h-5" />
          <span className="font-semibold text-sm">Chiudi AI</span>
        </button>
      )}

      {/* Desktop-only FAB to open AI (on mobile, the bottom nav has the AI toggle) */}
      {!isMobile && !visible && (
        <button
          onClick={handleOpen}
          className="fixed z-[9999] bottom-6 right-[210px] w-48 h-12 shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center rounded-full gap-2 bg-gradient-to-r from-emerald-400 to-teal-500 text-white hover:from-emerald-500 hover:to-teal-600"
          aria-label="Apri AI Assistant"
        >
          <Bot className="w-5 h-5" />
          <span className="font-semibold text-sm">AI Assistant</span>
        </button>
      )}
    </>
  );
}
