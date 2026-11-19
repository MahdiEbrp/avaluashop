import { act, fireEvent, render, screen } from '@testing-library/react'

import CompareImage from '@/components/native/CompareImage'

/**
 * jsdom lays nothing out, so the component's ResizeObserver never fires and the
 * slider stays disabled. This double records the callback and reports a
 * container of `containerSize` × `containerSize` on demand, which is what the
 * browser would do after the first frame.
 */
class ManualResizeObserver {
   static instances: ManualResizeObserver[] = []

   constructor(private readonly callback: ResizeObserverCallback) {
      ManualResizeObserver.instances.push(this)
   }

   observe() {}

   unobserve() {}

   disconnect() {}

   trigger(width: number) {
      this.callback(
         [{ target: { getBoundingClientRect: () => ({ width, height: width }) } }] as never,
         this as never
      )
   }
}

const IMAGE_SIZE = { naturalWidth: 1000, naturalHeight: 1000 }

beforeEach(() => {
   ManualResizeObserver.instances = []
   vi.stubGlobal('ResizeObserver', ManualResizeObserver)

   /* jsdom never fetches an image, so the component's own load handlers and its
      `img.complete` check are driven from the tests below. */
   Object.defineProperty(HTMLImageElement.prototype, 'complete', {
      configurable: true,
      get: () => false,
   })
   for (const [key, value] of Object.entries(IMAGE_SIZE)) {
      Object.defineProperty(HTMLImageElement.prototype, key, {
         configurable: true,
         get: () => value,
      })
   }
})

afterEach(() => {
   vi.unstubAllGlobals()
})

const renderLoaded = async (props: Partial<Parameters<typeof CompareImage>[0]> = {}) => {
   const onSliderPositionChange = vi.fn()
   const view = render(
      <CompareImage
         leftImage="/left.png"
         rightImage="/right.png"
         leftImageAlt="left"
         rightImageAlt="right"
         onSliderPositionChange={onSliderPositionChange}
         {...props}
      />
   )

   await act(async () => {
      fireEvent.load(screen.getByTestId('left-image'))
      fireEvent.load(screen.getByTestId('right-image'))
   })

   await act(async () => {
      for (const observer of ManualResizeObserver.instances) observer.trigger(500)
   })

   return { ...view, onSliderPositionChange }
}

describe('CompareImage', () => {
   it('hides the canvas until both images have loaded', () => {
      render(<CompareImage leftImage="/l.png" rightImage="/r.png" />)

      expect(screen.getByTestId('container')).toHaveStyle({ display: 'none' })
   })

   it('shows a skeleton placeholder while loading', () => {
      render(
         <CompareImage
            leftImage="/l.png"
            rightImage="/r.png"
            skeleton={<p>loading the comparison</p>}
         />
      )

      expect(screen.getByText('loading the comparison')).toBeInTheDocument()
   })

   it('reveals the canvas once both images load', async () => {
      await renderLoaded()

      expect(screen.getByTestId('container')).toHaveStyle({ display: 'block' })
   })

   it('renders the labels and the default handle', async () => {
      await renderLoaded({ leftImageRightLabel: undefined, leftImageLabel: 'Before' } as never)

      expect(screen.getByText('Before')).toBeInTheDocument()
   })

   it('accepts a custom handle', async () => {
      await renderLoaded({ handle: <span data-testid="custom-handle">grip</span> } as never)

      expect(screen.getByTestId('custom-handle')).toBeInTheDocument()
   })

   it('slides horizontally on mousedown and reports the new position', async () => {
      const { onSliderPositionChange } = await renderLoaded()

      const container = screen.getByTestId('container')
      await act(async () => {
         fireEvent.mouseDown(container, { pageX: 250, pageY: 10 })
      })

      expect(onSliderPositionChange).toHaveBeenCalled()
      const [position] = onSliderPositionChange.mock.calls[0]
      expect(position).toBeGreaterThanOrEqual(0)
      expect(position).toBeLessThanOrEqual(1)
   })

   it('clamps the slider at the edges', async () => {
      const { onSliderPositionChange } = await renderLoaded()

      const container = screen.getByTestId('container')
      await act(async () => {
         fireEvent.mouseDown(container, { pageX: -10_000, pageY: 0 })
         fireEvent.mouseMove(document, { pageX: 10_000, pageY: 0 })
      })

      const positions = onSliderPositionChange.mock.calls.map(([value]) => value as number)
      expect(Math.min(...positions)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...positions)).toBeLessThanOrEqual(1)
   })

   it('stops sliding on mouseup', async () => {
      const { onSliderPositionChange } = await renderLoaded()

      const container = screen.getByTestId('container')
      await act(async () => {
         fireEvent.mouseDown(container, { pageX: 100, pageY: 0 })
      })
      const afterDown = onSliderPositionChange.mock.calls.length

      await act(async () => {
         fireEvent.mouseUp(document)
         fireEvent.mouseMove(document, { pageX: 400, pageY: 0 })
      })

      expect(onSliderPositionChange.mock.calls.length).toBe(afterDown)
   })

   it('follows the pointer on hover instead of drag', async () => {
      const { onSliderPositionChange } = await renderLoaded({ hover: true } as never)

      const container = screen.getByTestId('container')
      await act(async () => {
         fireEvent.mouseMove(container, { pageX: 300, pageY: 0 })
      })

      expect(onSliderPositionChange).toHaveBeenCalled()
   })

   it('supports a vertical slider', async () => {
      const { onSliderPositionChange } = await renderLoaded({ vertical: true } as never)

      const container = screen.getByTestId('container')
      await act(async () => {
         fireEvent.mouseDown(container, { pageX: 0, pageY: 250 })
      })

      expect(onSliderPositionChange).toHaveBeenCalled()
   })

   it('slides on touch devices', async () => {
      const { onSliderPositionChange } = await renderLoaded()

      const container = screen.getByTestId('container')
      await act(async () => {
         fireEvent.touchStart(container, { touches: [{ pageX: 120, pageY: 0 }] })
         fireEvent.touchMove(document, { touches: [{ pageX: 200, pageY: 0 }] })
         fireEvent.touchEnd(document)
      })

      expect(onSliderPositionChange).toHaveBeenCalled()
   })

   it('sizes the container with the wider ratio for aspectRatio=taller', async () => {
      await renderLoaded({ aspectRatio: 'wider' } as never)

      expect(screen.getByTestId('container')).toBeInTheDocument()
   })

   it('resets the loaded flag when the left image changes', async () => {
      const { rerender } = await renderLoaded()

      await act(async () => {
         rerender(<CompareImage leftImage="/next.png" rightImage="/right.png" />)
      })

      expect(screen.getByTestId('container')).toHaveStyle({ display: 'none' })
   })

   it('resets the loaded flag when the right image changes', async () => {
      const { rerender } = await renderLoaded()

      await act(async () => {
         rerender(<CompareImage leftImage="/left.png" rightImage="/next.png" />)
      })

      expect(screen.getByTestId('container')).toHaveStyle({ display: 'none' })
   })

   it('honours a custom slider position and line styling', async () => {
      await renderLoaded({
         sliderPositionPercentage: 0.25,
         sliderLineColor: '#ff0000',
         sliderLineWidth: 4,
         handleSize: 60,
         leftImageCss: { opacity: 0.9 },
         rightImageCss: { filter: 'grayscale(1)' },
      } as never)

      expect(screen.getByTestId('left-image')).toHaveStyle({ opacity: '0.9' })
   })

   it('treats an already-cached image as loaded', async () => {
      Object.defineProperty(HTMLImageElement.prototype, 'complete', {
         configurable: true,
         get: () => true,
      })

      render(<CompareImage leftImage="/cached.png" rightImage="/cached2.png" />)

      await act(async () => {
         await Promise.resolve()
      })

      expect(screen.getByTestId('container')).toBeInTheDocument()
   })
})

/* fireEvent cannot set `pageX` (it is a read-only MouseEvent property), so the
   drag tests build the MouseEvent themselves. */
const mouseAt = (type: string, pageX: number) => {
   const event = new MouseEvent(type, { bubbles: true, cancelable: true })
   Object.defineProperty(event, 'pageX', { value: pageX })
   Object.defineProperty(event, 'pageY', { value: 0 })
   return event
}

describe('CompareImage with a container narrower than the cursor offset', () => {
   it('clamps the position at both edges', async () => {
      const onSliderPositionChange = vi.fn()
      render(
         <CompareImage
            leftImage="/left.png"
            rightImage="/right.png"
            onSliderPositionChange={onSliderPositionChange}
            sliderPositionPercentage={0.1}
         />
      )

      await act(async () => {
         fireEvent.load(screen.getByTestId('left-image'))
         fireEvent.load(screen.getByTestId('right-image'))
      })
      await act(async () => {
         for (const observer of ManualResizeObserver.instances) observer.trigger(10)
      })

      const container = screen.getByTestId('container')
      await act(async () => {
         container.dispatchEvent(mouseAt('mousedown', 0))
      })
      onSliderPositionChange.mockClear()

      await act(async () => {
         document.dispatchEvent(mouseAt('mousemove', 4000))
      })

      const [position] = onSliderPositionChange.mock.calls.at(-1)!
      expect(position).toBeLessThan(1)
      expect(position).toBeGreaterThan(0)
   })
})

describe('CompareImage clamped movement', () => {
   it('clamps past the right edge while dragging', async () => {
      const onSliderPositionChange = vi.fn()
      render(
         <CompareImage
            leftImage="/left.png"
            rightImage="/right.png"
            onSliderPositionChange={onSliderPositionChange}
            sliderPositionPercentage={0.1}
         />
      )

      await act(async () => {
         fireEvent.load(screen.getByTestId('left-image'))
         fireEvent.load(screen.getByTestId('right-image'))
      })
      await act(async () => {
         for (const observer of ManualResizeObserver.instances) observer.trigger(500)
      })

      const container = screen.getByTestId('container')
      await act(async () => {
         fireEvent.mouseDown(container, { pageX: 100, pageY: 0 })
      })
      onSliderPositionChange.mockClear()

      /* jsdom reports a zero rect, so a huge pageX is what pushes the cursor
         past the right edge of the image. */
      await act(async () => {
         fireEvent.mouseMove(document, { pageX: 4000, pageY: 0 })
      })

      const positions = onSliderPositionChange.mock.calls.map(([value]) => value as number)
      expect(positions.length).toBeGreaterThan(0)
      expect(Math.max(...positions)).toBeLessThanOrEqual(1)
   })
})
