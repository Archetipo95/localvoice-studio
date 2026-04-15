export const APP_STUBS = {
  UApp: { template: "<div><slot /></div>" },
  UMain: { template: "<main><slot /></main>" },
  UContainer: { template: "<div><slot /></div>" },
  UFooter: {
    template: "<footer><slot /><slot name='left' /><slot name='right' /></footer>",
  },
  ULink: { template: "<a><slot /></a>" },
  RouterView: { template: "<div />" },
  AppTopHeader: { template: "<div />" },
  StudioSetup: { template: "<div />" },
  VoiceBlend: { template: "<div />" },
  ScriptLab: { template: "<div />" },
  OutputSection: { template: "<div />" },
};

export const OUTPUT_SECTION_STUBS = {
  PatternPlaceholder: { template: "<div class='output-empty-state'><slot /></div>" },
  GenerationHistory: { template: "<div></div>" },
  GenerateButton: { template: "<button type='button'>Generate</button>" },
};

export const VOICE_BLEND_STUBS = {
  PatternPlaceholder: { template: "<div><slot /></div>" },
  VoiceSelector: { template: "<div></div>" },
  VoiceMixSlider: { template: "<div></div>" },
  AdvancedVoiceControls: { template: "<div></div>" },
  VoicePresetManager: { template: "<div></div>" },
  UAccordion: { template: "<div></div>" },
};

export function mergeStubs(...stubSets: Array<Record<string, unknown>>) {
  return Object.assign({}, ...stubSets);
}
