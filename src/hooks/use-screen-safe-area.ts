import { useEffect, useMemo, useState } from "react";

type ScreenSafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type UseScreenSafeAreaOptions = {
  enabled?: boolean;
  commandBarElementId?: string;
  edgePadding?: number;
  overlayCollapsedThresholdPx?: number;
  commandBarLookupRetries?: number;
};

const DEFAULT_COMMAND_BAR_ID = "embeddr-command-bar";
const DEFAULT_OVERLAY_COLLAPSED_THRESHOLD = 10;
const DEFAULT_LOOKUP_RETRIES = 20;

function measureInsets(
  commandBarElementId: string,
  edgePadding: number,
  overlayCollapsedThresholdPx: number,
): ScreenSafeAreaInsets {
  if (typeof window === "undefined") {
    return {
      top: edgePadding,
      right: edgePadding,
      bottom: edgePadding,
      left: edgePadding,
    };
  }

  const insets: ScreenSafeAreaInsets = {
    top: edgePadding,
    right: edgePadding,
    bottom: edgePadding,
    left: edgePadding,
  };

  const commandBar = document.getElementById(commandBarElementId);
  if (!commandBar) {
    return insets;
  }

  const rect = commandBar.getBoundingClientRect();
  const nearTop = Math.abs(rect.top) <= Math.abs(window.innerHeight - rect.bottom);
  const topInset = Math.max(0, rect.bottom);
  const bottomInset = Math.max(0, window.innerHeight - rect.top);

  if (nearTop) {
    if (topInset > overlayCollapsedThresholdPx) {
      insets.top = Math.max(insets.top, Math.round(topInset));
    }
  } else if (bottomInset > overlayCollapsedThresholdPx) {
    insets.bottom = Math.max(insets.bottom, Math.round(bottomInset));
  }

  return insets;
}

export function useScreenSafeArea({
  enabled = true,
  commandBarElementId = DEFAULT_COMMAND_BAR_ID,
  edgePadding = 8,
  overlayCollapsedThresholdPx = DEFAULT_OVERLAY_COLLAPSED_THRESHOLD,
  commandBarLookupRetries = DEFAULT_LOOKUP_RETRIES,
}: UseScreenSafeAreaOptions = {}): ScreenSafeAreaInsets {
  const [insets, setInsets] = useState<ScreenSafeAreaInsets>(() =>
    measureInsets(commandBarElementId, edgePadding, overlayCollapsedThresholdPx),
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setInsets({
        top: Math.max(0, edgePadding),
        right: Math.max(0, edgePadding),
        bottom: Math.max(0, edgePadding),
        left: Math.max(0, edgePadding),
      });
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    let frameId: number | null = null;
    let retries = 0;

    const updateMeasurements = () => {
      const next = measureInsets(
        commandBarElementId,
        Math.max(0, edgePadding),
        Math.max(0, overlayCollapsedThresholdPx),
      );
      setInsets((current) =>
        current.top === next.top &&
        current.right === next.right &&
        current.bottom === next.bottom &&
        current.left === next.left
          ? current
          : next,
      );
    };

    const attachObserver = () => {
      resizeObserver?.disconnect();
      resizeObserver = null;

      const commandBar = document.getElementById(commandBarElementId);
      if (commandBar && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(updateMeasurements);
        resizeObserver.observe(commandBar);
      }
      updateMeasurements();
    };

    const ensureObserver = () => {
      attachObserver();
      if (!resizeObserver && retries < commandBarLookupRetries) {
        retries += 1;
        frameId = window.requestAnimationFrame(ensureObserver);
      }
    };

    ensureObserver();
    window.addEventListener("resize", updateMeasurements);
    window.visualViewport?.addEventListener("resize", updateMeasurements);

    return () => {
      resizeObserver?.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", updateMeasurements);
      window.visualViewport?.removeEventListener("resize", updateMeasurements);
    };
  }, [
    commandBarElementId,
    commandBarLookupRetries,
    edgePadding,
    enabled,
    overlayCollapsedThresholdPx,
  ]);

  return useMemo(
    () => ({
      top: insets.top,
      right: insets.right,
      bottom: insets.bottom,
      left: insets.left,
    }),
    [insets.bottom, insets.left, insets.right, insets.top],
  );
}

