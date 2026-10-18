import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './field';
import { Input } from './input';

describe('Field', () => {
  it('labels the control and describes it with the hint', () => {
    render(
      <Field label="Email" hint="We never share it.">
        {(props) => <Input {...props} />}
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('We never share it.');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marks the control invalid and announces the error', () => {
    render(
      <Field label="Email" error="Enter an email.">
        {(props) => <Input {...props} />}
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter an email.');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an email.');
  });
});
