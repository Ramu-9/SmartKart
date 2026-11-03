import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ShieldCheck, Tag, X, ArrowRight, Check } from 'lucide-react';
import UI_STRINGS from '../constants/uiStrings';

const STORAGE_KEY = 'smartkart_onboarding_seen_v1';

const TOUR_STEPS = [
  {
    step: 1,
    title: UI_STRINGS.shopByGoal,
    icon: Sparkles,
    description:
      'Describe what you need and your budget (e.g., "Hostel setup under ₹5,000"). SmartKart builds a suggested bundle in a temporary workspace—nothing touches your cart until you approve.',
    actionLabel: 'Explore Shop by Goal',
    route: '/smart-shop'
  },
  {
    step: 2,
    title: `${UI_STRINGS.checkMyCart} (${UI_STRINGS.smartPurchaseCheck})`,
    icon: ShieldCheck,
    description:
      'Once you have at least one item in your cart, click "Check My Cart" right above your items to see honest trade-offs, verified buyer feedback, and 1-click product swaps.',
    actionLabel: 'View Cart',
    route: '/cart'
  },
  {
    step: 3,
    title: UI_STRINGS.askForDiscount,
    icon: Tag,
    description:
      'Inside your Cart Order Summary, ask for a bundle discount before checking out. Approved offers up to 15% off are locked to your current cart items.',
    actionLabel: 'Got it, start shopping',
    route: null
  }
];

function OnboardingTour({ forceOpen = false, onCloseExternal }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setCurrentStep(0);
      setIsOpen(true);
      return;
    }
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore storage errors
    }
  }, [forceOpen]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setIsOpen(false);
    if (onCloseExternal) onCloseExternal();
  };

  if (!isOpen) return null;

  const active = TOUR_STEPS[currentStep];
  const IconComp = active.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <div className="onboarding-tour-card" role="dialog" aria-label="Quick 3-step feature tour">
      <div className="onboarding-tour-top">
        <div className="onboarding-step-indicator">
          <span className="onboarding-badge">Quick Tour · Step {active.step} of 3</span>
          <div className="onboarding-dots">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.step}
                type="button"
                className={`onboarding-dot ${idx === currentStep ? 'active' : ''}`}
                onClick={() => setCurrentStep(idx)}
                aria-label={`Go to step ${s.step}`}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          className="onboarding-close-btn"
          onClick={handleDismiss}
          aria-label="Dismiss tour"
        >
          <X size={15} />
        </button>
      </div>

      <div className="onboarding-body">
        <div className="onboarding-icon-box">
          <IconComp size={20} />
        </div>
        <div>
          <h4 className="onboarding-title">{active.title}</h4>
          <p className="onboarding-desc">{active.description}</p>
        </div>
      </div>

      <div className="onboarding-footer">
        <button type="button" className="onboarding-skip-btn" onClick={handleDismiss}>
          Skip tour
        </button>

        <div className="onboarding-nav-btns">
          {currentStep > 0 && (
            <button
              type="button"
              className="btn btn-outline onboarding-btn-sm"
              onClick={() => setCurrentStep((prev) => prev - 1)}
            >
              Back
            </button>
          )}

          {!isLast ? (
            <button
              type="button"
              className="btn btn-primary onboarding-btn-sm"
              onClick={() => setCurrentStep((prev) => prev + 1)}
            >
              <span>Next</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary onboarding-btn-sm"
              onClick={handleDismiss}
            >
              <Check size={14} />
              <span>Done</span>
            </button>
          )}
        </div>
      </div>

      {active.route && (
        <div className="onboarding-try-row">
          <button
            type="button"
            className="onboarding-try-link"
            onClick={() => {
              handleDismiss();
              navigate(active.route);
            }}
          >
            <span>{active.actionLabel} &rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default OnboardingTour;
