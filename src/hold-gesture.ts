/** A stationary press may hold; scrolling or a cancelled pointer may never tap. */
export class HoldGesture {
  private pointer?: { id: number; x: number; y: number };
  private timer?: ReturnType<typeof setTimeout>;
  private removeListeners: Array<() => void> = [];
  private blocked = false;

  start(event: PointerEvent, hold?: () => void) {
    if (!event.isPrimary || event.button !== 0) {
      this.cancel();
      return;
    }
    this.finish();
    this.blocked = false;
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    const doc = (event.currentTarget as Node).ownerDocument!;
    const listen = (target: EventTarget, type: string, listener: EventListener) => {
      target.addEventListener(type, listener, { capture: true, passive: true });
      this.removeListeners.push(() => target.removeEventListener(type, listener, { capture: true }));
    };
    const matches = (event: PointerEvent) => event.pointerId === this.pointer?.id;
    listen(doc, 'pointermove', event => {
      const pointer = event as PointerEvent;
      if (matches(pointer)) this.move(pointer.clientX, pointer.clientY);
    });
    listen(doc, 'pointerup', event => { if (matches(event as PointerEvent)) this.finish(); });
    for (const type of ['pointercancel', 'lostpointercapture']) {
      listen(doc, type, event => { if (matches(event as PointerEvent)) this.cancel(); });
    }
    listen(doc, 'pointerdown', event => {
      if (!matches(event as PointerEvent)) this.cancel();
    });
    // iOS can hand scrolling to the browser before another pointermove arrives.
    listen(doc, 'touchmove', event => {
      const touches = (event as TouchEvent).touches;
      if (touches.length !== 1) this.cancel();
      else this.move(touches[0].clientX, touches[0].clientY);
    });
    listen(doc, 'touchcancel', () => this.cancel());
    listen(doc, 'touchend', () => this.finish());
    // Scroll events inside shadow roots do not reach document. Watch the actual
    // composed ancestors, including the bottom sheet's internal scroll body.
    for (const ancestor of new Set<EventTarget>([doc, ...event.composedPath()])) {
      listen(ancestor, 'scroll', () => this.cancel());
    }
    if (hold) this.timer = setTimeout(() => {
      this.timer = undefined;
      this.blocked = true;
      hold();
    }, 500);
  }

  private move(x: number, y: number) {
    if (this.pointer && Math.hypot(x - this.pointer.x, y - this.pointer.y) >= 8) this.cancel();
  }

  cancel() {
    if (this.pointer) this.blocked = true;
    this.finish();
  }

  /** Keyboard/assistive clicks are independent of an earlier pointer gesture. */
  allowsClick(event: MouseEvent) { return event.detail === 0 || !this.blocked; }

  private finish() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pointer = undefined;
    for (const remove of this.removeListeners.splice(0)) remove();
  }
}
