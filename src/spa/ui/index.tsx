/**
 * Minimal component library for the SPA, styled by ui.css. Built on native elements (button, label,
 * input type=range, radio groups, details and dialog) so keyboard support and accessible names come free.
 */
import * as React from 'react';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

type Gap = 1 | 2 | 3 | 4 | 5;
const gapVar = (gap?: Gap): React.CSSProperties | undefined =>
    gap === undefined ? undefined : { ['--gap' as string]: `var(--space-${gap})` };

type LayoutProps = React.HTMLAttributes<HTMLDivElement> & { gap?: Gap };

/** Vertical flex column. */
export const Stack = ({ gap, className, style, ...rest }: LayoutProps) =>
    <div className={cx('ui-stack', className)} style={{ ...gapVar(gap), ...style }} {...rest} />;

/** Wrapping horizontal row with centred items. */
export const Row = ({ gap, className, style, ...rest }: LayoutProps) =>
    <div className={cx('ui-row', className)} style={{ ...gapVar(gap), ...style }} {...rest} />;

export const Spinner = () => <span className="ui-spinner" aria-hidden="true" />;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'text',
    size?: 'medium' | 'small',
    /** shows a spinner and marks the button busy (it is also disabled) */
    busy?: boolean,
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'secondary', size = 'medium', busy = false, disabled, className, children, ...rest }, ref) => (
        <button
            ref={ref}
            type="button"
            className={cx('ui-button', className)}
            data-variant={variant}
            data-size={size}
            disabled={disabled || busy}
            aria-busy={busy || undefined}
            {...rest}
        >
            {busy && <Spinner />}
            {children}
        </button>
    ));
Button.displayName = 'Button';

type FieldShared = {
    label: React.ReactNode,
    /** helper text under the input, replaced by error when that is set */
    hint?: React.ReactNode,
    error?: React.ReactNode,
    className?: string,
};

export type TextFieldProps = FieldShared & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'>;

/** Single line text or number input with a real label. */
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
    ({ label, hint, error, className, id, ...rest }, ref) => {
        const autoId = React.useId();
        const inputId = id ?? autoId;
        const hintId = `${inputId}-hint`;
        const message = error ?? hint;
        return (
            <div className={cx('ui-field', className)}>
                <label htmlFor={inputId}>{label}</label>
                <input
                    ref={ref}
                    id={inputId}
                    className="ui-input"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={message ? hintId : undefined}
                    {...rest}
                />
                {message && <span id={hintId} className="ui-hint" data-error={error ? true : undefined}>{message}</span>}
            </div>
        );
    });
TextField.displayName = 'TextField';

export type TextAreaProps = FieldShared & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
    /** minimum visible rows, the area grows with its content where the browser supports it */
    minRows?: number,
};

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
    ({ label, hint, error, className, id, minRows = 8, style, ...rest }, ref) => {
        const autoId = React.useId();
        const inputId = id ?? autoId;
        const hintId = `${inputId}-hint`;
        const message = error ?? hint;
        return (
            <div className={cx('ui-field', className)}>
                <label htmlFor={inputId}>{label}</label>
                <textarea
                    ref={ref}
                    id={inputId}
                    className="ui-input"
                    rows={minRows}
                    style={{ ['--rows' as string]: minRows, ...style }}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={message ? hintId : undefined}
                    {...rest}
                />
                {message && <span id={hintId} className="ui-hint" data-error={error ? true : undefined}>{message}</span>}
            </div>
        );
    });
TextArea.displayName = 'TextArea';

export type SliderProps = {
    label: string,
    value: number,
    onChange: (value: number) => void,
    min?: number,
    max: number,
    step?: number,
    /** appended to the shown and announced value, e.g. "px" */
    unit?: string,
};

/** Native range input with its label and current value. */
export const Slider = ({ label, value, onChange, min = 0, max, step = 1, unit }: SliderProps) => {
    const id = React.useId();
    const text = unit ? `${value} ${unit}` : String(value);
    return (
        <div className="ui-slider">
            <label htmlFor={id}>
                <span>{label}</span>
                <output htmlFor={id}>{text}</output>
            </label>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                aria-valuetext={text}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </div>
    );
};

export type ToggleGroupProps<T extends string> = {
    label: string,
    value: T,
    options: { value: T, label: React.ReactNode }[],
    onChange: (value: T) => void,
};

/** Exclusive choice as a segmented control, built on a radio group (arrow keys move the choice). */
export const ToggleGroup = <T extends string>({ label, value, options, onChange }: ToggleGroupProps<T>) => {
    const name = React.useId();
    return (
        <fieldset className="ui-toggle">
            <legend>{label}</legend>
            <div className="ui-toggle-options">
                {options.map((option) => (
                    <label key={option.value}>
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={option.value === value}
                            onChange={() => onChange(option.value)}
                        />
                        <span>{option.label}</span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
};

export type SwitchProps = {
    label: React.ReactNode,
    checked: boolean,
    onChange: (checked: boolean) => void,
};

export const Switch = ({ label, checked, onChange }: SwitchProps) => (
    <label className="ui-switch">
        <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="ui-switch-track" aria-hidden="true" />
        <span>{label}</span>
    </label>
);

export type Severity = 'success' | 'error' | 'warning' | 'info';

export type AlertProps = {
    severity: Severity,
    children: React.ReactNode,
    /** extra buttons, e.g. an Undo action */
    action?: React.ReactNode,
    onClose?: () => void,
};

export const Alert = ({ severity, children, action, onClose }: AlertProps) => (
    <div className="ui-alert" data-severity={severity} role={severity === 'error' ? 'alert' : 'status'}>
        <div className="ui-alert-body">{children}</div>
        {(action || onClose) && (
            <div className="ui-alert-actions">
                {action}
                {onClose && <Button variant="text" size="small" onClick={onClose}>Dismiss</Button>}
            </div>
        )}
    </div>
);

export type ToastProps = Omit<AlertProps, 'children'> & {
    message: React.ReactNode | null,
    /** milliseconds; errors stay until dismissed when this is undefined */
    autoHideMs?: number,
    onClose: () => void,
};

/** One transient message at the bottom of the screen; the region stays mounted so screen readers announce it. */
export const Toast = ({ message, severity, action, autoHideMs, onClose }: ToastProps) => {
    React.useEffect(() => {
        if (message === null || autoHideMs === undefined) {
            return undefined;
        }
        const timer = window.setTimeout(onClose, autoHideMs);
        return () => window.clearTimeout(timer);
    }, [message, autoHideMs, onClose]);
    return (
        <div className="ui-toast-region" aria-live="polite">
            {message !== null && <Alert severity={severity} action={action} onClose={onClose}>{message}</Alert>}
        </div>
    );
};

export type AccordionProps = {
    title: React.ReactNode,
    /** short summary shown next to the title */
    secondary?: React.ReactNode,
    open: boolean,
    onToggle: (open: boolean) => void,
    children: React.ReactNode,
};

export const Accordion = ({ title, secondary, open, onToggle, children }: AccordionProps) => (
    <details
        className="ui-accordion"
        open={open}
        onToggle={(event) => {
            const isOpen = (event.currentTarget as HTMLDetailsElement).open;
            if (isOpen !== open) {
                onToggle(isOpen);
            }
        }}
    >
        <summary>
            <span>{title}</span>
            {secondary && <span className="ui-dim ui-small">{secondary}</span>}
        </summary>
        <div className="ui-accordion-body">{children}</div>
    </details>
);

export type MenuProps = {
    label: React.ReactNode,
    items: { label: React.ReactNode, onSelect: () => void }[],
    disabled?: boolean,
};

/** Dropdown of actions on details and summary; closes on choice, outside click and Escape. */
export const Menu = ({ label, items, disabled }: MenuProps) => {
    const ref = React.useRef<HTMLDetailsElement>(null);
    const close = React.useCallback(() => {
        if (ref.current?.open) {
            ref.current.open = false;
            ref.current.querySelector('summary')?.focus();
        }
    }, []);
    React.useEffect(() => {
        const onPointer = (event: PointerEvent) => {
            if (ref.current?.open && !ref.current.contains(event.target as Node)) {
                ref.current.open = false;
            }
        };
        document.addEventListener('pointerdown', onPointer);
        return () => document.removeEventListener('pointerdown', onPointer);
    }, []);
    return (
        <details
            ref={ref}
            className="ui-menu"
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    close();
                }
            }}
        >
            <summary
                className="ui-button"
                data-variant="secondary"
                data-size="medium"
                aria-disabled={disabled || undefined}
                onClick={(event) => disabled && event.preventDefault()}
            >
                {label}
            </summary>
            <div className="ui-menu-list">
                {items.map((item, index) => (
                    <Button key={index} variant="text" onClick={() => { close(); item.onSelect(); }}>{item.label}</Button>
                ))}
            </div>
        </details>
    );
};

export type DialogProps = {
    title: React.ReactNode,
    open: boolean,
    onClose: () => void,
    children: React.ReactNode,
    actions?: React.ReactNode,
};

/** Modal on the native dialog element (focus trap, Escape and backdrop handled by the browser). */
export const Dialog = ({ title, open, onClose, children, actions }: DialogProps) => {
    const ref = React.useRef<HTMLDialogElement>(null);
    const titleId = React.useId();
    React.useEffect(() => {
        const dialog = ref.current;
        if (!dialog) {
            return;
        }
        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);
    return (
        <dialog
            ref={ref}
            className="ui-dialog"
            aria-labelledby={titleId}
            onClose={onClose}
            onClick={(event) => {
                // a click on the backdrop lands on the dialog element itself
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="ui-dialog-inner">
                <h2 id={titleId}>{title}</h2>
                {children}
                <div className="ui-dialog-actions">
                    {actions}
                    <Button variant="primary" onClick={onClose}>Close</Button>
                </div>
            </div>
        </dialog>
    );
};
