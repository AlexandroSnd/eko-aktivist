import { Link } from 'react-router-dom'
import { eventTypes, formatDate } from '../../../shared/api'

export function EventCard({ event }: { event: any }) {
  const type = eventTypes[event?.type] ? event.type : ''
  return (
    <Link to={`/events/${event?.id ?? ''}`} className="event-card">
      <div className={`event-visual ${type}`}>
        <span className="event-symbol">
          {({ cleanup: '〰', recycling: '↻', planting: '♣', lecture: '◉', quest: '✦' } as any)[
            event?.type
          ] || '✳'}
        </span>
        <span className="tag">{eventTypes[event?.type] || 'Экологическая акция'}</span>
      </div>
      <div className="event-card-body">
        <span className="muted">{formatDate(event?.start_at)} · ЕКБ</span>
        <h3>{event?.title || 'Акция без названия'}</h3>
        <p>{event?.address || 'Адрес уточняется'}</p>
        <div className="card-bottom">
          <span>{event?.places_left ?? '—'} мест</span>
          <span className="circle-arrow">↗</span>
        </div>
      </div>
    </Link>
  )
}
