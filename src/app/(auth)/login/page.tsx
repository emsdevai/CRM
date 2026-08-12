'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Sofa } from 'lucide-react'
import { login } from './action'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError]   = useState<string | null>(null)
  const [isPending, startTransition]    = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  function onSubmit(values: LoginFormValues) {
    setServerError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('email',    values.email)
      formData.set('password', values.password)

      const result = await login(formData)
      if (result?.error) {
        setServerError(result.error)
      }
    })
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Brand panel (left) ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-between bg-gradient-to-br from-green-800 to-green-950 p-12 relative overflow-hidden">
        {/* Decorative background circles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
          <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 left-16 w-64 h-64 rounded-full bg-white/5" />
          {/* Grid pattern */}
          <svg
            className="absolute inset-0 w-full h-full opacity-10"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Logo / brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
              <Sofa className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg leading-tight">
                Jangir Brothers
              </p>
              <p className="text-green-300 text-sm">CRM Suite</p>
            </div>
          </div>
        </div>

        {/* Center copy */}
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <h1 className="text-white text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
            Complete Furniture
            <br />
            Retail Management
          </h1>
          <p className="mt-4 text-green-200 text-lg leading-relaxed max-w-xs">
            Manage leads, quotations, inventory, and analytics — all in one
            place.
          </p>

          {/* Feature pills */}
          <div className="mt-10 flex flex-col gap-3">
            {[
              '360° Lead & Customer Tracking',
              'Smart Quotation Builder with GST',
              'Inventory & Barcode Management',
              'Role-Based Access Control',
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                <span className="text-green-100 text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-green-400 text-xs">
            &copy; {new Date().getFullYear()} Jangir Brothers. All rights
            reserved.
          </p>
        </div>
      </div>

      {/* ── Login form (right) ─────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-zinc-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center">
              <Sofa className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900 text-base leading-tight">
                Jangir Brothers CRM
              </p>
              <p className="text-zinc-500 text-xs">Furniture Retail Management</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 px-8 py-10">
            <h2 className="text-2xl font-bold text-zinc-900 mb-1">
              Sign in
            </h2>
            <p className="text-zinc-500 text-sm mb-8">
              Enter your credentials to access the dashboard.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              {/* Server-level error */}
              {serverError && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{serverError}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-zinc-700 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@jangirbrothers.com"
                  {...register('email')}
                  className={cn(
                    'w-full px-3.5 py-2.5 rounded-lg border text-sm text-zinc-900',
                    'placeholder:text-zinc-400 bg-white outline-none transition-shadow',
                    'focus:ring-2 focus:ring-green-700/30 focus:border-green-700',
                    errors.email
                      ? 'border-red-400 focus:ring-red-400/30 focus:border-red-500'
                      : 'border-zinc-300',
                  )}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-zinc-700 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register('password')}
                    className={cn(
                      'w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm text-zinc-900',
                      'placeholder:text-zinc-400 bg-white outline-none transition-shadow',
                      'focus:ring-2 focus:ring-green-700/30 focus:border-green-700',
                      errors.password
                        ? 'border-red-400 focus:ring-red-400/30 focus:border-red-500'
                        : 'border-zinc-300',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  'w-full flex items-center justify-center gap-2',
                  'py-2.5 px-4 rounded-lg text-sm font-semibold text-white',
                  'bg-green-700 hover:bg-green-800 active:bg-green-900',
                  'transition-colors focus-visible:outline-none',
                  'focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              >
                {isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {isPending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-400">
            Jangir Brothers Furniture &mdash; Internal CRM
          </p>
        </div>
      </div>
    </div>
  )
}
