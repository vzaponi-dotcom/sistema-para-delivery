import { useId } from 'react'

const BrandLogo = ({ variant = 'full', className = '' }) => {
  const uid = useId().replace(/:/g, '')
  const redId = `brand-red-${uid}`
  const silverId = `brand-silver-${uid}`

  const defs = (
    <defs>
      <linearGradient id={redId} x1="18%" y1="10%" x2="82%" y2="92%">
        <stop offset="0%" stopColor="#ef233c" />
        <stop offset="55%" stopColor="#c9182b" />
        <stop offset="100%" stopColor="#9e1021" />
      </linearGradient>
      <linearGradient id={silverId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="38%" stopColor="#e7e7e7" />
        <stop offset="72%" stopColor="#a9aaad" />
        <stop offset="100%" stopColor="#f8f8f8" />
      </linearGradient>
    </defs>
  )

  const mark = (
    <g>
      <circle cx="64" cy="64" r="60" fill={`url(#${redId})`} />
      <circle cx="64" cy="64" r="55.5" fill="none" stroke="#fff" strokeWidth="3.5" opacity="0.96" />

      <path
        d="M36 62V48c-8.2-1.9-14.2-9.2-14.2-18 0-10.1 8.1-18.2 18.2-18.2 3.2 0 6.2.8 8.8 2.3C52.3 7.4 59.3 3 67.3 3c9.4 0 17.4 6 20.4 14.4a20.2 20.2 0 0 1 8-1.7c11.2 0 20.3 9.1 20.3 20.3 0 10.4-7.8 19-17.9 20.2V62H36Z"
        fill="#fff"
      />
      <path d="M36 59h62v32H36z" fill="#fff" />

      <g fill={`url(#${silverId})`} stroke="#97989b" strokeWidth="0.65">
        <ellipse cx="50.2" cy="57" rx="7.2" ry="11.2" />
        <path d="M48.2 67.7h4v19h-4z" />

        <path d="M62.4 45.5h2v17.8h-2zM66.2 45.5h2v17.8h-2zM70 45.5h2v17.8h-2zM73.8 45.5h2v17.8h-2z" />
        <path d="M64 60h10.2v7.5c0 2.7-2.2 4.8-4.8 4.8h-.6c-2.7 0-4.8-2.2-4.8-4.8V60Z" />
        <path d="M67.4 70.8h3.8v16h-3.8z" />

        <path d="M84 45.5c5.7 4.5 8.7 11.9 7.8 19.8l-2 21.5h-5.1V45.5H84Z" />
      </g>

      <path d="M27 91c11.7-3.1 24-4.6 37-4.6s25.3 1.5 37 4.6v9.2c-11.9-2.6-24.3-3.9-37-3.9s-25.1 1.3-37 3.9V91Z" fill={`url(#${redId})`} stroke="#fff" strokeWidth="2.2" />
    </g>
  )

  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 128 128"
        className={className}
        role="img"
        aria-label="Amor & Sabor"
        xmlns="http://www.w3.org/2000/svg"
      >
        {defs}
        {mark}
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 520 128"
      className={className}
      role="img"
      aria-label="Amor & Sabor — comida caseira"
      xmlns="http://www.w3.org/2000/svg"
    >
      {defs}
      {mark}
      <g transform="translate(145 0)">
        <text
          x="0"
          y="58"
          fill="#25211f"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="43"
          fontWeight="700"
          letterSpacing="-1.2"
        >
          Amor <tspan fill="#c9182b">&amp;</tspan> Sabor
        </text>
        <rect x="1" y="73" width="54" height="3" rx="1.5" fill={`url(#${redId})`} />
        <text
          x="67"
          y="82"
          fill="#716863"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="21"
          fontStyle="italic"
        >
          comida caseira
        </text>
      </g>
    </svg>
  )
}

export default BrandLogo
