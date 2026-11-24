import { DIRECTION_ALL, INPUT_CANCEL, Manager, Pan, Press, TouchMouseInput } from "@egjs/hammerjs";

/** Handle-only drag, using the same input family and press gate as HA's circular control. */
export class HandleDrag {
  private manager: HammerManager;
  private active = false;
  private blocked = false;
  private startX = 0;
  private startValue = 0;
  private span = 1;
  private value = 0;
  private touch = false;

  constructor(handle: HTMLElement, private options: {
    enabled: () => boolean; value: () => number;
    move: (value: number) => void; end: (value: number) => void; cancel: () => void;
  }) {
    const manager = this.manager = new Manager(handle, { inputClass: TouchMouseInput });
    const pan = new Pan({ direction: DIRECTION_ALL, threshold: 0 });
    manager.add(new Press({ pointers: 1, time: 50 }));
    manager.add(pan);
    manager.on("hammer.input", (event) => {
      if (event.isFirst) {
        this.blocked = !options.enabled(); this.active = false;
        this.touch = event.pointerType === "touch";
        this.startX = event.center.x; this.startValue = this.value = options.value();
        this.span = Math.max(1, handle.parentElement!.getBoundingClientRect().width - handle.getBoundingClientRect().width);
        pan.set({ enable: !this.touch && !this.blocked });
      }
      if (event.pointers.length > 1 || event.eventType & INPUT_CANCEL) { this.cancel(); pan.set({ enable: false }); }
    });
    const consume = (event: HammerInput) => { event.srcEvent.stopPropagation(); event.srcEvent.preventDefault(); };
    manager.on("press", (event) => {
      if (this.blocked || !options.enabled()) return;
      consume(event); this.active = true; options.move(this.value); pan.set({ enable: true });
    });
    manager.on("pan", consume);
    manager.on("panstart panmove", (event) => {
      if (this.blocked || !options.enabled()) return;
      this.active = true;
      this.value = Math.max(0, Math.min(100, Math.round(this.startValue + (event.center.x - this.startX) / this.span * 100)));
      options.move(this.value);
    });
    manager.on("panend pressup", () => {
      if (!this.active || this.blocked) return;
      this.active = false; pan.set({ enable: !this.touch });
      if (options.enabled() && this.value !== this.startValue) options.end(this.value);
      else options.cancel();
    });
    manager.on("pancancel", () => { this.cancel(); pan.set({ enable: !this.touch }); });
  }
  cancel() { this.active = false; this.blocked = true; this.options.cancel(); }
  destroy() { this.manager.destroy(); }
}
