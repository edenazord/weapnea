import { useEffect, useCallback, useRef } from "react";
import { useAIAgentStore } from "@/hooks/useAIAgentStore";
import { Bot } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * D-ID AI Agent controller.
 *
 * Strategy: D-ID injects its own web-component / iframes / overlays into the
 * document body with sky-high z-index values that cannot be reliably covered by
 * React-rendered elements. Therefore we use a two-pronged approach:
 *
 * 1. To OPEN: inject the <script> tag as before.
 * 2. To CLOSE: inject a <style> tag that hides every D-ID element with
 *    `display:none !important`, then remove all D-ID nodes after a short delay.
 *    A MutationObserver watches <body> for any re-injected D-ID nodes and
 *    removes them immediately while the agent should be closed.
 */

const DID_HIDE_STYLE_ID = '__did-agent-hide-style';

/** Inject a global style sheet that nukes all D-ID elements visually */
function injectHideStyle() {
  if (document.getElementById(DID_HIDE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = DID_HIDE_STYLE_ID;
  style.textContent = `
    did-agent,
    [id^="did-"],
    [class*="did-"],
    [class*="d-id"],
    iframe[src*="d-id"],
    iframe[src*="agents.d-id"],
    [data-did],
    [data-agent],
    script[data-name="did-agent"] ~ * {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
      position: fixed !important;
      left: -99999px !important;
    }
  `;
  document.head.appendChild(style);
}

function removeHideStyle() {
  document.getElementById(DID_HIDE_STYLE_ID)?.remove();
}

function injectDIdScript() {
  removeHideStyle(); // make sure the hide-style is gone first
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

function removeDIdNodes() {
  document.querySelector('script[data-name="did-agent"]')?.remove();
  document.querySelector("did-agent")?.remove();
  document.querySelectorAll('[id^="did-"]').forEach((el) => el.remove());
  document.querySelectorAll('iframe[src*="d-id"], iframe[src*="agents.d-id"]').forEach((el) => el.remove());
  document.querySelectorAll('[class*="did-"], [class*="d-id"]').forEach((el) => el.remove());
  document.querySelectorAll('[data-did], [data-agent]').forEach((el) => el.remove());
}

/** Full close: hide immediately via CSS, then remove nodes */
function forceRemoveAll() {
  injectHideStyle();
  removeDIdNodes();
  // Keep retrying removal since D-ID may re-inject
  setTimeout(removeDIdNodes, 100);
  setTimeout(removeDIdNodes, 300);
  setTimeout(removeDIdNodes, 700);
  setTimeout(removeDIdNodes, 1500);
}

export default function DIdAgent() {
  const { visible, toggle, hide } = useAIAgentStore();
  const isMobile = useIsMobile();
  const observerRef = useRef<MutationObserver | null>(null);

  const handleClose = useCallback(() => {
    hide();
    forceRemoveAll();
  }, [hide]);

  // MutationObserver: when agent should be hidden, watch body for any D-ID re-injections
  useEffect(() => {
    if (visible) {
      // Stop observer, remove hide style, inject script
      observerRef.current?.disconnect();
      observerRef.current = null;
      injectDIdScript();
    } else {
      // Force-hide everything and start watching
      forceRemoveAll();
      const obs = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              const tag = node.tagName?.toLowerCase() || '';
              const id = node.id || '';
              const cls = node.className || '';
              const src = node instanceof HTMLIFrameElement ? (node.src || '') : '';
              if (
                tag === 'did-agent' ||
                tag === 'script' && (node as HTMLScriptElement).dataset?.name === 'did-agent' ||
                id.startsWith('did-') ||
                String(cls).includes('did-') || String(cls).includes('d-id') ||
                src.includes('d-id') || src.includes('agents.d-id')
              ) {
                node.remove();
              }
            }
          }
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      observerRef.current = obs;
    }
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      forceRemoveAll();
    };
  }, [visible]);

  // Escape key listener
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, handleClose]);

  // On mobile, toggle lives in MobileLayout bottom nav; no button rendered here
  if (isMobile) return null;

  // Desktop: single toggle button next to Chat FAB
  return (
    <button
      onClick={visible ? handleClose : toggle}
      className={`fixed z-50 bottom-6 right-[210px] w-48 h-12 shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center rounded-full gap-2 ${
        visible
          ? "bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700"
          : "bg-gradient-to-r from-emerald-400 to-teal-500 text-white hover:from-emerald-500 hover:to-teal-600"
      }`}
      aria-label={visible ? "Chiudi AI Assistant" : "Apri AI Assistant"}
    >
      <Bot className="w-5 h-5" />
      <span className="font-semibold text-sm">{visible ? "Chiudi AI" : "AI Assistant"}</span>
    </button>
  );
}
