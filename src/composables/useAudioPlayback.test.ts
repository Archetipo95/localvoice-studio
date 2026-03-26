// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioPlayback } from "./useAudioPlayback";

describe("useAudioPlayback", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("registers and cleans up the play listener", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");
    const removeEventListener = vi.spyOn(document, "removeEventListener");

    const Harness = defineComponent({
      setup() {
        useAudioPlayback();
        return () => null;
      },
    });

    const wrapper = mount(Harness);

    expect(addEventListener).toHaveBeenCalledWith("play", expect.any(Function), true);

    wrapper.unmount();

    expect(removeEventListener).toHaveBeenCalledWith("play", expect.any(Function), true);
  });

  it("pauses all other currently playing audio elements", () => {
    let listener: ((event: Event) => void) | undefined;
    vi.spyOn(document, "addEventListener").mockImplementation(((
      type: string,
      cb: EventListenerOrEventListenerObject,
    ) => {
      if (type === "play" && typeof cb === "function") {
        listener = cb as (event: Event) => void;
      }
    }) as typeof document.addEventListener);

    const Harness = defineComponent({
      setup() {
        useAudioPlayback();
        return () => null;
      },
    });

    mount(Harness);

    const first = document.createElement("audio");
    const second = document.createElement("audio");
    const firstPause = vi.fn();
    const secondPause = vi.fn();

    Object.defineProperty(first, "paused", { configurable: true, get: () => false });
    Object.defineProperty(second, "paused", { configurable: true, get: () => false });
    Object.defineProperty(first, "pause", { configurable: true, value: firstPause });
    Object.defineProperty(second, "pause", { configurable: true, value: secondPause });
    first.currentTime = 5;
    second.currentTime = 7;

    document.body.append(first, second);

    listener?.({ target: document.createElement("div") } as Event);
    expect(firstPause).not.toHaveBeenCalled();
    expect(secondPause).not.toHaveBeenCalled();

    listener?.({ target: first } as Event);

    expect(firstPause).not.toHaveBeenCalled();
    expect(secondPause).toHaveBeenCalledTimes(1);
    expect(second.currentTime).toBe(0);
  });
});
