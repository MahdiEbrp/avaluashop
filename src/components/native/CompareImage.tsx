'use client'

import Image from 'next/image'
import React, { useEffect, useRef, useState } from 'react'

/* A no-op default for the optional slider callback, so the prop can be called
   unconditionally from the drag handler. */
const noop = () => {
   /* the slider callback is optional */
}

interface IProps {
   aspectRatio?: 'taller' | 'wider'
   handle?: React.ReactNode
   handleSize?: number
   hover?: boolean
   leftImage: string
   leftImageAlt?: string
   leftImageCss?: object
   leftImageLabel?: string
   onSliderPositionChange?: (position: number) => void
   rightImage: string
   rightImageAlt?: string
   rightImageCss?: object
   rightImageLabel?: string
   skeleton?: React.ReactNode
   sliderLineColor?: string
   sliderLineWidth?: number
   sliderPositionPercentage?: number
   vertical?: boolean
}

/* Every geometric value below is either the horizontal or the vertical variant
   of the same measurement. Folding the two axes through one helper keeps the
   styles readable and the component's cognitive complexity honest. */
function onAxis<T>(horizontal: boolean, horizontalValue: T, verticalValue: T) {
   return horizontal ? horizontalValue : verticalValue
}

function buildStyles(input: {
   horizontal: boolean
   hover: boolean
   isSliding: boolean
   containerWidth: number
   containerHeight: number
   sliderPosition: number
   handleSize: number
   sliderLineWidth: number
   sliderLineColor: string
   leftImageCss: object
   rightImageCss: object
}): Record<string, React.CSSProperties> {
   const {
      horizontal,
      hover,
      isSliding,
      containerWidth,
      containerHeight,
      sliderPosition,
      handleSize,
      sliderLineWidth,
      sliderLineColor,
      leftImageCss,
      rightImageCss,
   } = input

   return {
      container: {
         boxSizing: 'border-box',
         position: 'relative',
         width: '100%',
         height: `${containerHeight}px`,
         overflow: 'hidden',
      },
      rightImage: {
         clipPath: onAxis(
            horizontal,
            `inset(0 0 0 ${containerWidth * sliderPosition}px)`,
            `inset(${containerHeight * sliderPosition}px 0 0 0)`
         ),
         display: 'block',
         height: '100%',
         objectFit: 'cover',
         position: 'absolute',
         width: '100%',
         ...rightImageCss,
      },
      leftImage: {
         clipPath: onAxis(
            horizontal,
            `inset(0 calc(100% - ${containerWidth * sliderPosition}px) 0 0)`,
            `inset(0 0 calc(100% - ${containerHeight * sliderPosition}px) 0)`
         ),
         display: 'block',
         height: '100%',
         objectFit: 'cover',
         position: 'absolute',
         width: '100%',
         ...leftImageCss,
      },
      slider: {
         alignItems: 'center',
         cursor:
            (!hover && horizontal && 'ew-resize') ||
            (!hover && !horizontal && 'ns-resize'),
         display: 'flex',
         flexDirection: onAxis(horizontal, 'column', 'row'),
         height: onAxis(horizontal, '100%', `${handleSize}px`),
         justifyContent: 'center',
         left: onAxis<string | number>(
            horizontal,
            `${containerWidth * sliderPosition - handleSize / 2}px`,
            0
         ),
         position: 'absolute',
         top: onAxis<string | number>(
            horizontal,
            0,
            `${containerHeight * sliderPosition - handleSize / 2}px`
         ),
         width: onAxis(horizontal, `${handleSize}px`, '100%'),
      },
      line: {
         background: sliderLineColor,
         boxShadow:
            '0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12)',
         flex: '0 1 auto',
         height: onAxis(horizontal, '100%', `${sliderLineWidth}px`),
         width: onAxis(horizontal, `${sliderLineWidth}px`, '100%'),
      },
      handleCustom: {
         alignItems: 'center',
         boxSizing: 'border-box',
         display: 'flex',
         flex: '1 0 auto',
         height: 'auto',
         justifyContent: 'center',
         width: 'auto',
      },
      handleDefault: {
         alignItems: 'center',
         border: `${sliderLineWidth}px solid ${sliderLineColor}`,
         borderRadius: '100%',
         boxShadow:
            '0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12)',
         boxSizing: 'border-box',
         display: 'flex',
         flex: '1 0 auto',
         height: `${handleSize}px`,
         justifyContent: 'center',
         width: `${handleSize}px`,
         transform: onAxis(horizontal, 'none', 'rotate(90deg)'),
      },
      leftArrow: {
         border: `inset ${handleSize * 0.15}px rgba(0,0,0,0)`,
         borderRight: `${handleSize * 0.15}px solid ${sliderLineColor}`,
         height: '0px',
         marginLeft: `-${handleSize * 0.25}px`, // for IE11
         marginRight: `${handleSize * 0.25}px`,
         width: '0px',
      },
      rightArrow: {
         border: `inset ${handleSize * 0.15}px rgba(0,0,0,0)`,
         borderLeft: `${handleSize * 0.15}px solid ${sliderLineColor}`,
         height: '0px',
         marginRight: `-${handleSize * 0.25}px`, // for IE11
         width: '0px',
      },
      leftLabel: {
         background: 'rgba(0, 0, 0, 0.5)',
         color: 'white',
         left: onAxis(horizontal, '5%', '50%'),
         opacity: isSliding ? 0 : 1,
         padding: '10px 20px',
         position: 'absolute',
         top: onAxis(horizontal, '50%', '3%'),
         transform: onAxis(
            horizontal,
            'translate(0,-50%)',
            'translate(-50%, 0)'
         ),
         transition: 'opacity 0.1s ease-out',
      },
      rightLabel: {
         background: 'rgba(0, 0, 0, 0.5)',
         color: 'white',
         opacity: isSliding ? 0 : 1,
         padding: '10px 20px',
         position: 'absolute',
         left: onAxis(horizontal, null, '50%'),
         right: onAxis(horizontal, '5%', null),
         top: onAxis(horizontal, '50%', null),
         bottom: onAxis(horizontal, null, '3%'),
         transform: onAxis(
            horizontal,
            'translate(0,-50%)',
            'translate(-50%, 0)'
         ),
         transition: 'opacity 0.1s ease-out',
      },
      leftLabelContainer: {
         clipPath: onAxis(
            horizontal,
            `inset(0 calc(100% - ${containerWidth * sliderPosition}px) 0 0)`,
            `inset(0 0 calc(100% - ${containerHeight * sliderPosition}px) 0)`
         ),
         height: '100%',
         position: 'absolute',
         width: '100%',
      },
      rightLabelContainer: {
         clipPath: onAxis(
            horizontal,
            `inset(0 0 0 ${containerWidth * sliderPosition}px)`,
            `inset(${containerHeight * sliderPosition}px 0 0 0)`
         ),
         height: '100%',
         position: 'absolute',
         width: '100%',
      },
   }
}

const CompareImage: React.FC<IProps> = (props) => {
   const {
      aspectRatio = 'taller',
      handle = null,
      handleSize = 40,
      hover = false,
      leftImage,
      leftImageAlt = '',
      leftImageCss = {},
      leftImageLabel = null,
      onSliderPositionChange = noop,
      rightImage,
      rightImageAlt = '',
      rightImageCss = {},
      rightImageLabel = null,
      skeleton = null,
      sliderLineColor = '#ffffff',
      sliderLineWidth = 2,
      sliderPositionPercentage = 0.5,
      vertical = false,
   } = props

   const horizontal = !vertical

   // 0 to 1
   const [sliderPosition, setSliderPosition] = useState<number>(
      sliderPositionPercentage
   )
   const [containerWidth, setContainerWidth] = useState<number>(0)
   const [containerHeight, setContainerHeight] = useState<number>(0)
   const [leftImgLoaded, setLeftImgLoaded] = useState<boolean>(false)
   const [rightImgLoaded, setRightImgLoaded] = useState<boolean>(false)
   const [isSliding, setIsSliding] = useState<boolean>(false)

   const containerRef = useRef(null)
   const rightImageRef = useRef(null)
   const leftImageRef = useRef(null)

   // make the component responsive
   useEffect(() => {
      const containerElement = containerRef.current
      const resizeObserver = new ResizeObserver(([entry, ..._]) => {
         const currentContainerWidth =
            entry.target.getBoundingClientRect().width
         setContainerWidth(currentContainerWidth)
      })
      resizeObserver.observe(containerElement)

      return () => {
         resizeObserver.disconnect()
      }
   }, [])

   useEffect(() => {
      // consider the case where loading image is completed immediately
      // due to the cache etc.
      const alreadyDone = leftImageRef.current.complete

      if (alreadyDone) setLeftImgLoaded(true)

      return () => {
         // when the left image source is changed
         setLeftImgLoaded(false)
      }
   }, [leftImage])

   useEffect(() => {
      // consider the case where loading image is completed immediately
      // due to the cache etc.
      const alreadyDone = rightImageRef.current.complete

      if (alreadyDone) setRightImgLoaded(true)

      return () => {
         // when the right image source is changed
         setRightImgLoaded(false)
      }
   }, [rightImage])

   const allImagesLoaded = rightImgLoaded && leftImgLoaded

   useEffect(() => {
      const handleSliding = (event) => {
         const e = event

         // Calc cursor position from the:
         // - left edge of the viewport (for horizontal)
         // - top edge of the viewport (for vertical)
         const cursorXfromViewport = e.touches ? e.touches[0].pageX : e.pageX
         const cursorYfromViewport = e.touches ? e.touches[0].pageY : e.pageY

         // Calc Cursor Position from the:
         // - left edge of the window (for horizontal)
         // - top edge of the window (for vertical)
         // to consider any page scrolling
         const cursorXfromWindow = cursorXfromViewport - window.pageXOffset
         const cursorYfromWindow = cursorYfromViewport - window.pageYOffset

         // Calc Cursor Position from the:
         // - left edge of the image(for horizontal)
         // - top edge of the image(for vertical)
         const imagePosition = rightImageRef.current.getBoundingClientRect()
         let pos = horizontal
            ? cursorXfromWindow - imagePosition.left
            : cursorYfromWindow - imagePosition.top

         // Set minimum and maximum values to prevent the slider from overflowing
         const minPos = 0 + sliderLineWidth / 2
         const maxPos = horizontal
            ? containerWidth - sliderLineWidth / 2
            : containerHeight - sliderLineWidth / 2

         if (pos < minPos) pos = minPos
         if (pos > maxPos) pos = maxPos

         if (horizontal) {
            setSliderPosition(pos / containerWidth)
         } else {
            setSliderPosition(pos / containerHeight)
         }

         // If there's a callback function, invoke it everytime the slider changes
         if (horizontal) {
            onSliderPositionChange(pos / containerWidth)
         } else {
            onSliderPositionChange(pos / containerHeight)
         }
      }

      const startSliding = (e) => {
         setIsSliding(true)

         // Prevent default behavior other than mobile scrolling
         if (!('touches' in e)) {
            e.preventDefault()
         }

         // Slide the image even if you just click or tap (not drag)
         handleSliding(e)

         globalThis.addEventListener('mousemove', handleSliding) // 07
         globalThis.addEventListener('touchmove', handleSliding) // 08
      }

      const finishSliding = () => {
         setIsSliding(false)
         globalThis.removeEventListener('mousemove', handleSliding)
         globalThis.removeEventListener('touchmove', handleSliding)
      }

      const containerElement = containerRef.current

      if (allImagesLoaded) {
         // it's necessary to reset event handlers each time the canvasWidth changes

         // for mobile
         containerElement.addEventListener('touchstart', startSliding) // 01
         globalThis.addEventListener('touchend', finishSliding) // 02

         // for desktop
         if (hover) {
            containerElement.addEventListener('mousemove', handleSliding) // 03
            containerElement.addEventListener('mouseleave', finishSliding) // 04
         } else {
            containerElement.addEventListener('mousedown', startSliding) // 05
            globalThis.addEventListener('mouseup', finishSliding) // 06
         }

         // calc and set the container's size
         const leftImageWidthHeightRatio =
            leftImageRef.current.naturalHeight /
            leftImageRef.current.naturalWidth
         const rightImageWidthHeightRatio =
            rightImageRef.current.naturalHeight /
            rightImageRef.current.naturalWidth

         const idealWidthHeightRatio =
            aspectRatio === 'taller'
               ? Math.max(leftImageWidthHeightRatio, rightImageWidthHeightRatio)
               : Math.min(leftImageWidthHeightRatio, rightImageWidthHeightRatio)

         const idealContainerHeight = containerWidth * idealWidthHeightRatio

         setContainerHeight(idealContainerHeight)
      }

      return () => {
         // cleanup all event resteners
         containerElement.removeEventListener('touchstart', startSliding) // 01
         globalThis.removeEventListener('touchend', finishSliding) // 02
         containerElement.removeEventListener('mousemove', handleSliding) // 03
         containerElement.removeEventListener('mouseleave', finishSliding) // 04
         containerElement.removeEventListener('mousedown', startSliding) // 05
         globalThis.removeEventListener('mouseup', finishSliding) // 06
         globalThis.removeEventListener('mousemove', handleSliding) // 07
         globalThis.removeEventListener('touchmove', handleSliding) // 08
      }
   }, [
      allImagesLoaded,
      aspectRatio,
      containerHeight,
      containerWidth,
      horizontal,
      hover,
      onSliderPositionChange,
      sliderLineWidth,
      vertical,
   ])

   const styles = buildStyles({
      horizontal,
      hover,
      isSliding,
      containerWidth,
      containerHeight,
      sliderPosition,
      handleSize,
      sliderLineWidth,
      sliderLineColor,
      leftImageCss,
      rightImageCss,
   })

   return (
      <>
         {skeleton && !allImagesLoaded && (
            <div style={{ ...styles.container }}>{skeleton}</div>
         )}

         <div
            className="rounded-md"
            style={{
               ...styles.container,
               display: allImagesLoaded ? 'block' : 'none',
            }}
            ref={containerRef}
            data-testid="container"
         >
            <Image
               onLoad={() => {
                  setRightImgLoaded(true)
               }}
               alt={rightImageAlt}
               data-testid="right-image"
               ref={rightImageRef}
               src={rightImage}
               style={styles.rightImage}
               fill
               sizes="100vw"
            />
            <Image
               onLoad={() => {
                  setLeftImgLoaded(true)
               }}
               alt={leftImageAlt}
               data-testid="left-image"
               ref={leftImageRef}
               src={leftImage}
               style={styles.leftImage}
               fill
               sizes="100vw"
            />
            <div style={styles.slider}>
               <div style={styles.line} />
               {handle ? (
                  <div style={styles.handleCustom}>{handle}</div>
               ) : (
                  <div style={styles.handleDefault}>
                     <div style={styles.leftArrow} />
                     <div style={styles.rightArrow} />
                  </div>
               )}
               <div style={styles.line} />
            </div>
            {/* labels */}
            {leftImageLabel && (
               <div style={styles.leftLabelContainer}>
                  <div style={styles.leftLabel}>{leftImageLabel}</div>
               </div>
            )}
            {rightImageLabel && (
               <div style={styles.rightLabelContainer}>
                  <div style={styles.rightLabel}>{rightImageLabel}</div>
               </div>
            )}
         </div>
      </>
   )
}

export default CompareImage
