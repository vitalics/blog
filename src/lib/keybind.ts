type Context<T extends Record<string, unknown> = {}> = {
  event: KeyboardEvent;
  control: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  extra: T;
};

interface KeybindHandle {
  template: string;
  key: string;
  enabled: boolean;
  enable: () => void;
  disable: () => void;
  fire: (event: KeyboardEvent) => void | Promise<void>;
  unregister: () => void;
  callback?: Function;
  modifiers: Set<string>;
  [Symbol.dispose]: () => void;
}

export class KeybindManager implements Disposable {
  private handles = new Map<string, KeybindHandle[]>();
  private enabled = true;
  private boundHandler: (e: KeyboardEvent) => void;
  private capture: boolean;

  constructor(
    public parent: HTMLElement | Document,
    { capture = false }: { capture?: boolean } = {},
  ) {
    this.capture = capture;
    this.boundHandler = this.handleKeydown.bind(this);
    this.parent.addEventListener("keydown", this.boundHandler, { capture });
  }

  private handleKeydown(event: KeyboardEvent) {
    if (!this.enabled) return;

    const key = this.normalizeKey(event);
    const handles = this.handles.get(key);

    if (!handles) return;

    // Check if we're in an input field
    const target = event.target as HTMLElement;
    const isInput =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;

    for (const handle of handles) {
      // By default, enable shortcuts in input fields for some keys
      // You can customize this behavior based on your needs
      handle.fire(event);
    }
  }

  private normalizeKey(event: KeyboardEvent): string {
    const parts: string[] = [];

    if (event.ctrlKey) parts.push("ctrl");
    if (event.shiftKey) parts.push("shift");
    if (event.altKey) parts.push("alt");
    if (event.metaKey) parts.push("meta");

    // Normalize key name
    let key = event.key.toLowerCase();
    if (key === " ") key = "space";
    if (key === "escape") key = "esc";
    if (key === "arrowup") key = "up";
    if (key === "arrowdown") key = "down";
    if (key === "arrowleft") key = "left";
    if (key === "arrowright") key = "right";
    if (key === "delete") key = "del";
    if (key === "backspace") key = "backspace";
    if (key === "+") key = "plus";

    parts.push(key);

    return parts.join("+");
  }

  private parseTemplate(template: string): {
    key: string;
    modifiers: Set<string>;
  } {
    // Normalize "+" key alias before splitting on "+"
    const normalized = template
      .toLowerCase()
      .replace(/(?<![a-z])(\+)$/i, "plus");
    const parts = normalized.split("+");
    const key = parts[parts.length - 1];
    const modifiers = new Set(parts.slice(0, -1).filter(Boolean));

    return { key, modifiers };
  }

  private matchesModifiers(
    eventModifiers: Set<string>,
    templateModifiers: Set<string>,
  ): boolean {
    const hasCtrl =
      eventModifiers.has("ctrl") === templateModifiers.has("ctrl");
    const hasShift =
      eventModifiers.has("shift") === templateModifiers.has("shift");
    const hasAlt = eventModifiers.has("alt") === templateModifiers.has("alt");
    const hasMeta =
      eventModifiers.has("meta") === templateModifiers.has("meta");

    return hasCtrl && hasShift && hasAlt && hasMeta;
  }

  register<T extends Record<string, unknown> = {}>(
    template: string,
    callback: (ctx: Context<T>) => void | Promise<void>,
    extraContext: T = {} as T,
  ): KeybindHandle {
    const { key, modifiers } = this.parseTemplate(template);
    const modifierPrefix = [...modifiers].sort().join("+");
    const fullKey = modifierPrefix ? `${modifierPrefix}+${key}` : key;

    const handle: KeybindHandle = {
      template,
      key: fullKey,
      enabled: true,
      callback,
      modifiers,
      enable: () => {
        handle.enabled = true;
      },
      disable: () => {
        handle.enabled = false;
      },
      fire: (event: KeyboardEvent) => {
        if (!handle.enabled) return;

        const eventModifiers = new Set<string>();
        if (event.ctrlKey) eventModifiers.add("ctrl");
        if (event.shiftKey) eventModifiers.add("shift");
        if (event.altKey) eventModifiers.add("alt");
        if (event.metaKey) eventModifiers.add("meta");

        if (!this.matchesModifiers(eventModifiers, handle.modifiers)) return;

        const ctx: Context<T> = {
          event,
          control: event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
          extra: extraContext,
        };

        callback(ctx);
      },
      unregister: () => {
        const handles = this.handles.get(fullKey);
        if (handles) {
          const index = handles.indexOf(handle);
          if (index > -1) {
            handles.splice(index, 1);
          }
          if (handles.length === 0) {
            this.handles.delete(fullKey);
          }
        }
      },
      [Symbol.dispose]() {
        handle.unregister();
      },
    };

    if (!this.handles.has(fullKey)) {
      this.handles.set(fullKey, []);
    }
    this.handles.get(fullKey)!.push(handle);

    return handle;
  }

  unregister(template: string) {
    const { key, modifiers } = this.parseTemplate(template);
    const modifierPrefix = [...modifiers].sort().join("+");
    const fullKey = modifierPrefix ? `${modifierPrefix}+${key}` : key;
    this.handles.delete(fullKey);
  }

  unregisterAll() {
    this.handles.clear();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  dispose() {
    this.parent.removeEventListener("keydown", this.boundHandler, {
      capture: this.capture,
    });
    this.unregisterAll();
  }

  [Symbol.dispose]() {
    this.dispose();
  }
}

// Helper to create a keybind manager for a specific element or document
export function createKeybindManager(
  element: HTMLElement | Document,
  opts?: { capture?: boolean },
): KeybindManager {
  return new KeybindManager(element, opts);
}

export const keybindManager = createKeybindManager(document.body);
