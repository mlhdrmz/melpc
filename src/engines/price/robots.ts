// Basit robots.txt denetimi: yalnızca "User-agent: *" grubundaki Allow/Disallow kuralları.
// Kural eşleştirmesi Google'ın yaptığı gibidir: en uzun eşleşen kural kazanır, eşitlikte Allow.

export interface RobotsRule {
  allow: boolean
  pattern: string
}

export function parseRobots(text: string): RobotsRule[] {
  const rules: RobotsRule[] = []
  let inStarGroup = false
  let lastWasAgent = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (key === 'user-agent') {
      // Art arda gelen user-agent satırları aynı grubu oluşturur.
      inStarGroup = lastWasAgent ? inStarGroup || value === '*' : value === '*'
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!inStarGroup) continue
    if ((key === 'allow' || key === 'disallow') && value) rules.push({ allow: key === 'allow', pattern: value })
  }
  return rules
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$')
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp('^' + body + (anchored ? '$' : ''))
}

/** path: "/urun/123?x=1" gibi yol + sorgu. */
export function isAllowed(rules: RobotsRule[], path: string): boolean {
  let best: RobotsRule | null = null
  for (const r of rules) {
    if (!patternToRegex(r.pattern).test(path)) continue
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r
  }
  return best ? best.allow : true
}
