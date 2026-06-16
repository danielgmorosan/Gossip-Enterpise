import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { useSession } from "./stores/useSession";
import "./index.css";

// Warm up the SDK + load WASM early so unlock is fast (fire-and-forget).
void useSession.getState().warmup();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
