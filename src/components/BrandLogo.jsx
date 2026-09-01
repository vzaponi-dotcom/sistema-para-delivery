import { useId } from 'react'

const BrandLogo = ({ variant = 'full', className = '' }) => {
  const uid = useId().replace(/:/g, '')
  const redId = `red-${uid}`
  const silverId = `silver-${uid}`
  const ribbonId = `ribbon-${uid}`

  const mark = (
    <svg
      viewBox="0 0 260 260"
      className={className}
      role="img"
      aria-label="Logo Amor e Sabor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={redId} x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#d81c2a" />
          <stop offset="100%" stopColor="#a90d1e" />
        </linearGradient>
        <linearGradient id={silverId} x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#f9f9f9" />
          <stop offset="50%" stopColor="#dfe4ea" />
          <stop offset="100%" stopColor="#a7afb9" />
        </linearGradient>
      </defs>

      <circle cx="130" cy="130" r="124" fill={`url(#${redId})`} />

      <path
        d="M40 108c0-49 36-84 82-84 46 0 82 35 82 84 0 0 0 14 10 24 10 10 16 14 16 14H24s6-4 16-14c10-10 10-24 10-24Z"
        fill="#f6f3f0"
      />
      <path d="M22 136h216c0 0 12 17 12 33v13H10v-13c0-16 12-33 12-33Z" fill="#f0efe9" />

      <g fill={`url(#${silverId})`}>
        <rect x="65" y="110" width="18" height="76" rx="9" />
        <ellipse cx="74" cy="106" rx="18" ry="13" />

        <rect x="96" y="110" width="18" height="76" rx="9" />
        <ellipse cx="105" cy="106" rx="18" ry="13" />

        <rect x="127" y="110" width="18" height="76" rx="9" />
        <ellipse cx="136" cy="106" rx="18" ry="13" />

        <path d="M163 103h18v92c0 11-9 20-20 20s-20-9-20-20v-8c0-7 6-13 13-13s13 6 13 13v8c0 2 2 4 4 4s4-2 4-4v-92Z" />
        <path d="M191 103h18v92c0 11-9 20-20 20s-20-9-20-20v-8c0-7 6-13 13-13s13 6 13 13v8c0 2 2 4 4 4s4-2 4-4v-92Z" />
        <path d="M219 103h18v92c0 11-9 20-20 20s-20-9-20-20v-8c0-7 6-13 13-13s13 6 13 13v8c0 2 2 4 4 4s4-2 4-4v-92Z" />
      </g>

      <path d="M48 178h164c-7 19-22 33-47 39H95c-25-6-40-20-47-39Z" fill="#e7eaee" opacity="0.9" />
    </svg>
  )

  if (variant === 'mark') {
    return mark
  }

  return (
    <svg
      viewBox="0 0 820 260"
      className={className}
      role="img"
      aria-label="Logo Amor e Sabor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={ribbonId} x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#e73d47" />
          <stop offset="100%" stopColor="#b81025" />
        </linearGradient>
      </defs>

      <g transform="translate(0 0)">
        {mark}
      </g>

      <g transform="translate(285 34)">
        <path d="M0 82h420c19 0 35 15 35 34v8c0 18-16 34-35 34H0c-19 0-35-16-35-34v-8c0-19 16-34 35-34Z" fill={`url(#${ribbonId})`} />
        <text x="210" y="116" textAnchor="middle" fontSize="49" fontWeight="700" fill="#fffaf7" fontFamily="Georgia, 'Times New Roman', serif" letterSpacing="1.2">Amor &amp; Sabor</text>
        <text x="210" y="151" textAnchor="middle" fontSize="20" fontWeight="600" fill="#ffeae1" fontFamily="Georgia, 'Times New Roman', serif" letterSpacing="2.2">comida caseira</text>
      </g>
    </svg>
  )
}

export default BrandLogo
