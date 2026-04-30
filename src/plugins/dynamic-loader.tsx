import React from "react";
import { Skeleton } from "@embeddr/react-ui";

interface DynamicPluginComponentProps {
  pluginId: string;
  componentName: string;
  api: any;
  windowId?: string;
  id?: string;
  [key: string]: any;
}

/**
 * DynamicPluginComponent – resolves and renders a plugin UMD component.
 *
 * Uses a custom memo comparator that checks pluginId/componentName/windowId
 * by value instead of reference, preventing unnecessary re-mounts.
 */
export const DynamicPluginComponent: React.FC<DynamicPluginComponentProps> = React.memo(
  ({ pluginId, componentName, api, ...props }) => {
    const [Component, setComponent] = React.useState<React.ComponentType<any> | null>(null);

    const toPascalCase = React.useCallback((value: string) => {
      return value
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
    }, []);

    React.useEffect(() => {
      const libName = pluginId.replace(/[^a-zA-Z0-9]/g, "_") + "Plugin";
      let attempts = 0;
      const maxAttempts = 50;

      const isComponent = (value: any) => {
        if (!value) return false;
        if (typeof value === "function") return true;
        if (typeof value === "object" && value.$$typeof) return true;
        return false;
      };

      const checkLib = () => {
        const lib = (window as any)[libName];
        if (lib) {
          const pascal = toPascalCase(componentName);
          const candidate =
            lib[componentName] ||
            lib[pascal] ||
            (lib.default && (lib.default[componentName] || lib.default[pascal])) ||
            lib.default;
          if (isComponent(candidate)) {
            setComponent(() => candidate);
            return true;
          }
          if (attempts === 0) {
            console.warn("[ZenUI] Component not found in plugin lib", {
              pluginId,
              componentName,
              libName,
              availableKeys: Object.keys(lib),
            });
          }
        }
        return false;
      };

      if (checkLib()) return;

      const interval = setInterval(() => {
        attempts += 1;
        if (checkLib()) {
          clearInterval(interval);
        } else if (attempts >= maxAttempts) {
          console.warn("[ZenUI] Plugin component resolve timeout", {
            pluginId,
            componentName,
            libName,
          });
          clearInterval(interval);
        }
      }, 100);

      return () => clearInterval(interval);
    }, [pluginId, componentName]);

    if (!Component) {
      return (
        <div className="p-4 space-y-3">
          <Skeleton className="h-4 w-62.5" />
          <Skeleton className="h-4 w-50" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }

    return <Component api={api} pluginId={pluginId} {...props} />;
  },
  // Custom comparator: only re-render when the identifying props change.
  // api is passed through normally — React handles the child update.
  (prev, next) =>
    prev.pluginId === next.pluginId &&
    prev.componentName === next.componentName &&
    prev.windowId === next.windowId &&
    prev.id === next.id &&
    prev.api === next.api,
);
