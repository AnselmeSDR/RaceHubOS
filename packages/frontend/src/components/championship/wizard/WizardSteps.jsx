import { useTranslation } from 'react-i18next'
import { WIZARD_STEPS } from './wizardPlan'

// Step indicators: a step already done can be reopened, the next ones cannot
export default function WizardSteps({ step, onStep }) {
  const { t } = useTranslation('championships')
  return (
    <div data-testid="championship-wizard-steps" className="flex flex-wrap items-center gap-2 mb-6">
      {WIZARD_STEPS.map((s, i) => {
        const Icon = s.icon
        const isActive = i === step
        const isDone = i < step
        return (
          <button
            key={s.key}
            onClick={() => isDone && onStep(i)}
            disabled={i > step}
            aria-current={isActive ? 'step' : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? 'bg-yellow-500 text-white'
                : isDone
                  ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 cursor-pointer'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {t(s.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
