import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { useSession } from "./stores/useSession";
import { CallDock } from "./components/CallDock";
import { NotificationToaster } from "./components/NotificationToaster";
import "./lib/devLivekit";
import "./index.css";

// Warm up the SDK + load WASM early so unlock is fast (fire-and-forget).
void useSession.getState().warmup();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
    {/* Persistent call dock — outside the router so an active call survives
        every navigation (T-14). Renders nothing while no call is live. */}
    <CallDock />
    {/* Live notification toasts (T2-09) — outside the router for the same reason. */}
    <NotificationToaster />
  </StrictMode>,
);
