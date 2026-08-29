import { useId } from 'react'
import type { SVGProps } from 'react'

/**
 * Xiaoyu's product mark. The logo inherits `currentColor` so brand surfaces can
 * use the approved black or product-blue variants without duplicating assets.
 */
export function FishLogo(props: SVGProps<SVGSVGElement>) {
  const maskId = `xiaoyu-logo-${useId().replace(/:/g, '')}`

  return (
    <svg
      viewBox="100 320 1060 610"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1254"
          height="1254"
          style={{ maskType: 'alpha' }}
        >
          <image href="/xiaoyu-logo-source.png" width="1254" height="1254" />
        </mask>
      </defs>
      <rect x="0" y="0" width="1254" height="1254" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  )
}
