import { createElement } from 'react'
import { vi } from 'vitest'

/**
 * Cloudinary's upload widget needs a third-party script. The double renders the
 * trigger children with a no-op `open`, and remembers the last `onSuccess` so a
 * test can simulate a finished upload.
 */
export const uploadWidget = vi.fn()
export const widgetState: { onSuccess?: (result?: unknown) => void; opens: number } = {
   opens: 0,
}

export const CldUploadWidget = (props: {
   children?: (args: { open: () => void }) => unknown
   onSuccess?: (result?: unknown) => void
}) => {
   widgetState.onSuccess = props.onSuccess

   const open = () => {
      widgetState.opens += 1
      uploadWidget()
   }

   return props.children ? props.children({ open }) : null
}

export const CldImage = (props: { alt?: string } & Record<string, unknown>) =>
   createElement('img', { alt: props.alt ?? 'cloudinary', ...props })
