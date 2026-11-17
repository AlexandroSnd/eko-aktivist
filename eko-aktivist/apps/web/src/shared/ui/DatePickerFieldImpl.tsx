import { useState } from 'react'
import DatePicker from 'react-datepicker'
import { ru } from 'date-fns/locale'
import { shift } from '@floating-ui/react'

export type DatePickerFieldProps = {
  name?: string
  value?: string
  defaultValue?: string
  mode?: 'date' | 'datetime'
  required?: boolean
  disabled?: boolean
  placeholder?: string
  onChange?: (value: string) => void
}

function parseLocalValue(value: string, mode: 'date' | 'datetime') {
  if (!value) return null
  const [datePart, timePart = '00:00'] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours = 0, minutes = 0] = mode === 'datetime' ? timePart.split(':').map(Number) : []
  const date = new Date(year, month - 1, day, hours, minutes)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatLocalValue(date: Date, mode: 'date' | 'datetime') {
  const pad = (value: number) => String(value).padStart(2, '0')
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return mode === 'datetime' ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day
}

export function DatePickerFieldImpl({
  name,
  value,
  defaultValue = '',
  mode = 'date',
  required = false,
  disabled = false,
  placeholder,
  onChange,
}: DatePickerFieldProps) {
  const [localValue, setLocalValue] = useState(defaultValue)
  const currentValue = value ?? localValue

  function updateValue(date: Date | null) {
    const nextValue = date ? formatLocalValue(date, mode) : ''
    if (value === undefined) setLocalValue(nextValue)
    onChange?.(nextValue)
  }

  return (
    <div className="date-picker-field">
      <DatePicker
        selected={parseLocalValue(currentValue, mode)}
        onChange={updateValue}
        locale={ru}
        calendarStartDay={1}
        dateFormat={mode === 'datetime' ? 'd MMMM yyyy, HH:mm' : 'd MMMM yyyy'}
        showTimeSelect={mode === 'datetime'}
        timeIntervals={30}
        timeCaption="Время"
        timeFormat="HH:mm"
        placeholderText={placeholder ?? (mode === 'datetime' ? 'Дата и время' : 'Выберите дату')}
        todayButton="Сегодня"
        showPopperArrow={false}
        popperPlacement="bottom-start"
        popperModifiers={[shift({ padding: 12 })]}
        fixedHeight
        isClearable={!required}
        disabled={disabled}
        required={required}
        autoComplete="off"
        className="date-picker-input"
        calendarClassName="app-date-calendar"
        popperClassName="app-date-popper"
      />
      {name && <input type="hidden" name={name} value={currentValue} />}
    </div>
  )
}
