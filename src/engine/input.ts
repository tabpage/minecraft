export interface InputCallbacks {
  onSelectHotbar: (slot: number) => void;
  onScrollHotbar: (delta: number) => void;
  onToggleInventory: () => void;
  onTogglePause: () => void;
  onPrimaryClick: () => void;
  onSecondaryClick: () => void;
  onDoubleSpace: () => void;
  onPointerLockChange: (locked: boolean) => void;
  onToggleFly?: () => void;
}

export class InputManager {
  public readonly keys: Set<string> = new Set();
  public mouseLeftDown = false;
  public mouseRightDown = false;
  public pointerLocked = false;
  public lookDeltaX = 0;
  public lookDeltaY = 0;

  // Touch inputs driven by TouchControls overlay
  public touchMoveX = 0;
  public touchMoveZ = 0;
  public touchJump = false;
  public touchCrouch = false;
  public touchSprint = false;
  public touchMine = false;

  // Gamepad state
  public gamepadConnected = false;
  public padMoveX = 0;
  public padMoveZ = 0;
  public padJump = false;
  public padCrouch = false;
  public padMine = false;
  private prevPadButtons: boolean[] = [];

  private canvas: HTMLCanvasElement;
  private callbacks: InputCallbacks;
  private enabled = true;
  private lastSpaceTime = 0;
  private isFallbackDragging = false;
  private lastDragX = 0;
  private lastDragY = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: InputCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.attach();
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.mouseLeftDown = false;
      this.mouseRightDown = false;
      this.touchMine = false;
      this.isFallbackDragging = false;
      if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock?.();
      }
    }
  }

  public requestLock() {
    if (!this.enabled) return;
    try {
      const p = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Pointer lock denied in sandbox iframe; drag-to-look fallback remains active!
        });
      }
    } catch {
      // Fallback active
    }
  }

  public getMoveVector(): { forward: number; strafe: number; jump: boolean; crouch: boolean; sprint: boolean; mineHeld: boolean } {
    let forward = 0;
    let strafe = 0;

    if (this.enabled) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1;

      forward += -this.touchMoveZ + -this.padMoveZ;
      strafe += this.touchMoveX + this.padMoveX;
    }

    const mag = Math.hypot(forward, strafe);
    if (mag > 1) {
      forward /= mag;
      strafe /= mag;
    }

    return {
      forward,
      strafe,
      jump: this.enabled && (this.keys.has('Space') || this.touchJump || this.padJump),
      crouch:
        this.enabled &&
        (this.keys.has('ShiftLeft') ||
          this.keys.has('ShiftRight') ||
          this.keys.has('KeyC') ||
          this.touchCrouch ||
          this.padCrouch),
      sprint:
        this.enabled &&
        (this.keys.has('ControlLeft') || this.keys.has('KeyR') || this.touchSprint),
      mineHeld: this.enabled && (this.mouseLeftDown || this.touchMine || this.padMine),
    };
  }

  public consumeLookDelta(): { dx: number; dy: number } {
    const dx = this.lookDeltaX;
    const dy = this.lookDeltaY;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    return { dx, dy };
  }

  public pollGamepad(dt: number, sensitivity: number) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const pad = pads.find((p) => p && p.connected);
    this.gamepadConnected = Boolean(pad);
    if (!pad) {
      this.padMoveX = 0;
      this.padMoveZ = 0;
      this.padJump = false;
      this.padCrouch = false;
      this.padMine = false;
      return;
    }

    const deadzone = (v: number) => (Math.abs(v) < 0.16 ? 0 : v);
    this.padMoveX = deadzone(pad.axes[0] ?? 0);
    this.padMoveZ = deadzone(pad.axes[1] ?? 0);

    const lookX = deadzone(pad.axes[2] ?? 0);
    const lookY = deadzone(pad.axes[3] ?? 0);
    if (this.enabled) {
      this.lookDeltaX += lookX * dt * 620 * sensitivity;
      this.lookDeltaY += lookY * dt * 460 * sensitivity;
    }

    const btn = (i: number) => Boolean(pad.buttons[i]?.pressed);
    const justPressed = (i: number) => btn(i) && !this.prevPadButtons[i];

    this.padJump = btn(0);
    this.padCrouch = btn(1);
    this.padMine = btn(7) || btn(2);

    if (justPressed(9)) this.callbacks.onTogglePause();
    if (justPressed(3)) this.callbacks.onToggleInventory();
    if (this.enabled) {
      if (justPressed(4)) this.callbacks.onScrollHotbar(-1);
      if (justPressed(5)) this.callbacks.onScrollHotbar(1);
      if (justPressed(7) || justPressed(2)) this.callbacks.onPrimaryClick();
      if (justPressed(6)) this.callbacks.onSecondaryClick();
    }

    this.prevPadButtons = pad.buttons.map((b) => Boolean(b.pressed));
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.code === 'Escape') {
      this.callbacks.onTogglePause();
      return;
    }
    if (e.code === 'KeyE' || e.code === 'Tab') {
      e.preventDefault();
      this.callbacks.onToggleInventory();
      return;
    }

    if (!this.enabled) return;

    if (e.code === 'KeyF') {
      e.preventDefault();
      this.callbacks.onSecondaryClick();
      return;
    }

    if (e.code === 'Space' && !e.repeat) {
      const now = performance.now();
      if (now - this.lastSpaceTime < 280) {
        this.callbacks.onDoubleSpace();
        this.lastSpaceTime = 0;
      } else {
        this.lastSpaceTime = now;
      }
    }

    if (e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      if (num >= 1 && num <= 9) {
        this.callbacks.onSelectHotbar(num - 1);
      }
    }

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.enabled) return;
    if (e.target !== this.canvas) return;

    if (!this.pointerLocked) {
      this.requestLock();
      this.isFallbackDragging = true;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    }

    if (e.button === 0) {
      this.mouseLeftDown = true;
      this.callbacks.onPrimaryClick();
    } else if (e.button === 2) {
      this.mouseRightDown = true;
      this.callbacks.onSecondaryClick();
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseLeftDown = false;
    if (e.button === 2) this.mouseRightDown = false;
    this.isFallbackDragging = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.enabled) return;
    if (this.pointerLocked) {
      this.lookDeltaX += e.movementX;
      this.lookDeltaY += e.movementY;
    } else if (this.isFallbackDragging) {
      this.lookDeltaX += (e.clientX - this.lastDragX) * 1.3;
      this.lookDeltaY += (e.clientY - this.lastDragY) * 1.3;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    if (Math.abs(e.deltaY) > 2) {
      this.callbacks.onScrollHotbar(e.deltaY > 0 ? 1 : -1);
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    if (e.target === this.canvas) e.preventDefault();
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    this.callbacks.onPointerLockChange(this.pointerLocked);
  };

  private onBlur = () => {
    this.keys.clear();
    this.mouseLeftDown = false;
    this.mouseRightDown = false;
    this.isFallbackDragging = false;
  };

  private attach() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  public dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }
}
