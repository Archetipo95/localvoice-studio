import { shallowRef } from "vue";
import { createInitialState, reduceAppState, type StateAction } from "../store/state";
import type { AppState } from "../types";

const state = shallowRef<AppState>(createInitialState());

export function useAppState() {
  function dispatch(action: StateAction) {
    state.value = reduceAppState(state.value, action);
  }

  return {
    state,
    dispatch,
  };
}
