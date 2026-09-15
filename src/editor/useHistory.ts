import { useState, useCallback, useEffect, useRef } from 'react';

export function useHistory<T>(initialState: T | (() => T), storageKey?: string) {
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

  // Ref to hold initial snapshot during a transaction (e.g. dragging)
  const transactionSnapshotRef = useRef<T | null>(null);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  /**
   * Standard state update (commits immediately, creating 1 history state)
   */
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

  /**
   * Begins a drag/interactive transaction. Snapshots state at start.
   */
  const beginTransaction = useCallback(() => {
    transactionSnapshotRef.current = history.present;
  }, [history.present]);

  /**
   * Updates state during transaction (e.g. on pointermove).
   * Does NOT push to history stack.
   */
  const setTransient = useCallback((newStateOrFn: T | ((prev: T) => T)) => {
    setHistory(curr => {
      const nextState = typeof newStateOrFn === 'function'
        ? (newStateOrFn as (prev: T) => T)(curr.present)
        : newStateOrFn;

      return {
        ...curr,
        present: nextState
      };
    });
  }, []);

  /**
   * Commits the transaction when gesture ends (e.g. on pointerup).
   * Pushes the snapshot taken at beginTransaction to past, creating exactly ONE undo step.
   */
  const commitTransaction = useCallback((finalStateOrFn?: T | ((prev: T) => T)) => {
    const snapshot = transactionSnapshotRef.current;
    transactionSnapshotRef.current = null;

    setHistory(curr => {
      const finalState = finalStateOrFn
        ? (typeof finalStateOrFn === 'function'
            ? (finalStateOrFn as (prev: T) => T)(curr.present)
            : finalStateOrFn)
        : curr.present;

      if (snapshot && snapshot !== finalState) {
        return {
          past: [...curr.past.slice(-50), snapshot],
          present: finalState,
          future: []
        };
      }

      return {
        ...curr,
        present: finalState
      };
    });
  }, []);

  /**
   * Cancels transaction, reverting to the initial snapshot
   */
  const cancelTransaction = useCallback(() => {
    if (transactionSnapshotRef.current) {
      const snapshot = transactionSnapshotRef.current;
      transactionSnapshotRef.current = null;
      setHistory(curr => ({
        ...curr,
        present: snapshot
      }));
    }
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

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Y / Ctrl+Shift+Z
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

  // Debounced autosave to localStorage (500ms debounce)
  useEffect(() => {
    if (!storageKey) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(history.present));
      } catch (err) {
        console.warn('Failed to autosave to localStorage', err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [history.present, storageKey]);

  return {
    state: history.present,
    set,
    beginTransaction,
    setTransient,
    commitTransaction,
    cancelTransaction,
    undo,
    redo,
    canUndo,
    canRedo
  };
}