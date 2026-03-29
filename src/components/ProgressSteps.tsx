import { GENERATION_STEPS, type GenerationStepId } from '../types'

export function ProgressSteps({ currentStep }: { currentStep: GenerationStepId }) {
  const currentIndex = GENERATION_STEPS.findIndex((step) => step.id === currentStep)

  return (
    <ol className="progress-list">
      {GENERATION_STEPS.map((step, index) => {
        const state =
          index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending'

        return (
          <li className={`progress-item ${state}`} key={step.id}>
            <div className="progress-index">{index + 1}</div>
            <div>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
