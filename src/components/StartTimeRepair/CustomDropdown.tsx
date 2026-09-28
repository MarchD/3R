import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  label: string;
  value: string;
  options: DropdownOption[];
  placeholder: string;
  searchPlaceholder: string;
  unavailableLabel: string;
  emptyLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function nextEnabledOption(options: DropdownOption[], start: number, direction: number): number {
  if (!options.length) return -1;
  const origin = start < 0 && direction < 0 ? 0 : start;
  for (let step = 1; step <= options.length; step += 1) {
    const index = (origin + direction * step + options.length * 2) % options.length;
    if (!options[index].disabled) return index;
  }
  return -1;
}

export function CustomDropdown({
  label,
  value,
  options,
  placeholder,
  searchPlaceholder,
  unavailableLabel,
  emptyLabel,
  disabled = false,
  onChange,
}: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const optionList = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? options.filter((option) => option.label.toLocaleLowerCase().includes(normalized))
      : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    searchInput.current?.focus();
    const closeOutside = (event: PointerEvent | FocusEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0 || !optionList.current) return;
    const list = optionList.current;
    const option = list.children[activeIndex] as HTMLElement | undefined;
    if (!option) return;
    const listBounds = list.getBoundingClientRect();
    const optionBounds = option.getBoundingClientRect();
    if (optionBounds.top < listBounds.top) list.scrollTop -= listBounds.top - optionBounds.top;
    if (optionBounds.bottom > listBounds.bottom)
      list.scrollTop += optionBounds.bottom - listBounds.bottom;
  }, [activeIndex, open]);

  const openMenu = () => {
    if (disabled) return;
    setQuery('');
    setActiveIndex(nextEnabledOption(options, -1, 1));
    setOpen(true);
  };
  const choose = (option: DropdownOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="customDropdown" ref={root}>
      <span className="customDropdownLabel" id={`${id}-label`}>
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        className="customDropdownTrigger"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu();
          }
        }}
      >
        <span id={`${id}-value`} className={selected ? '' : 'placeholder'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="customDropdownMenu">
          <div className="customDropdownSearch">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchInput}
              type="search"
              role="combobox"
              aria-label={`${label}: ${searchPlaceholder}`}
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => {
                const nextQuery = event.target.value;
                const nextOptions = options.filter((option) =>
                  option.label.toLocaleLowerCase().includes(nextQuery.trim().toLocaleLowerCase()),
                );
                setQuery(nextQuery);
                setActiveIndex(nextEnabledOption(nextOptions, -1, 1));
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActiveIndex(
                    nextEnabledOption(filtered, activeIndex, event.key === 'ArrowDown' ? 1 : -1),
                  );
                }
                if (event.key === 'Enter' && activeIndex >= 0) {
                  event.preventDefault();
                  choose(filtered[activeIndex]);
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setOpen(false);
                  trigger.current?.focus();
                }
                if (event.key === 'Tab') setOpen(false);
              }}
            />
          </div>
          <div
            className="customDropdownList"
            id={`${id}-list`}
            ref={optionList}
            role="listbox"
            aria-label={label}
          >
            {filtered.length ? (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  id={`${id}-option-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  className={activeIndex === index ? 'active' : ''}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {option.disabled && <small>{unavailableLabel}</small>}
                  {!option.disabled && option.value === value && (
                    <Check size={15} aria-hidden="true" />
                  )}
                </button>
              ))
            ) : (
              <p className="customDropdownEmpty">{emptyLabel}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
