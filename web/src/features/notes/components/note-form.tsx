import { useState, type FormEvent } from 'react';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { BODY_MAX, TITLE_MAX, validateNote, type NoteFormErrors, type NoteFormValues } from '../lib/validation';

export interface NoteFormProps {
  initial?: NoteFormValues;
  submitLabel: string;
  pending?: boolean;
  /** The last submit's error. Field errors from the server show under their fields. */
  error?: unknown;
  onSubmit: (values: NoteFormValues) => void;
  onCancel?: () => void;
  /** Mark the title for initial focus when the form opens in a Dialog. */
  focusTitle?: boolean;
}

export function NoteForm({
  initial,
  submitLabel,
  pending = false,
  error,
  onSubmit,
  onCancel,
  focusTitle = false,
}: NoteFormProps) {
  const [values, setValues] = useState<NoteFormValues>(initial ?? { title: '', body: '' });
  const [errors, setErrors] = useState<NoteFormErrors>({});

  const serverFields = isApiError(error) ? error.fieldErrors() : {};
  const formError =
    error && !(isApiError(error) && error.code === 'validation_failed') ? errorMessage(error) : undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateNote(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit({ title: values.title.trim(), body: values.body });
  };

  return (
    <form noValidate onSubmit={submit} className="app-form flex flex-col gap-4">
      {formError && (
        <p role="alert" className="rounded-xs bg-danger-soft px-3 py-2 text-compact-base text-danger-text">
          {formError}
        </p>
      )}
      <Field label="Title" error={errors.title ?? serverFields['title']}>
        {(props) => (
          <Input
            {...props}
            data-autofocus={focusTitle || undefined}
            maxLength={TITLE_MAX + 1}
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
          />
        )}
      </Field>
      <Field label="Body" hint="Plain text." error={errors.body ?? serverFields['body']}>
        {(props) => (
          <Textarea
            {...props}
            maxLength={BODY_MAX + 1}
            value={values.body}
            onChange={(e) => setValues({ ...values, body: e.target.value })}
          />
        )}
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
