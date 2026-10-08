import { normalizeBatchCardStyle, type BatchCardStyle } from '../../types/batch'

// Only the decoration is clipped; the card's menu can still extend outside it.
export function BatchCardArtwork({ style, thumbnail = false }: { style?: BatchCardStyle; thumbnail?: boolean }) {
  const selected = normalizeBatchCardStyle(style)
  if (selected === 'none') return null
  return <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden rounded-[inherit]">
    <img
      src={`/batch-covers/${selected}.webp`}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      className={`absolute right-[-3%] top-1/2 aspect-square -translate-y-1/2 object-contain ${thumbnail ? 'w-[80%] opacity-90' : 'w-[59%] max-w-[240px] opacity-55'}`}
      style={{ maskImage: 'linear-gradient(to right, transparent, black 28%, black 92%, transparent)' }}
    />
  </span>
}
