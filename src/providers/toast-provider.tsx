import React, { createContext, useCallback, useContext, useState } from "react";

export type ToastType = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
};

export type ToastAPI = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  items: ToastItem[];
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastAPI>({
  success: () => {},
  error: () => {},
  info: () => {},
  items: [],
  dismiss: () => {},
});

export const useZenToast = () => useContext(ToastContext);

let toastCounter = 0;

export type ZenToastProviderProps = {
  children: React.ReactNode;
  /** Auto-dismiss timeout in ms (default 4000, 0 to disable) */
  autoDismiss?: number;
  /** Maximum number of toasts to show (default 5) */
  maxToasts?: number;
};

/**
 * Minimal toast provider for zen-shell distros.
 * Provides a simple toast queue with auto-dismiss.
 * Distros can override with Sonner or any other toast library by
 * wrapping with their own provider.
 */
export const ZenToastProvider = ({
  children,
  autoDismiss = 4000,
  maxToasts = 5,
}: ZenToastProviderProps) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const add = useCallback(
    (type: ToastType, message: string) => {
      const id = `toast-${++toastCounter}`;
      setItems((prev) => [
        ...prev.slice(-(maxToasts - 1)),
        { id, type, message },
      ]);
      if (autoDismiss > 0) {
        setTimeout(() => {
          setItems((prev) => prev.filter((t) => t.id !== id));
        }, autoDismiss);
      }
    },
    [autoDismiss, maxToasts],
  );

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = React.useMemo<ToastAPI>(
    () => ({
      success: (msg) => add("success", msg),
      error: (msg) => add("error", msg),
      info: (msg) => add("info", msg),
      items,
      dismiss,
    }),
    [add, dismiss, items],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ZenToastContainer items={items} dismiss={dismiss} />
    </ToastContext.Provider>
  );
};

/** Simple built-in toast renderer. Distros can replace with their own UI. */
const ZenToastContainer = ({
  items,
  dismiss,
}: {
  items: ToastItem[];
  dismiss: (id: string) => void;
}) => {
  if (!items.length) return null;

  const typeStyles: Record<ToastType, string> = {
    success:
      "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300",
    error: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
    info: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {items.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto rounded-lg border px-4 py-2 text-sm shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-2 ${typeStyles[item.type]}`}
          role="status"
        >
          <div className="flex items-center justify-between gap-3">
            <span>{item.message}</span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="text-xs opacity-60 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
