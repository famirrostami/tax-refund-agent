import { QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { queryClient } from "./api";
import "./i18n";
import { ChatPage } from "./pages/ChatPage";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>
        <ChatPage />
      </JotaiProvider>
    </QueryClientProvider>
  </StrictMode>,
);
