import { useEffect, useCallback, useRef } from "react";
import { useAIAgentStore } from "@/hooks/useAIAgentStore";
import { Bot } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * D-ID AI Agent controller.
 *
 * DEFINITIVE APPROACH: D-ID's script, once loaded as an ES module, keeps
 * re-injecting DOM nodes and cannot be reliably killed by removing elements.
 * The only bulletproof solution is to load it inside an <iframe> we own.
 * Closing = removing the iframe. The entire D-ID runtime dies with its context.
 */

const IFRAME_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;overflow:hidden;background:transparent}
</style></head><body>
<script type="module"
  src="https://agent.d-id.com/v2/index.js"
  data-name="did-agent"
  data-mode="fabio"
  data-client-key="Z29vZ2xlLW9hdXRoMnwxMTE1NDg1MzcyMzUzMTMxNTk4MjQ6WTlxMnI4WFpjU25XTEJtWHN5U3JL"
  data-agent-id="v2_agt_HNFyNkLh"
  data-monitor="true"
  data-orientation="horizontal"
  data-position="right"
></script>
</body></html>`;

export default function DIdAgent() {
  const { visible, toggle, hide } = useAIAgentStore();
  const isMobile = useIsMobile();
  const blobUrlRef = useRef<string | null>(null);

  const handleClose = useCallback(() => {
    hide();
    // Revoke the blob URL to free memory
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, [hide]);

  // Create blob URL when visible
  useEffect(() => {
    if (visible && !blobUrlRef.current) {
      blobUrlRef.current = URL.createObjectURL(
        new Blob([IFRAME_HTML], { type: "text/html" })
      );
    }
    if (!visible && blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  if (isMobile) return null; // Mobile toggle is in MobileLayout bottom nav

  return (
    <>
      {/* D-ID iframe – sandboxed, full-screen when visible */}
      {visible && blobUrlRef.current && (
        <iframe
          src={blobUrlRef.current}
          title="AI Assistant"
          allow="camera;microphone"
          className="fixed inset-0 w-full h-full z-[9998] border-none bg-transparent"
          style={{ pointerEvents: "all" }}
        />
      )}

      {/* Toggle / Close button – always accessible, sits ABOVE the iframe */}
      <button
        onClick={visible ? handleClose : toggle}
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
