import React, { lazy, Suspense, memo } from 'react';
import { Calendar } from 'lucide-react';

const ReactDatePicker = lazy(() =>
  import('react-datepicker').then((module) => ({
    default: module.default,
  }))
);

interface OptimizedDatePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  dateFormat?: string;
  placeholderText?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
  showTimeSelect?: boolean;
  timeFormat?: string;
  timeIntervals?: number;
  inline?: boolean;
  monthsShown?: number;
  isClearable?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
}

const OptimizedDatePicker = memo<OptimizedDatePickerProps>(
  ({
    selected,
    onChange,
    dateFormat = 'dd/MM/yyyy',
    placeholderText = 'Selecione uma data',
    minDate,
    maxDate,
    disabled = false,
    className = '',
    showTimeSelect = false,
    timeFormat = 'HH:mm',
    timeIntervals = 15,
    inline = false,
    monthsShown = 1,
    isClearable = false,
    required = false,
    name,
    id,
  }) => {
    const loadingFallback = (
      <div className="relative">
        <input
          type="text"
          placeholder={placeholderText}
          disabled
          className={`${className} bg-gray-50 cursor-wait`}
          required={required}
        />
        <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
      </div>
    );

    return (
      <Suspense fallback={loadingFallback}>
        <div className="relative">
          <ReactDatePicker
            selected={selected}
            onChange={onChange}
            dateFormat={dateFormat}
            placeholderText={placeholderText}
            minDate={minDate}
            maxDate={maxDate}
            disabled={disabled}
            className={className}
            showTimeSelect={showTimeSelect}
            timeFormat={timeFormat}
            timeIntervals={timeIntervals}
            inline={inline}
            monthsShown={monthsShown}
            isClearable={isClearable}
            required={required}
            name={name}
            id={id}
            calendarStartDay={0}
            locale="pt-BR"
            wrapperClassName="w-full"
          />
          <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
      </Suspense>
    );
  }
);

OptimizedDatePicker.displayName = 'OptimizedDatePicker';

export default OptimizedDatePicker;

export const SimpleDateInput = memo<{
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
}>(({ value, onChange, onBlur, min, max, disabled, required, name, id, className = '' }) => {
  return (
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        min={min}
        max={max}
        disabled={disabled}
        required={required}
        name={name}
        id={id}
        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${className}`}
      />
      <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
    </div>
  );
});

SimpleDateInput.displayName = 'SimpleDateInput';
