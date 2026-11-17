import { lazy, Suspense } from 'react'
import type { DatePickerFieldProps } from './DatePickerFieldImpl'

const DatePickerFieldImpl = lazy(() =>
  import('./DatePickerFieldImpl').then((module) => ({ default: module.DatePickerFieldImpl })),
)

export function DatePickerField(props: DatePickerFieldProps) {
  const placeholder =
    props.placeholder ?? (props.mode === 'datetime' ? 'Дата и время' : 'Выберите дату')
  const value = props.value ?? props.defaultValue ?? ''

  return (
    <Suspense
      fallback={
        <div className="date-picker-field" aria-busy="true">
          <input className="date-picker-input" placeholder={placeholder} disabled />
          {props.name && <input type="hidden" name={props.name} value={value} />}
        </div>
      }
    >
      <DatePickerFieldImpl {...props} />
    </Suspense>
  )
}
