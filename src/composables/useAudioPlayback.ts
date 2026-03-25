import { onMounted, onUnmounted } from "vue";

function handleSingleAudioPlay(event: Event) {
  if (!(event.target instanceof HTMLAudioElement)) {
    return;
  }

  document.querySelectorAll("audio").forEach((audio) => {
    if (audio !== event.target && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  });
}

export function useAudioPlayback() {
  onMounted(() => {
    document.addEventListener("play", handleSingleAudioPlay, true);
  });

  onUnmounted(() => {
    document.removeEventListener("play", handleSingleAudioPlay, true);
  });
}
