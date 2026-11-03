import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { ReactElement, ReactNode } from "react";
import "../i18n";

type Store = ReturnType<typeof createStore>;
interface Options {
  store?: Store;
  client?: QueryClient;
}

export function createWrapper({ store = createStore(), client }: Options = {}) {
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>{children}</Provider>
    </QueryClientProvider>
  );
  return { Wrapper, queryClient, store };
}

/** Renders with fresh React Query + Jotai + the `en` i18n resources. */
export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const ctx = createWrapper(options);
  return { ...ctx, ...render(ui, { wrapper: ctx.Wrapper }) };
}
