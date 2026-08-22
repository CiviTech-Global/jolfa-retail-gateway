import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LoginForm } from './LoginForm'

function renderForm(props: Partial<Parameters<typeof LoginForm>[0]> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined)
  render(<LoginForm onSubmit={onSubmit} isLoading={props.isLoading} error={props.error} />)
  return { onSubmit }
}

const phoneField = () => screen.getByLabelText('شماره موبایل')
const passwordField = () => screen.getByLabelText('رمز عبور')
const submit = () => screen.getByRole('button', { name: 'ورود' })

describe('LoginForm — markup and accessibility', () => {
  it('labels both fields so they are reachable by accessible name', () => {
    renderForm()

    expect(phoneField()).toBeInTheDocument()
    expect(passwordField()).toBeInTheDocument()
  })

  it('uses a tel input for the phone and a password input for the secret', () => {
    renderForm()

    expect(phoneField()).toHaveAttribute('type', 'tel')
    expect(passwordField()).toHaveAttribute('type', 'password')
  })

  it('sets autocomplete hints for password managers', () => {
    renderForm()

    expect(phoneField()).toHaveAttribute('autoComplete', 'tel')
    expect(passwordField()).toHaveAttribute('autoComplete', 'current-password')
  })

  it('renders a server-side error message when one is supplied', () => {
    renderForm({ error: 'شماره موبایل یا رمز عبور اشتباه است' })

    expect(screen.getByText('شماره موبایل یا رمز عبور اشتباه است')).toBeInTheDocument()
  })

  it('renders no error block when no error is supplied', () => {
    renderForm()

    expect(screen.queryByText(/اشتباه است/)).not.toBeInTheDocument()
  })
})

describe('LoginForm — validation', () => {
  it('blocks submission and shows both messages when the form is empty', async () => {
    const { onSubmit } = renderForm()

    fireEvent.click(submit())

    expect(await screen.findByText('شماره موبایل باید حداقل ۱۰ رقم باشد')).toBeInTheDocument()
    expect(screen.getByText('رمز عبور باید حداقل ۶ کاراکتر باشد')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a phone shorter than 10 digits', async () => {
    const { onSubmit } = renderForm()

    fireEvent.change(phoneField(), { target: { value: '0912345' } })
    fireEvent.change(passwordField(), { target: { value: 'password123' } })
    fireEvent.click(submit())

    expect(await screen.findByText('شماره موبایل باید حداقل ۱۰ رقم باشد')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a phone longer than 15 digits', async () => {
    const { onSubmit } = renderForm()

    fireEvent.change(phoneField(), { target: { value: '0912345678901234' } })
    fireEvent.change(passwordField(), { target: { value: 'password123' } })
    fireEvent.click(submit())

    expect(await screen.findByText('شماره موبایل باید حداکثر ۱۵ رقم باشد')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 6 characters', async () => {
    const { onSubmit } = renderForm()

    fireEvent.change(phoneField(), { target: { value: '09123456789' } })
    fireEvent.change(passwordField(), { target: { value: '12345' } })
    fireEvent.click(submit())

    expect(await screen.findByText('رمز عبور باید حداقل ۶ کاراکتر باشد')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('accepts a 10-digit phone and a 6-character password (the exact boundaries)', async () => {
    const { onSubmit } = renderForm()

    fireEvent.change(phoneField(), { target: { value: '0912345678' } })
    fireEvent.change(passwordField(), { target: { value: '123456' } })
    fireEvent.click(submit())

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  })
})

describe('LoginForm — submission', () => {
  it('calls onSubmit exactly once with the entered credentials', async () => {
    const { onSubmit } = renderForm()

    fireEvent.change(phoneField(), { target: { value: '09123456789' } })
    fireEvent.change(passwordField(), { target: { value: 'password123' } })
    fireEvent.click(submit())

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith(
      { phone: '09123456789', password: 'password123' },
      expect.anything(),
    )
  })

  it('does not leak the password into the rendered markup as plain text', async () => {
    renderForm()

    fireEvent.change(passwordField(), { target: { value: 'sup3rsecret' } })

    expect(screen.queryByText('sup3rsecret')).not.toBeInTheDocument()
  })

  it('disables the submit button while a login is in flight', () => {
    renderForm({ isLoading: true })

    expect(submit()).toBeDisabled()
  })
})
