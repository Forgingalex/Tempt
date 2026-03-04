import * as React from 'react'

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

export function TempoMark({ size = 24, ...props }: LogoProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M4 4h24v6H19v18h-6V10H4V4z" fill="currentColor" />
    </svg>
  )
}

export function TempoWordmark({ height = 20, ...props }: Omit<LogoProps, 'size'> & { height?: number }): React.ReactElement {
  return (
    <svg
      height={height}
      viewBox="0 0 120 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* T */}
      <path d="M0 4h20v5H13v19h-5V9H0V4z" fill="currentColor" />
      {/* E */}
      <path d="M24 4h16v5H29v5h9v5h-9v4h11v5H24V4z" fill="currentColor" />
      {/* M */}
      <path d="M44 4h7l5 12 5-12h7v24h-5V12l-5 11h-4l-5-11v16h-5V4z" fill="currentColor" />
      {/* P */}
      <path d="M76 4h11c4 0 7 3 7 7s-3 7-7 7h-6v10h-5V4zm5 9h5c1.5 0 2.5-1 2.5-2.5S87.5 8 86 8h-5v5z" fill="currentColor" />
      {/* T */}
      <path d="M98 4h20v5h-7.5v19h-5V9H98V4z" fill="currentColor" />
    </svg>
  )
}
