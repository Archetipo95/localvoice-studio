import { defineStore } from "pinia";

const SAMPLE_TEXT =
  "\u201cLeave the place [better](+1) than you found it\u201d is a philosophy of [stewardship](/stju\u02d0\u0259d\u0283\u026ap/), encouraging individuals to leave physical spaces, relationships, and workplaces in a better state than when they arrived. It emphasizes taking personal responsibility for improvement, such as cleaning up, adding value, or contributing positively for the benefit of the next person.";

export const useEditorStore = defineStore("editor", {
  state: () => ({
    text: SAMPLE_TEXT,
  }),

  actions: {
    setText(text: string) {
      this.text = text;
    },

    resetToDefault() {
      this.text = SAMPLE_TEXT;
    },
  },
});
