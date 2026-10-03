import { useContextBlob } from '../../infrastructure/api/useContextBlob.js'
import { useEffect, useMemo, useState } from 'react'

export const operationLogoUrl = (hasLogo, version) => {
  if (!hasLogo || typeof version !== 'string' || !version || version.startsWith('local:')) return null
  return `/api/business/logo?v=${encodeURIComponent(version)}`
}

export default function OperationLogo({
  hasLogo = false,
  version = null,
  className = '',
  fallback = null,
}) {
  const path = useMemo(() => operationLogoUrl(hasLogo, version), [hasLogo, version])
  const src = useContextBlob(path)
  const [failedSrc, setFailedSrc] = useState(null)

  useEffect(() => {
    if (failedSrc && failedSrc !== src) setFailedSrc(null)
  }, [failedSrc, src])

  if (!src || failedSrc === src) return fallback
  return <img className={className} src={src} alt="" aria-hidden="true" onError={() => setFailedSrc(src)} />
}
