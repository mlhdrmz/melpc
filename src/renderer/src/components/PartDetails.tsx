import type { ReactElement } from 'react'
import type { Part } from '@engines/catalog/types'
import { CATEGORY_LABELS, formatSpecValue, SPEC_DEFS } from '@engines/catalog/specDefs'
import { partName } from '@engines/catalog/access'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** Bir parçanın bütün teknik özellikleri; her değerin yanında kaynağı ve alınma tarihi. */
export function PartDetails({ part }: { part: Part }): ReactElement {
  const defs = SPEC_DEFS[part.category].filter((d) => d.key in part.specs)
  return (
    <div className="details">
      <span className="details__eyebrow">{CATEGORY_LABELS[part.category].toLocaleUpperCase('tr-TR')}</span>
      <h3 className="details__name">{partName(part)}</h3>
      {part.mpn && <span className="details__mpn">Üretici kodu: {part.mpn}</span>}
      <span className="details__price">Fiyat: henüz yok</span>
      <table className="spec-table">
        <tbody>
          {defs.map((def) => {
            const spec = part.specs[def.key]
            const unknown = spec.value === null
            return (
              <tr key={def.key}>
                <th scope="row">{def.label}</th>
                <td>
                  <span className={unknown ? 'spec-table__unknown' : 'spec-table__value'}>
                    {formatSpecValue(def, spec.value)}
                  </span>
                  {spec.note && <span className="spec-table__note">{spec.note}</span>}
                  {spec.source && (
                    <a className="spec-table__source" href={spec.source.url} target="_blank" rel="noreferrer">
                      Kaynak: {spec.source.title ?? new URL(spec.source.url).hostname} · {formatDate(spec.source.retrieved)}
                    </a>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <span className="details__footer">Kataloğa eklendi: {formatDate(part.addedAt)} · Güncellendi: {formatDate(part.updatedAt)}</span>
    </div>
  )
}
