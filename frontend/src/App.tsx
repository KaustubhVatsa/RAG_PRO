import { lazy, Suspense, useEffect } from "react";
import { LogoLoader } from "./components/brand/Logo";
import Home from "./pages/Home";
import Workspace from "./pages/Workspace";
import { useRoute } from "./lib/router";
import { ChatProvider } from "./state/chat";
import { DocumentsProvider } from "./state/documents";

// Secondary screens are split into their own chunks.
const EvalDashboard = lazy(() => import("./pages/EvalDashboard"));
const Lab = lazy(() => import("./pages/Lab"));

const TITLES = { home: "Verity: answers you can check", workspace: "Workspace · Verity", eval: "Evals · Verity", lab: "Design Lab · Verity" };

export default function App() {
  const route = useRoute();

  useEffect(() => {
    document.title = TITLES[route];
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <DocumentsProvider>
      <ChatProvider>
        <a href="#main" className="skip-link" onClick={(e) => {
          // Hash routing owns the URL hash, so move focus manually instead of navigating.
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}>
          Skip to content
        </a>
        <div className="aurora" aria-hidden="true">
          <span />
        </div>
        <div className="grain" aria-hidden="true" />
        <div className="app-root">
          <Suspense fallback={<LogoLoader />}>
            {route === "home" && <Home />}
            {route === "workspace" && <Workspace />}
            {route === "eval" && <EvalDashboard />}
            {route === "lab" && <Lab />}
          </Suspense>
        </div>
      </ChatProvider>
    </DocumentsProvider>
  );
}
