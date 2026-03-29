import { createApp, h } from "vue";
import { Icon as IconifyIcon } from "@iconify/vue";
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findPronunciationMarkupTokens } from "./pronunciation";

interface TextSlice {
  from: number;
  to: number;
}

function buildTextSlices(nodeText: string, viewPos: number, node: ProseMirrorNode) {
  const slices: TextSlice[] = [];
  node.descendants((child: ProseMirrorNode, childPos: number) => {
    if (!child.isText || !child.text) return true;
    slices.push({
      from: viewPos + 1 + childPos,
      to: viewPos + 1 + childPos + child.text.length,
    });
    return true;
  });

  if (slices.length === 0 && nodeText.length > 0) {
    slices.push({
      from: viewPos + 1,
      to: viewPos + 1 + nodeText.length,
    });
  }

  return slices;
}

function offsetToDocPosition(slices: TextSlice[], offset: number) {
  let consumed = 0;

  for (const slice of slices) {
    const sliceLength = slice.to - slice.from;
    if (offset <= consumed + sliceLength) {
      return slice.from + (offset - consumed);
    }
    consumed += sliceLength;
  }

  return slices.at(-1)?.to ?? 0;
}

export function createPronunciationPreviewExtension(options: {
  onPlay: (markup: string, label: string) => void | Promise<void>;
}) {
  return Extension.create({
    name: "pronunciation-preview",

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("pronunciation-preview"),
          props: {
            decorations: (state) => {
              const decorations: Decoration[] = [];

              state.doc.descendants((node, position) => {
                if (!node.isTextblock) return true;

                const blockText = node.textBetween(0, node.content.size, "\n", "\n");
                const tokens = findPronunciationMarkupTokens(blockText);
                if (tokens.length === 0) return true;

                const slices = buildTextSlices(blockText, position, node);
                if (slices.length === 0) return true;

                for (const token of tokens) {
                  const from = offsetToDocPosition(slices, token.from);
                  const to = offsetToDocPosition(slices, token.to);
                  if (from == null || to == null || to <= from) continue;

                  decorations.push(
                    Decoration.inline(from, to, {
                      "data-pronunciation-markup": token.markup,
                      "data-pronunciation-label": token.label,
                    }),
                  );

                  decorations.push(
                    Decoration.widget(
                      to,
                      () => {
                        const wrapper = document.createElement("span");
                        wrapper.className = "pronunciation-preview-trigger";
                        wrapper.setAttribute("contenteditable", "false");

                        const button = document.createElement("button");
                        button.type = "button";
                        button.className = "pronunciation-preview-trigger-button";
                        button.setAttribute("aria-label", `Play pronunciation for ${token.label}`);
                        button.dataset.pronunciationMarkup = token.markup;
                        button.dataset.pronunciationLabel = token.label;

                        const iconHost = document.createElement("span");
                        button.appendChild(iconHost);

                        const iconApp = createApp({
                          render() {
                            return h(IconifyIcon, {
                              icon: "heroicons:speaker-wave",
                              width: "1rem",
                              height: "1rem",
                            });
                          },
                        });

                        iconApp.mount(iconHost);
                        (
                          wrapper as HTMLElement & { __iconApp?: ReturnType<typeof createApp> }
                        ).__iconApp = iconApp;

                        button.addEventListener("mousedown", (event) => {
                          event.preventDefault();
                        });

                        button.addEventListener("click", (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void options.onPlay(token.markup, token.label);
                        });

                        wrapper.appendChild(button);
                        return wrapper;
                      },
                      {
                        side: 1,
                        destroy: (node) => {
                          (
                            node as HTMLElement & { __iconApp?: ReturnType<typeof createApp> }
                          ).__iconApp?.unmount?.();
                        },
                      },
                    ),
                  );
                }

                return true;
              });

              return DecorationSet.create(state.doc, decorations);
            },
          },
        }),
      ];
    },
  });
}
