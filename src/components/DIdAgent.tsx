import { useEffect } from "react";

/**
 * Loads the D-ID AI Agent widget dynamically inside the React SPA.
 * This ensures the script runs after the DOM is ready and avoids
 * issues with Vite's dev server or SPA navigation stripping the tag.
 */
export default function DIdAgent() {
  useEffect(() => {
    // Avoid duplicates
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

    return () => {
      // Cleanup on unmount (unlikely but safer)
      script.remove();
      // Also remove the widget element if D-ID injected one
      document.querySelector("did-agent")?.remove();
    };
  }, []);

  return null;
}
