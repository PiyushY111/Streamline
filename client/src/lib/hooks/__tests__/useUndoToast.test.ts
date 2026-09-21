import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUndoToast } from '../useUndoToast';

describe('useUndoToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the toast immediately with a 5s countdown', () => {
    const { result } = renderHook(() => useUndoToast());

    act(() => {
      result.current.showUndo({ message: 'Sent', onUndo: vi.fn(), onCommit: vi.fn() });
    });

    expect(result.current.undoToast).toEqual({
      active: true,
      message: 'Sent',
      countdown: 5,
      onUndo: expect.any(Function),
    });
  });

  it('counts down and commits after 5 seconds, then clears the toast', async () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useUndoToast());

    act(() => {
      result.current.showUndo({ message: 'Sent', onUndo: vi.fn(), onCommit });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(result.current.undoToast).toBeNull();
  });

  it('calls onUndo and cancels the countdown when undone before it elapses', async () => {
    const onCommit = vi.fn();
    const onUndo = vi.fn();
    const { result } = renderHook(() => useUndoToast());

    act(() => {
      result.current.showUndo({ message: 'Sent', onUndo, onCommit });
    });

    act(() => {
      result.current.undoToast?.onUndo();
    });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(result.current.undoToast).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('cancelPending stops the countdown without calling onUndo or onCommit', async () => {
    const onCommit = vi.fn();
    const onUndo = vi.fn();
    const { result } = renderHook(() => useUndoToast());

    act(() => {
      result.current.showUndo({ message: 'Sent', onUndo, onCommit });
    });

    act(() => {
      result.current.cancelPending();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(onUndo).not.toHaveBeenCalled();
  });
});
