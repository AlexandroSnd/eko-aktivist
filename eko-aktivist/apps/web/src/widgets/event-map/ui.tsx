import { useEffect } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'

export function MapBounds({ onChange }: { onChange: (bbox: string) => void }) {
  const map = useMapEvents({ moveend: () => update() })
  function update() {
    const bounds = map.getBounds()
    onChange(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
        .map((n) => n.toFixed(5))
        .join(','),
    )
  }
  useEffect(() => {
    update()
  }, [map])
  return null
}

export function MapFocus({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 12)
  }, [map, center[0], center[1]])
  return null
}
