import { useState, useCallback, useEffect } from 'react';

export function useHistory<T>(initialState: T | (() => T)) {
  const [history, setHistory] = useState<{
    past: T[];
    present: T;
    future: T[];
  }>(() => {
    const init = typeof initialState === 'function' ? (initialState as () => T)() : initialState;
    return {
      past: [],
      present: init,
      future: []
    };
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const set = useCallback((newStateOrFn: T | ((prev: T) => T)) => {
    setHistory(curr => {
      const nextState = typeof newStateOrFn === 'function'
        ? (newStateOrFn as (prev: T) => T)(curr.present)
        : newStateOrFn;

      if (nextState === curr.present) return curr;

      return {
        past: [...curr.past.slice(-50), curr.present],
        present: nextState,
        future: []
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory(curr => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, curr.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [curr.present, ...curr.future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(curr => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const newFuture = curr.future.slice(1);
      return {
        past: [...curr.past, curr.present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    state: history.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo
  };
}