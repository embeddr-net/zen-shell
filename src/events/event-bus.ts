type Listener = (...args: Array<unknown>) => void;

export class EventBus {
  private listeners: Record<string, Array<Listener>> = {};
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  setDebug(enabled: boolean) {
    this.debug = enabled;
  }

  on(event: string, listener: Listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    if (this.debug) {
      console.debug(`[EventBus] on '${event}' (${this.listeners[event].length})`);
    }
    return () => this.off(event, listener);
  }

  off(event: string, listener: Listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
    if (this.debug) {
      console.debug(`[EventBus] off '${event}' (${this.listeners[event].length})`);
    }
  }

  emit(event: string, ...args: Array<unknown>) {
    if (this.debug) {
      console.debug(`[EventBus] emit '${event}'`, args);
    }
    const listeners = this.listeners[event];
    if (!listeners || listeners.length === 0) return;
    listeners.forEach((listener) => {
      try {
        listener(...args);
      } catch (e) {
        console.error(`[EventBus] listener error for '${event}'`, e);
      }
    });
  }
}

export const globalEventBus = new EventBus(false);
