export type SpeechSeverity = "step" | "tip" | "praise" | "safety" | "warning";

export type SpeakOptions = {
  soundOn: boolean;
  quietMode: boolean;
  severity: SpeechSeverity;
  urgent?: boolean;
};

type SpeechApi = {
  cancel(): void;
  speak(utterance: SpeechSynthesisUtterance): void;
  speaking: boolean;
};

function speechApi(): SpeechApi | null {
  const api = (globalThis as unknown as { speechSynthesis?: SpeechApi }).speechSynthesis;
  if (!api || typeof SpeechSynthesisUtterance === "undefined") return null;
  return api;
}

function shouldSpeak(opts: SpeakOptions): boolean {
  if (!opts.soundOn) return false;
  if (!opts.quietMode) return true;
  return opts.severity === "step" || opts.severity === "safety" || opts.severity === "warning";
}

export function createSpeechCoach() {
  let lastInstruction = "";
  let lastPhrase = "";
  let lastPhraseAt = -Infinity;

  function speak(text: string, opts: SpeakOptions): boolean {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean || !shouldSpeak(opts)) return false;

    const now = Date.now();
    const urgent =
      opts.urgent || opts.severity === "safety" || opts.severity === "warning" || opts.severity === "step";

    if (!urgent && clean === lastPhrase && now - lastPhraseAt < 15_000) {
      return false;
    }

    const api = speechApi();
    if (!api) {
      if (opts.severity === "step") lastInstruction = clean;
      lastPhrase = clean;
      lastPhraseAt = now;
      return false;
    }

    if (api.speaking && !urgent) return false;
    if (urgent) api.cancel();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    api.speak(utterance);

    if (opts.severity === "step") lastInstruction = clean;
    lastPhrase = clean;
    lastPhraseAt = now;
    return true;
  }

  function setInstruction(text: string): void {
    lastInstruction = text.replace(/\s+/g, " ").trim();
  }

  function repeat(opts: Omit<SpeakOptions, "severity">): boolean {
    return speak(lastInstruction, { ...opts, severity: "step", urgent: true });
  }

  function stop(): void {
    speechApi()?.cancel();
  }

  return { speak, setInstruction, repeat, stop };
}

export type SpeechCoach = ReturnType<typeof createSpeechCoach>;
