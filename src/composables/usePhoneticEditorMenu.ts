// @ts-nocheck
import { ref, h, computed, unref, watch } from "vue";
import { defu } from "defu";
import {
  autoPlacement,
  computePosition,
  flip,
  hide,
  inline,
  offset,
  shift,
  size,
} from "@floating-ui/dom";
import { VueRenderer } from "@tiptap/vue-3";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";

function buildFloatingUIMiddleware(options: any) {
  const middleware: any[] = [];

  if (options.offset !== false) {
    middleware.push(offset(options.offset ?? 8));
  }
  if (options.flip !== false) {
    middleware.push(flip(options.flip || {}));
  }
  if (options.shift !== false) {
    middleware.push(shift(options.shift || { padding: 8 }));
  }
  if (options.size) {
    middleware.push(size(options.size));
  }
  if (options.autoPlacement) {
    middleware.push(autoPlacement(options.autoPlacement === true ? {} : options.autoPlacement));
  }
  if (options.hide) {
    middleware.push(hide(options.hide === true ? {} : options.hide));
  }
  if (options.inline) {
    middleware.push(inline(options.inline === true ? {} : options.inline));
  }

  return middleware;
}

function getValue(item: any, path: string) {
  return path
    .split(".")
    .reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), item);
}

function isArrayOfArray(value: any): boolean {
  return Array.isArray(value) && value.every(Array.isArray);
}

function score(value: string, query: string): number {
  const hay = value.toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return 0;
  if (hay === needle) return 0;
  if (hay.startsWith(needle)) return 1;
  if (hay.includes(needle)) return 2;
  return 3;
}

export function usePhoneticEditorMenu(options: any) {
  const filteredItems = ref([]);
  const selectedIndex = ref(0);
  const menuState = ref("closed");
  const searchTerm = options.searchTerm ?? ref("");

  let renderer: any = null;
  let element: HTMLElement | null = null;
  let handleMouseDown: ((e: MouseEvent) => void) | null = null;
  let commandFn: any = null;
  let keyDownHandler: any = null;
  let globalKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  let blurHandler: (() => void) | null = null;
  let triggerClientRect: any = null;
  let handleHover: any = null;
  let scrollHandler: (() => void) | null = null;
  let stopItemsWatch: (() => void) | null = null;

  const cleanupMenu = () => {
    if (menuState.value === "closed") return;
    menuState.value = "closed";

    if (globalKeyHandler) {
      document.removeEventListener("keydown", globalKeyHandler, true);
      globalKeyHandler = null;
    }
    if (blurHandler) {
      options.editor.view.dom.removeEventListener("blur", blurHandler);
      blurHandler = null;
    }
    if (scrollHandler) {
      window.removeEventListener("scroll", scrollHandler, true);
      scrollHandler = null;
    }
    if (element && handleMouseDown) {
      element.removeEventListener("mousedown", handleMouseDown);
      handleMouseDown = null;
    }
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
    if (element) {
      element.remove();
      element = null;
    }
  };

  const filterFields = options.filterFields ?? ["label"];
  const defaultFilter = (items: any[], query: string) => {
    if (!query) return items;

    const scored: Array<{ item: any; score: number }> = [];

    for (const item of items) {
      let bestScore: number | null = null;

      for (const field of filterFields) {
        const value = getValue(item, field);
        if (value == null) continue;

        const values = Array.isArray(value) ? value.map(String) : [String(value)];

        for (const v of values) {
          const normalized = v.replace(/[\s_-]/g, "");
          const s = Math.min(score(v, query) ?? 3, score(normalized, query) ?? 3);

          if (bestScore === null || s < bestScore) bestScore = s;
          if (bestScore === 0) break;
        }

        if (bestScore === 0) break;
      }

      if (bestScore !== null && bestScore < 3) {
        scored.push({ item, score: bestScore });
      }
    }

    scored.sort((a, b) => a.score - b.score);
    return scored.map(({ item }) => item);
  };

  const filter = options.filter || defaultFilter;
  const limit = options.limit ?? 42;
  const pluginKeyInstance =
    typeof options.pluginKey === "string" ? new PluginKey(options.pluginKey) : options.pluginKey;

  const groups = computed(() => {
    const items = unref(options.items);
    return items?.length ? (isArrayOfArray(items) ? items : [items]) : [];
  });

  const items = computed(() => groups.value.flatMap((group: any[]) => group));

  const filteredGroups = computed(() => {
    if (!filteredItems.value.length) return [];
    if (options.ignoreFilter) return [filteredItems.value];

    return groups.value
      .map((group: any[]) => {
        const filtered = group.filter((item) => filteredItems.value.includes(item));
        filtered.sort(
          (a: any, b: any) => filteredItems.value.indexOf(a) - filteredItems.value.indexOf(b),
        );
        return filtered;
      })
      .filter((group: any[]) => group.length > 0);
  });

  const selectableItems = computed(() =>
    filteredItems.value.filter((item: any) => item.type !== "label" && item.type !== "separator"),
  );

  const floatingUIOptions = defu(options.options, {
    strategy: "absolute",
    placement: "bottom-start",
    offset: 8,
    flip: {},
    shift: { padding: 8 },
    size: false,
    autoPlacement: false,
    hide: false,
    inline: false,
  });

  const middleware = buildFloatingUIMiddleware(floatingUIOptions);

  const updatePosition = (el: HTMLElement) => {
    if (!triggerClientRect) return;
    const rect = triggerClientRect();
    if (!rect) return;

    const virtualElement = {
      getBoundingClientRect: () => rect,
    };

    computePosition(virtualElement as any, el, {
      placement: floatingUIOptions.placement,
      strategy: floatingUIOptions.strategy,
      middleware,
    }).then(({ x, y, strategy }) => {
      el.style.width = "max-content";
      el.style.position = strategy;
      el.style.top = "0";
      el.style.left = "0";
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    });
  };

  const showMenu = () => {
    menuState.value = "open";

    if (!globalKeyHandler) {
      globalKeyHandler = (e: KeyboardEvent) => {
        if (!keyDownHandler) return;
        const handled = keyDownHandler({ event: e });
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      document.addEventListener("keydown", globalKeyHandler, true);
    }

    if (!blurHandler) {
      blurHandler = () => {
        setTimeout(() => {
          if (menuState.value === "open") {
            const tr = options.editor.view.state.tr.setMeta(pluginKeyInstance, { exit: true });
            options.editor.view.dispatch(tr);
          }
        }, 0);
      };
      options.editor.view.dom.addEventListener("blur", blurHandler);
    }

    if (!scrollHandler) {
      scrollHandler = () => {
        if (element) updatePosition(element);
      };
      window.addEventListener("scroll", scrollHandler, true);
    }

    handleHover = (index: number) => {
      selectedIndex.value = index;
      if (!renderer) return;
      renderer.updateProps({
        groups: filteredGroups.value,
        selectedIndex: index,
        onSelect: commandFn,
        onHover: handleHover,
        state: menuState.value,
      });
    };

    renderer = new VueRenderer(MenuComponent, {
      props: {
        groups: filteredGroups.value,
        selectedIndex: selectedIndex.value,
        onSelect: commandFn,
        onHover: handleHover,
        state: menuState.value,
      },
      editor: options.editor,
    });

    element = document.createElement("div");
    element.style.position = floatingUIOptions.strategy;
    element.style.zIndex = "50";

    handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
    };

    element.addEventListener("mousedown", handleMouseDown);

    const appendToElement =
      typeof options.appendTo === "function" ? options.appendTo() : options.appendTo;
    (appendToElement ?? options.editor.view.dom.parentElement)?.appendChild(element);

    if (renderer.element) {
      element.appendChild(renderer.element);
    }

    updatePosition(element);
  };

  if (options.ignoreFilter) {
    stopItemsWatch = watch(
      () => unref(options.items),
      (newItems: any) => {
        if (!triggerClientRect) return;

        const normalizedItems = newItems?.length
          ? isArrayOfArray(newItems)
            ? newItems.flat()
            : newItems
          : [];

        filteredItems.value = normalizedItems.slice(0, limit);

        if (!filteredItems.value.length) {
          cleanupMenu();
          return;
        }

        if (selectedIndex.value >= selectableItems.value.length) {
          selectedIndex.value = Math.max(0, selectableItems.value.length - 1);
        }

        if (menuState.value === "closed" && filteredItems.value.length) {
          showMenu();
          return;
        }

        if (renderer) {
          renderer.updateProps({
            groups: filteredGroups.value,
            selectedIndex: selectedIndex.value,
            onSelect: commandFn,
            onHover: handleHover,
            state: menuState.value,
          });
        }

        if (element) {
          updatePosition(element);
        }
      },
      { deep: true, flush: "sync" },
    );
  }

  const MenuComponent = {
    props: {
      groups: { type: Array, required: true },
      selectedIndex: { type: Number, required: true },
      onSelect: { type: Function, required: true },
      onHover: { type: Function, required: true },
      state: { type: String, required: true },
    },
    setup(menuProps: any) {
      function handleClick(e: MouseEvent, item: any, selectableIndex: number) {
        e.preventDefault();
        menuProps.onSelect(item, selectableIndex);
      }

      function handleMouseEnter(selectableIndex: number) {
        menuProps.onHover(selectableIndex);
      }

      return () => {
        const groupsData = menuProps.groups;
        const selectableIndexMap = new Map();
        let selectableCounter = 0;

        for (const group of groupsData) {
          for (const item of group) {
            const itemData = item as any;
            if (itemData.type !== "label" && itemData.type !== "separator") {
              selectableIndexMap.set(item, selectableCounter++);
            }
          }
        }

        return h(
          "div",
          {
            class: options.ui.value.content(),
            role: "listbox",
            "data-state": menuProps.state,
          },
          [
            h(
              "div",
              {
                class: options.ui.value.viewport(),
                role: "presentation",
              },
              groupsData.map((group: any[], groupIndex: number) =>
                h(
                  "div",
                  {
                    key: `group-${groupIndex}`,
                    class: options.ui.value.group(),
                    role: "group",
                  },
                  group.map((item: any, itemInGroupIndex: number) => {
                    const itemData = item as any;

                    if (itemData.type === "label") {
                      return h(
                        "div",
                        {
                          key: `label-${groupIndex}-${itemInGroupIndex}`,
                          class: options.ui.value.label({ class: itemData.class }),
                        },
                        options.renderItem(item, options.ui),
                      );
                    }

                    if (itemData.type === "separator") {
                      return h("div", {
                        key: `separator-${groupIndex}-${itemInGroupIndex}`,
                        class: options.ui.value.separator({ class: itemData.class }),
                        role: "separator",
                      });
                    }

                    const selectableIndex = selectableIndexMap.get(item);
                    const isHighlighted = selectableIndex === menuProps.selectedIndex;

                    return h(
                      "div",
                      {
                        key: `item-${selectableIndex}`,
                        class: options.ui.value.item({ class: itemData.class, active: false }),
                        role: "option",
                        "aria-selected": isHighlighted,
                        "data-highlighted": isHighlighted ? "" : undefined,
                        "data-disabled": itemData.disabled ? "" : undefined,
                        onMousedown: (e: MouseEvent) => handleClick(e, item, selectableIndex),
                        onMouseenter: () => handleMouseEnter(selectableIndex),
                        ref: (el: HTMLElement | null) => {
                          if (el && isHighlighted) {
                            el.scrollIntoView({ block: "nearest", inline: "nearest" });
                          }
                        },
                      },
                      options.renderItem(item, options.ui),
                    );
                  }),
                ),
              ),
            ),
          ],
        );
      };
    },
  };

  const plugin = Suggestion({
    pluginKey: pluginKeyInstance,
    editor: options.editor,
    char: options.char,
    allowedPrefixes: null,
    ...options.suggestion,
    items: ({ query: q }: { query: string }) => {
      searchTerm.value = q;
      if (options.ignoreFilter) {
        return items.value.slice(0, limit);
      }
      const filtered = filter(items.value, q);
      return filtered.slice(0, limit);
    },
    command: ({ editor, range, props }: any) => {
      options.onSelect(editor, range, props);
    },
    render: () => {
      keyDownHandler = (props: any) => {
        const { event } = props;

        if (!renderer || !selectableItems.value.length) {
          return false;
        }

        if (event.key === "Escape") {
          cleanupMenu();
          return true;
        }

        if (event.key === "ArrowUp") {
          selectedIndex.value =
            (selectedIndex.value + selectableItems.value.length - 1) % selectableItems.value.length;

          renderer.updateProps({
            groups: filteredGroups.value,
            selectedIndex: selectedIndex.value,
            onSelect: commandFn,
            onHover: handleHover,
            state: menuState.value,
          });
          return true;
        }

        if (event.key === "ArrowDown") {
          selectedIndex.value = (selectedIndex.value + 1) % selectableItems.value.length;
          renderer.updateProps({
            groups: filteredGroups.value,
            selectedIndex: selectedIndex.value,
            onSelect: commandFn,
            onHover: handleHover,
            state: menuState.value,
          });
          return true;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          const selectedItem = selectableItems.value[selectedIndex.value];
          if (selectedItem && commandFn) {
            commandFn(selectedItem);
          }
          return true;
        }

        return false;
      };

      return {
        onStart: (suggestionProps: any) => {
          filteredItems.value = options.ignoreFilter
            ? items.value.slice(0, limit)
            : suggestionProps.items;
          selectedIndex.value = 0;
          commandFn = (item: any) => suggestionProps.command(item);
          triggerClientRect = suggestionProps.clientRect;

          if (!filteredItems.value.length) return;
          showMenu();
        },
        onUpdate: (suggestionProps: any) => {
          filteredItems.value = options.ignoreFilter
            ? items.value.slice(0, limit)
            : suggestionProps.items;
          commandFn = (item: any) => suggestionProps.command(item);

          if (selectedIndex.value >= selectableItems.value.length) {
            selectedIndex.value = Math.max(0, selectableItems.value.length - 1);
          }

          if (!filteredItems.value.length) {
            cleanupMenu();
            return;
          }

          if (!renderer) {
            showMenu();
          } else {
            renderer.updateProps({
              groups: filteredGroups.value,
              selectedIndex: selectedIndex.value,
              onSelect: commandFn,
              onHover: handleHover,
              state: menuState.value,
            });
          }

          if (element) {
            updatePosition(element);
          }
        },
        onKeyDown: keyDownHandler,
        onExit: () => {
          cleanupMenu();
          triggerClientRect = null;
          searchTerm.value = "";
        },
      };
    },
  });

  const destroy = () => {
    menuState.value = "closed";

    if (globalKeyHandler) {
      document.removeEventListener("keydown", globalKeyHandler, true);
      globalKeyHandler = null;
    }
    if (blurHandler) {
      options.editor.view.dom.removeEventListener("blur", blurHandler);
      blurHandler = null;
    }
    if (scrollHandler) {
      window.removeEventListener("scroll", scrollHandler, true);
      scrollHandler = null;
    }
    if (element && handleMouseDown) {
      element.removeEventListener("mousedown", handleMouseDown);
      handleMouseDown = null;
    }
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
    if (element) {
      element.remove();
      element = null;
    }
    if (stopItemsWatch) {
      stopItemsWatch();
      stopItemsWatch = null;
    }
  };

  return {
    plugin,
    destroy,
    filteredItems,
    searchTerm,
  };
}
