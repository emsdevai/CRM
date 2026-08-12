'use client'

import { toast, type ExternalToast } from 'sonner'

// Re-export the base toast so consumers can import from one place
export { toast }

// ---------------------------------------------------------------------------
// Typed convenience wrappers
// ---------------------------------------------------------------------------

export function toastSuccess(msg: string, opts?: ExternalToast): string | number {
  return toast.success(msg, opts)
}

export function toastError(msg: string, opts?: ExternalToast): string | number {
  return toast.error(msg, opts)
}

export function toastLoading(msg: string, opts?: ExternalToast): string | number {
  return toast.loading(msg, opts)
}

export function toastWarning(msg: string, opts?: ExternalToast): string | number {
  return toast.warning(msg, opts)
}

export function toastInfo(msg: string, opts?: ExternalToast): string | number {
  return toast.info(msg, opts)
}

/**
 * Shows a loading toast, resolves to success or error based on the promise.
 * Sonner v2: toast.promise(promise, data) — no third argument.
 *
 * Usage:
 *   await toastPromise(myAsyncFn(), {
 *     loading: 'Saving...',
 *     success: 'Saved!',
 *     error: 'Failed to save',
 *   })
 */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((err: unknown) => string)
  },
): Promise<T> {
  toast.promise(promise, messages)
  return promise
}
