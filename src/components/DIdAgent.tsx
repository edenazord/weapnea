import { useEffect } from "react";
import { useAIAgentStore } from "@/hooks/useAIAgentStore";
import { Bot, X } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * Loads the D-ID AI Agent widget dynamically inside the React SPA.
 * Controlled by useAIAgentStore – the widget is injected/removed when toggled.
 * Also renders a floating toggle button on desktop (mobile uses bottom nav).
 * When the agent is open, a close button is shown at a high z-index so the user
 * can always dismiss the overlay and return to the normal chat widget.
 */

function injectDIdScript() {
  if (document.querySelector('script[data-name="did-agent"]')) return;
  const script = document.createElement("script");
  script.type = "module";
  script.src = "https://agent.d-id.com/v2/index.js";
  script.dataset.name = "did-agent";
  script.dataset.mode = "fabio";
  script.dataset.clientKey =
    "Z29vZ2xlLW9hdXRoMnwxMTE1NDg1MzcyMzUzMTMxNTk4MjQ6WTlxMnI4WFpjU25XTEJtWHN5U3JL";
  script.dataset.agentId = "v2_agt_HNFyNkLh";
  script.dataset.monitor = "true";
  script.dataset.orientation = "horizontal";
  script.dataset.position = "right";
  document.body.appendChild(script);
}

function removeDIdScript() {
  document.querySelector('script[data-name="did-agent"]')?.remove();
  document.querySelector("did-agent")?.remove();
  document.querySelectorAll('[id^="did-"]').forEach((el) => el.remove());
}

export default function DIdAgent() {
  const { visible, toggle, hide } = useAIAgentStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (visible) {
      injectDIdScript();
    } else {
      removeDIdScript();
    }
    return () => {
      removeDIdScript();
    };
  }, [visible]);

  // On mobile, toggle lives in MobileLayout bottom nav; we only render the close overlay here
  if (isMobile) {
    if (!visible) return null;
    return (
      <button
        onClick={hide}
        className="fixed z-[99999] top-4 right-4 bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl transition-all rounded-full p-2"
        aria-label="Chiudi AI Assistant"
      >
        <X className="w-5 h-5" />
      </button>
    );
  }

  // Desktop: floating toggle + close overlay when open
  return (
    <>
      {/* Close button – always on top when agent is visible */}
      {visible && (
        <button
          onClick={hide}
          className="fixed z-[99999] top-4 right-4 bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl transition-all rounded-full p-2.5 flex items-center gap-1.5"
          aria-label="Chiudi AI Assistant"
        >
          <X className="w-5 h-5" />
          <span className="text-sm font-medium pr-1">Chiudi AI</span>
        </button>
      )}

      {/* Toggle button */}
      <button
        onClick={toggle}
        className={`fixed z-50 bottom-44 right-4 shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center px-4 py-3 rounded-full gap-2 ${
          visible
            ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
            : "bg-gradient-to-r from-emerald-400 to-teal-500 text-white hover:from-emerald-500 hover:to-teal-600"
        }`}
        aria-label={visible ? "Chiudi AI Assistant" : "Apri AI Assistant"}
      >
        <Bot className="w-5 h-5" />
        <span className="font-semibold text-sm">AI Assistant</span>
      </button>
    </>
  );
}
