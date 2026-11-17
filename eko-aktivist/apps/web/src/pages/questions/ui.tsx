import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import {
  api,
  eventTypes,
  formatDate,
  initCsrf,
  patch,
  post,
  put,
  toEkbInput,
  toEkbISOString,
} from '../../shared/api'
import {
  Alert,
  EmptyState,
  ErrorMessage,
  Loading,
  QueryState,
  useData,
  useList,
  useMe,
} from '../../shared/ui'
import { EventCard } from '../../entities/event/ui/EventCard'
import { MapBounds, MapFocus } from '../../widgets/event-map'

export function Questions() {
  const list = useList('/questions')
  const { data } = list
  const items = data?.items ?? []
  const [error, setError] = useState<any>()
  const query = useQueryClient()
  async function ask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const element = e.currentTarget
    try {
      await post('/questions', Object.fromEntries(new FormData(element)))
      query.invalidateQueries({ queryKey: ['/questions'] })
      element.reset()
    } catch (e) {
      setError(e)
    }
  }
  return (
    <section className="page-section narrow">
      <div className="page-heading">
        <span className="eyebrow">СПРОСИТЕ ЭКСПЕРТА</span>
        <h1>Вопросы и ответы</h1>
      </div>
      <form className="panel stacked" onSubmit={ask}>
        <h2>Новый вопрос</h2>
        <Alert error={error} />
        <label>
          Категория
          <input name="category" required />
        </label>
        <label>
          Вопрос
          <textarea name="text" minLength={10} maxLength={2000} required />
        </label>
        <button className="button">Отправить ↗</button>
      </form>
      <div className="panel">
        <h2>Мои вопросы</h2>
        {list.isPending ? (
          <Loading variant="list" />
        ) : list.error ? (
          <QueryState isPending={false} error={list.error} retry={list.refetch} variant="list">
            {null}
          </QueryState>
        ) : items.length ? (
          items.map((q: any) => (
            <div className="question" key={q.id}>
              <b>{q.text || 'Вопрос без текста'}</b>
              <small>{q.status || 'На рассмотрении'}</small>
              {q.answer && <p>Ответ: {q.answer}</p>}
            </div>
          ))
        ) : (
          <EmptyState title="Вы ещё не задавали вопросов">
            Отправьте вопрос эксперту через форму выше.
          </EmptyState>
        )}
      </div>
    </section>
  )
}
