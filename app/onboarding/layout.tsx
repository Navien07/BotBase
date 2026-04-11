'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Check } from 'lucide-react'

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { key: 'create_bot', label: 'Create Bot', path: '/onboarding/create-bot' },
  { key: 'upload_docs', label: 'Knowledge Base', path: '/onboarding/upload-docs' },
  { key: 'configure', label: 'Configure', path: '/onboarding/configure' },
  { key: 'connect_channel', label: 'Connect Channel', path: '/onboarding/connect-channel' },
  { key: 'test', label: 'Test & Go Live', path: '/onboarding/test' },
]

function getStepIndex(stepKey: string) {
  return STEPS.findIndex((s) => s.key === stepKey)
}

function getPathIndex(pathname: string) {
  return STEPS.findIndex((s) => pathname.startsWith(s.path))
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  currentIndex: number
  completedSteps: string[]
}

function ProgressBar({ currentIndex, completedSteps }: ProgressBarProps) {
  return (
    <div className="flex items-center gap-0 w-full max-w-2xl mx-auto">
      {STEPS.map((step, i) => {
        const isCompleted = completedSteps.includes(step.key)
        const isCurrent = i === currentIndex
        const isFuture = i > currentIndex && !isCompleted

        return (
          <div key={step.key} className="flex items-center flex-1">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="relative">
                {/* Pulsing ring for current */}
                {isCurrent && !isCompleted && (
                  <div className="absolute inset-0 rounded-full animate-ping bg-[oklch(0.585_0.223_264.4)] opacity-30 scale-150" />
                )}
                <div
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all relative z-10',
                    isCompleted
                      ? 'bg-[oklch(0.585_0.223_264.4)] border-[oklch(0.585_0.223_264.4)] text-white'
                      : isCurrent
                        ? 'bg-[oklch(0.13_0_0)] border-[oklch(0.585_0.223_264.4)] text-[oklch(0.585_0.223_264.4)]'
                        : 'bg-[oklch(0.09_0_0)] border-[oklch(0.165_0_0)] text-[oklch(0.37_0_0)]',
                  ].join(' ')}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : i + 1}
                </div>
              </div>
              <span
                className={[
                  'text-[11px] font-medium whitespace-nowrap',
                  isCompleted || isCurrent
                    ? 'text-[oklch(0.94_0_0)]'
                    : 'text-[oklch(0.37_0_0)]',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line — not after last step */}
            {i < STEPS.length - 1 && (
              <div
                className={[
                  'flex-1 h-0.5 mx-1 mt-[-18px] transition-all',
                  isCompleted
                    ? 'bg-[oklch(0.585_0.223_264.4)]'
                    : isFuture
                      ? 'bg-[oklch(0.165_0_0)]'
                      : 'bg-[oklch(0.3_0.1_264.4)]',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [currentStepKey, setCurrentStepKey] = useState('create_bot')

  const currentPathIndex = getPathIndex(pathname)
  const currentStepIndex = Math.max(currentPathIndex, getStepIndex(currentStepKey))
  const displayIndex = currentPathIndex >= 0 ? currentPathIndex : currentStepIndex

  // Extract botId from URL search params
  const botId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('botId')
      : null

  const canGoBack = currentPathIndex > 0
  const canSkip = currentPathIndex >= 1 && currentPathIndex <= 3

  useEffect(() => {
    fetch('/api/onboarding/progress')
      .then((r) => r.json())
      .then((data) => {
        if (data.steps_completed) setCompletedSteps(data.steps_completed)
        if (data.current_step) setCurrentStepKey(data.current_step)
      })
      .catch(() => {/* ignore */})
  }, [])

  function handleBack() {
    if (currentPathIndex <= 0) return
    const prev = STEPS[currentPathIndex - 1]
    router.push(botId ? `${prev.path}?botId=${botId}` : prev.path)
  }

  function handleSkip() {
    if (currentPathIndex < 0 || currentPathIndex >= STEPS.length - 1) return
    const next = STEPS[currentPathIndex + 1]
    router.push(botId ? `${next.path}?botId=${botId}` : next.path)
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'oklch(0.06 0 0)' }}
    >
      {/* Top bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-[oklch(0.165_0_0)]">
        {/* Back button */}
        <div className="w-24">
          {canGoBack && (
            <button
              onClick={handleBack}
              className="text-sm text-[oklch(0.63_0_0)] hover:text-[oklch(0.94_0_0)] transition-colors"
            >
              ← Back
            </button>
          )}
        </div>

        {/* Logo */}
        <span className="text-[oklch(0.94_0_0)] font-semibold text-lg tracking-tight">
          bot<span className="text-[oklch(0.585_0.223_264.4)]">base</span>
        </span>

        {/* Skip link */}
        <div className="w-24 flex justify-end">
          {canSkip && (
            <button
              onClick={handleSkip}
              className="text-sm text-[oklch(0.63_0_0)] hover:text-[oklch(0.94_0_0)] transition-colors"
            >
              Skip →
            </button>
          )}
        </div>
      </header>

      {/* Progress bar */}
      <div className="w-full px-6 pt-6 pb-2">
        <ProgressBar currentIndex={displayIndex} completedSteps={completedSteps} />
      </div>

      {/* Page content */}
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  )
}
