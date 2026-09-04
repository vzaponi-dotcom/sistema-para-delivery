const EXTENDED = new Map([
  ['Ç', 0x80], ['ü', 0x81], ['é', 0x82], ['â', 0x83], ['ã', 0x84], ['à', 0x85], ['Á', 0x86], ['ç', 0x87],
  ['ê', 0x88], ['Ê', 0x89], ['è', 0x8a], ['Í', 0x8b], ['Ô', 0x8c], ['ì', 0x8d], ['Ã', 0x8e], ['Â', 0x8f],
  ['É', 0x90], ['À', 0x91], ['È', 0x92], ['ô', 0x93], ['õ', 0x94], ['ò', 0x95], ['Ú', 0x96], ['ù', 0x97],
  ['Ì', 0x98], ['Õ', 0x99], ['Ü', 0x9a], ['¢', 0x9b], ['£', 0x9c], ['Ù', 0x9d], ['Ó', 0x9f],
  ['á', 0xa0], ['í', 0xa1], ['ó', 0xa2], ['ú', 0xa3], ['ñ', 0xa4], ['Ñ', 0xa5], ['ª', 0xa6], ['º', 0xa7],
  ['¿', 0xa8], ['Ò', 0xa9], ['¬', 0xaa], ['½', 0xab], ['¼', 0xac], ['¡', 0xad], ['«', 0xae], ['»', 0xaf],
  ['°', 0xf8], ['²', 0xfd], ['\u00a0', 0xff],
])

const ASCII_REPLACEMENTS = new Map([
  ['–', '-'], ['—', '-'], ['‘', "'"], ['’', "'"], ['“', '"'], ['”', '"'], ['…', '...'],
])

export const encodeCp860 = (value) => {
  const bytes = []
  for (const rawCharacter of String(value ?? '')) {
    const replacement = ASCII_REPLACEMENTS.get(rawCharacter)
    if (replacement) {
      bytes.push(...encodeCp860(replacement))
      continue
    }
    const codePoint = rawCharacter.codePointAt(0)
    if (codePoint <= 0x7f) {
      bytes.push(codePoint)
      continue
    }
    bytes.push(EXTENDED.get(rawCharacter) ?? 0x3f)
  }
  return Uint8Array.from(bytes)
}
