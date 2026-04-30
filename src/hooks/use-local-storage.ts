import { useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const lastSerializedRef = useRef<string | null>(null);
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      lastSerializedRef.current = item;
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      void error;
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      const serialized = JSON.stringify(valueToStore);
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, serialized);
        lastSerializedRef.current = serialized;
        window.dispatchEvent(new CustomEvent("local-storage-update", { detail: { key } }));
        window.dispatchEvent(new Event("local-storage"));
      }
    } catch (error) {
      void error;
    }
  };

  useEffect(() => {
    const handleStorageChange = (event: Event) => {
      if (event.type === "local-storage-update" && (event as CustomEvent).detail?.key !== key) {
        return;
      }
      try {
        const item = window.localStorage.getItem(key);
        if (item === lastSerializedRef.current) {
          return;
        }
        lastSerializedRef.current = item;
        setStoredValue(item ? JSON.parse(item) : initialValue);
      } catch (error) {
        void error;
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("local-storage-update", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("local-storage-update", handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue] as const;
}
