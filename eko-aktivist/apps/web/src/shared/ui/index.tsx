import React from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, eventTypes, formatDate } from '../api'

export { DatePickerField } from './DatePickerField'

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api('/me') })
}
export function useList(path: string) {
  return useQuery({
    queryKey: [path],
    queryFn: () => api(path),
    placeholderData:
      path.startsWith('/events?') || path.startsWith('/events/map?') ? keepPreviousData : undefined,
  })
}
export const useData = useList
export function Alert({ error }: { error: any }) {
  return error ? (
    <div className="alert" role="alert">
      {error.message || 'Не удалось выполнить действие'}
    </div>
  ) : null
}
export const ErrorMessage = Alert
export function Loading({
  variant = 'page',
  count = 3,
}: {
  variant?: 'page' | 'list' | 'grid'
  count?: number
}) {
  return (
    <div
      className={`skeleton-group skeleton-${variant}`}
      role="status"
      aria-label="Загружаем данные"
      aria-busy="true"
    >
      {Array.from({ length: variant === 'page' ? 1 : count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          {variant === 'grid' && <div className="skeleton-block skeleton-image" />}
          <div className="skeleton-block skeleton-heading" />
          <div className="skeleton-block" />
          <div className="skeleton-block skeleton-short" />
        </div>
      ))}
    </div>
  )
}
export function EmptyState({
  title = 'Пока здесь пусто',
  children,
}: {
  title?: string
  children?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        ✳
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  )
}
export function QueryState({
  isPending,
  error,
  isEmpty,
  emptyTitle,
  retry,
  children,
  variant = 'list',
}: {
  isPending: boolean
  error?: unknown
  isEmpty?: boolean
  emptyTitle?: string
  retry?: () => void
  children: React.ReactNode
  variant?: 'page' | 'list' | 'grid'
}) {
  if (isPending) return <Loading variant={variant} />
  if (error)
    return (
      <div className="query-error" role="alert">
        <p>Не удалось загрузить данные. Попробуйте ещё раз.</p>
        {retry && (
          <button className="button ghost small" onClick={retry}>
            Повторить
          </button>
        )}
      </div>
    )
  if (isEmpty) return <EmptyState title={emptyTitle} />
  return <>{children}</>
}
export function Guard({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { data: me, isLoading, error } = useMe()
  if (isLoading) return <Loading />
  if (error)
    return (
      <div className="empty">
        <h2>Не удалось проверить вход</h2>
        <p>Обновите страницу и попробуйте снова.</p>
      </div>
    )
  if (!me)
    return (
      <div className="empty">
        <h2>Нужен вход</h2>
        <p>Войдите, чтобы продолжить.</p>
        <Link className="button" to="/login">
          Войти
        </Link>
      </div>
    )
  if (roles && !roles.includes(me.role)) return <div className="empty">Недостаточно прав</div>
  return <>{children}</>
}
