import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  ShoppingCart,
  Check,
  ShieldCheck,
  CheckSquare,
  Square,
  Plus,
  Minus,
  Info,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { aiApi } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import CartAiReviewModal from '../components/CartAiReviewModal';
import { handleImageError } from '../utils/imageFallback';
import UI_STRINGS from '../constants/uiStrings';

const STARTING_TEMPLATES = [
  {
    id: 'hostel',
    label: 'Hostel Starter Kit',
    budgetText: 'Under ₹5,000',
    budgetValue: '5000',
    desc: 'Kettle, study lamp, power strip & essentials for a dorm room',
    prompt: 'I need a complete hostel setup under ₹5,000.'
  },
  {
    id: 'gaming',
    label: 'Gaming Desk Setup',
    budgetText: 'Under ₹30,000',
    budgetValue: '30000',
    desc: 'High-refresh monitor, mechanical keyboard, precision mouse & headset',
    prompt: 'Build me a gaming setup under ₹30,000.'
  },
  {
    id: 'wfh',
    label: 'Work From Home',
    budgetText: 'Under ₹20,000',
    budgetValue: '20000',
    desc: 'Ergonomic chair, workspace desk, lighting & productivity gear',
    prompt: 'Find me a work-from-home setup under ₹20,000.'
  },
  {
    id: 'study',
    label: 'College Study Kit',
    budgetText: 'Under ₹8,000',
    budgetValue: '8000',
    desc: 'Study lamp, notebooks, scientific calculator & backpack',
    prompt: 'Build a study setup for a college student under ₹8,000.'
  }
];

function SmartShop() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    cart,
    totalCount,
    discountPercent,
    discountAmount,
    finalTotal,
    hasPersistedCartItems,
    applyApprovedItems,
    setLastShoppingObjective
  } = useCart();

  const initialQuery = searchParams.get('q') || '';
  const [promptInput, setPromptInput] = useState(initialQuery);
  const [budgetInput, setBudgetInput] = useState('');
  const [submittedRequest, setSubmittedRequest] = useState(initialQuery);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState('');
  const [proposal, setProposal] = useState(null);

  // Temporary proposal local state: checkboxes + editable quantities + optional cross-sell checkbox
  const [selectedIds, setSelectedIds] = useState({});
  const [proposalQuantities, setProposalQuantities] = useState({});
  const [includeCrossSell, setIncludeCrossSell] = useState(false);
  const [approvingState, setApprovingState] = useState('');
  const [approvalFeedback, setApprovalFeedback] = useState('');

  // Check My Cart Modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const generateProposal = useCallback(
    async (queryText, customBudget = '') => {
      let clean = (queryText || '').trim();
      if (!clean) return;

      const numericBudget = String(customBudget || '').replace(/[^0-9]/g, '');
      if (numericBudget && !/under|below|within|₹|rs/i.test(clean)) {
        clean = `${clean} under ₹${Number(numericBudget).toLocaleString('en-IN')}`;
      }

      setLoadingPlan(true);
      setPlanError('');
      setApprovalFeedback('');
      setSubmittedRequest(clean);
      try {
        const response = await aiApi.post('/smart-shop/plan', { message: clean });
        const prop = response.data.proposal;
        setProposal(prop);
        setLastShoppingObjective(clean);

        const initialChecks = {};
        const initialQtys = {};
        (prop?.items || []).forEach((item) => {
          if (item.product?._id) {
            initialChecks[item.product._id] = true;
            initialQtys[item.product._id] = item.quantity || 1;
          }
        });
        setSelectedIds(initialChecks);
        setProposalQuantities(initialQtys);
        setIncludeCrossSell(false);
      } catch (err) {
        setPlanError(
          err.response?.data?.message ||
            'Unable to build your suggested bundle right now. Please try again.'
        );
      } finally {
        setLoadingPlan(false);
      }
    },
    [setLastShoppingObjective]
  );

  useEffect(() => {
    if (initialQuery) {
      setPromptInput(initialQuery);
      generateProposal(initialQuery);
    }
  }, [initialQuery, generateProposal]);

  const handlePlanSubmit = (e) => {
    e.preventDefault();
    generateProposal(promptInput, budgetInput);
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (promptInput.trim() && !loadingPlan) {
        generateProposal(promptInput, budgetInput);
      }
    }
  };

  const handleTemplateClick = (tpl) => {
    setPromptInput(tpl.prompt);
    setBudgetInput(tpl.budgetValue || '');
    generateProposal(tpl.prompt, '');
  };

  const toggleProposalItemSelection = (productId) => {
    setSelectedIds((prev) => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const updateProposalItemQuantity = (productId, delta, maxStock) => {
    setProposalQuantities((prev) => {
      const current = prev[productId] || 1;
      const limit = Math.max(1, Math.min(20, maxStock || 10));
      const next = Math.max(1, Math.min(limit, current + delta));
      return { ...prev, [productId]: next };
    });
  };

  const selectAllProposalItems = (checked) => {
    if (!proposal?.items) return;
    const next = {};
    proposal.items.forEach((item) => {
      if (item.product?._id) {
        next[item.product._id] = checked;
      }
    });
    setSelectedIds(next);
    if (!checked) setIncludeCrossSell(false);
  };

  // Compute selected items count & total INR (including optional cross-sell if checked)
  const { selectedItemsList, selectedItemCount, selectedSubtotalINR } = useMemo(() => {
    if (!proposal?.items) {
      return { selectedItemsList: [], selectedItemCount: 0, selectedSubtotalINR: 0 };
    }
    const list = [];
    let sum = 0;

    proposal.items.forEach((item) => {
      const pid = item.product?._id;
      if (pid && selectedIds[pid]) {
        const qty = proposalQuantities[pid] || item.quantity || 1;
        list.push({ productId: pid, quantity: qty, name: item.product.name });
        sum += (item.product.price || 0) * qty;
      }
    });

    if (includeCrossSell && proposal.crossSell?.product?._id) {
      const csProd = proposal.crossSell.product;
      list.push({ productId: csProd._id, quantity: 1, name: csProd.name });
      sum += csProd.price || 0;
    }

    return {
      selectedItemsList: list,
      selectedItemCount: list.length,
      selectedSubtotalINR: sum
    };
  }, [proposal, selectedIds, proposalQuantities, includeCrossSell]);

  const effectiveBudget = useMemo(() => {
    if (proposal?.budget !== null && proposal?.budget !== undefined) {
      return Number(proposal.budget);
    }
    const manual = Number(String(budgetInput).replace(/[^0-9]/g, ''));
    return manual > 0 ? manual : null;
  }, [proposal, budgetInput]);

  const budgetRemaining =
    effectiveBudget !== null ? effectiveBudget - selectedSubtotalINR : null;

  const budgetPercentUsed =
    effectiveBudget && effectiveBudget > 0
      ? Math.min(100, Math.round((selectedSubtotalINR / effectiveBudget) * 100))
      : 0;

  const isOverBudget = budgetRemaining !== null && budgetRemaining < 0;

  const handleApproveSelected = async () => {
    if (selectedItemsList.length === 0) {
      setApprovalFeedback('Select at least one item from your bundle to add to your cart.');
      return;
    }

    setApprovingState('batch');
    setApprovalFeedback('');
    const res = await applyApprovedItems(
      selectedItemsList.map(({ productId, quantity }) => ({ productId, quantity })),
      submittedRequest || promptInput
    );
    setApprovingState('');

    if (!res.success) {
      if (res.status === 401) {
        showToast('Please sign in or click "Try Demo Account" to add this bundle to your cart', 'error');
        navigate('/login');
        return;
      }
      setApprovalFeedback(res.message);
      showToast(res.message || 'Unable to add bundle to cart', 'error');
    } else {
      const totalUnitsAdded = selectedItemsList.reduce((acc, i) => acc + i.quantity, 0);
      const msg = `Added ${selectedItemsList.length} ${
        selectedItemsList.length === 1 ? 'item' : 'items'
      } (${totalUnitsAdded} ${totalUnitsAdded === 1 ? 'unit' : 'units'}) to your cart`;
      setApprovalFeedback(msg);
      showToast(msg, 'success');
    }
  };

  const handleApproveSingleItem = async (productId, quantity, productName) => {
    setApprovingState(productId);
    setApprovalFeedback('');
    const res = await applyApprovedItems(
      [{ productId, quantity }],
      submittedRequest || promptInput
    );
    setApprovingState('');

    if (!res.success) {
      if (res.status === 401) {
        showToast('Please sign in or click "Try Demo Account" to add items to your cart', 'error');
        navigate('/login');
        return;
      }
      setApprovalFeedback(res.message);
      showToast(res.message || 'Unable to add item', 'error');
    } else {
      const msg = `Added ${quantity}× ${productName} to your cart`;
      setApprovalFeedback(msg);
      showToast(msg, 'success');
    }
  };

  return (
    <div className="smart-shop-container">
      {/* Page Header */}
      <div className="shop-by-goal-top-header">
        <div>
          <span className="section-eyebrow">Goal-Based Bundle Planner</span>
          <h1>{UI_STRINGS.shopByGoal}</h1>
          <p className="smart-shop-subtext">
            Describe what you are setting up and your budget. We will assemble a suggested bundle
            from in-stock items that you can tweak before adding to your cart.
          </p>
        </div>

        {/* Persisted Cart Status & Strict Check My Cart Visibility */}
        <div className="goal-persisted-cart-pill">
          <div className="goal-cart-pill-meta">
            <span className="cart-status-eyebrow">Your Active Cart</span>
            <strong>
              {totalCount} {totalCount === 1 ? 'unit' : 'units'} · ₹
              {finalTotal.toLocaleString('en-IN')}
            </strong>
            {discountAmount > 0 && (
              <span className="cart-status-discount-tag">{discountPercent}% off applied</span>
            )}
          </div>

          {/* NON-NEGOTIABLE HARD RULE: Check My Cart button ONLY renders when persisted cart has >= 1 item */}
          {hasPersistedCartItems && (
            <div className="goal-cart-pill-actions">
              <button
                type="button"
                className="smartkart-ai-review-btn"
                onClick={() => setIsReviewModalOpen(true)}
              >
                <ShieldCheck size={15} />
                <span>{UI_STRINGS.checkMyCart}</span>
              </button>
              <Link to="/cart" className="btn btn-outline btn-sm-inline">
                <ShoppingCart size={14} />
                <span>Go to Cart</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Two-Column Split Layout: Left = Prompt & Budget | Right = Your Suggested Bundle */}
      <div className="shop-by-goal-split-grid">
        {/* LEFT COLUMN: Prompt + Budget + Starter Goals */}
        <aside className="goal-left-panel">
          <div className="goal-composer-card">
            <h2 className="goal-panel-title">1. Describe Your Goal &amp; Budget</h2>
            <form onSubmit={handlePlanSubmit} className="goal-form-stack">
              <div className="form-group" style={{ marginBottom: '0.9rem' }}>
                <label htmlFor="smart-shop-mission-input" className="form-label">
                  What are you looking to set up or buy?
                </label>
                <textarea
                  id="smart-shop-mission-input"
                  rows={3}
                  className="form-input smart-shop-textarea"
                  placeholder='e.g., "Build a gaming desk setup under ₹30,000" or "I need 4 ergonomic chairs under ₹25,000"'
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  disabled={loadingPlan}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="smart-shop-budget-input" className="form-label">
                  Target Budget (₹ INR — optional if already in prompt)
                </label>
                <input
                  id="smart-shop-budget-input"
                  type="number"
                  min="500"
                  step="500"
                  className="form-input"
                  placeholder="e.g., 15000"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  disabled={loadingPlan}
                />
              </div>

              <button
                type="submit"
                className="btn btn-ai"
                style={{ width: '100%' }}
                disabled={loadingPlan || !promptInput.trim()}
              >
                <Sparkles size={17} />
                <span>
                  {loadingPlan ? 'Building Suggested Bundle...' : 'Build Suggested Bundle'}
                </span>
              </button>
            </form>

            <div className="starting-missions-section">
              <span className="templates-label">Or pick a starter goal:</span>
              <div className="starting-templates-stack">
                {STARTING_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="template-card"
                    onClick={() => handleTemplateClick(tpl)}
                    disabled={loadingPlan}
                  >
                    <div className="template-card-header">
                      <span className="template-card-title">{tpl.label}</span>
                      <span className="template-card-badge">{tpl.budgetText}</span>
                    </div>
                    <p className="template-card-prompt">{tpl.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Your Suggested Bundle */}
        <section className="goal-right-bundle-panel" aria-live="polite">
          {loadingPlan && (
            <div className="bundle-loading-card" aria-busy="true">
              <div className="loading-spinner" />
              <h3>Finding the best in-stock items for your goal...</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
                Checking real inventory prices, quantities, and budget constraints. Your cart will
                not be changed until you approve.
              </p>
              <div className="bundle-skeleton-list">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="skeleton-box" style={{ height: '96px', borderRadius: '12px' }} />
                ))}
              </div>
            </div>
          )}

          {!loadingPlan && planError && (
            <div className="error-state">
              <AlertCircle size={28} style={{ margin: '0 auto 0.5rem', color: 'var(--error-color)' }} />
              <h3>Could not build bundle</h3>
              <p style={{ margin: '0.5rem 0 1rem' }}>{planError}</p>
              <button
                type="button"
                className="btn btn-primary btn-inline"
                onClick={() => generateProposal(promptInput, budgetInput)}
              >
                <RotateCcw size={15} />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {!loadingPlan && !planError && !proposal && (
            <div className="bundle-empty-placeholder">
              <div className="bundle-empty-icon">
                <Sparkles size={26} />
              </div>
              <h3>2. {UI_STRINGS.suggestedBundle}</h3>
              <p>
                Enter what you need on the left or click one of the starter goals. You will get an
                interactive bundle here with a live budget bar, checkboxes, and quantity steppers.
              </p>
              <div className="bundle-safety-note">
                <Info size={15} />
                <span>{UI_STRINGS.tooltips.temporaryBundle}</span>
              </div>
            </div>
          )}

          {!loadingPlan && proposal && (
            <div className="proposal-workspace-section">
              <div className="proposal-banner-card">
                <div className="proposal-top-title-row">
                  <div>
                    <div className="proposal-title-with-hint">
                      <h2 className="proposal-heading">{UI_STRINGS.suggestedBundle}</h2>
                      <span
                        className="tooltip-trigger"
                        title={UI_STRINGS.tooltips.temporaryBundle}
                        aria-label={UI_STRINGS.tooltips.temporaryBundle}
                      >
                        <Info size={15} />
                        <span className="tooltip-bubble">{UI_STRINGS.tooltips.temporaryBundle}</span>
                      </span>
                    </div>
                    <p className="proposal-summary-copy">{proposal.summary}</p>
                    {proposal.tradeOffs && (
                      <p className="proposal-tradeoff-copy">
                        <strong>Bundle note:</strong> {proposal.tradeOffs}
                      </p>
                    )}
                  </div>
                </div>

                {/* Budget Progress Bar (Used vs Remaining) */}
                <div className="budget-progress-container">
                  <div className="budget-progress-labels">
                    <div>
                      <span className="budget-stat-label">Selected Total: </span>
                      <strong className="budget-stat-val">
                        ₹{selectedSubtotalINR.toLocaleString('en-IN')}
                      </strong>
                      <span className="budget-stat-sub">
                        {' '}
                        ({selectedItemCount} {selectedItemCount === 1 ? 'item' : 'items'} checked)
                      </span>
                    </div>

                    {effectiveBudget !== null && (
                      <div>
                        <span className="budget-stat-label">Target Budget: </span>
                        <strong className="budget-stat-val">
                          ₹{effectiveBudget.toLocaleString('en-IN')}
                        </strong>
                        {' · '}
                        <span
                          style={{
                            fontWeight: 700,
                            color: isOverBudget ? 'var(--error-color)' : 'var(--emerald-text)'
                          }}
                        >
                          {isOverBudget
                            ? `₹${Math.abs(budgetRemaining).toLocaleString('en-IN')} over budget`
                            : `₹${budgetRemaining.toLocaleString('en-IN')} remaining`}
                        </span>
                      </div>
                    )}
                  </div>

                  {effectiveBudget !== null && (
                    <div
                      className="budget-progress-track"
                      role="progressbar"
                      aria-valuenow={budgetPercentUsed}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`budget-progress-fill ${isOverBudget ? 'over' : ''}`}
                        style={{ width: `${budgetPercentUsed}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Primary Approval Action Bar */}
                {proposal.items && proposal.items.length > 0 && (
                  <div className="proposal-actions-toolbar">
                    <button
                      type="button"
                      className="btn btn-primary btn-inline"
                      onClick={handleApproveSelected}
                      disabled={Boolean(approvingState) || selectedItemCount === 0}
                    >
                      <ShoppingCart size={16} />
                      <span>
                        {approvingState === 'batch'
                          ? 'Adding to Cart...'
                          : UI_STRINGS.formatAddSelectedToCart(
                              selectedItemCount,
                              selectedSubtotalINR
                            )}
                      </span>
                    </button>

                    <div className="proposal-select-toggles">
                      <button
                        type="button"
                        className="proposal-text-btn"
                        onClick={() => selectAllProposalItems(true)}
                      >
                        <CheckSquare size={14} />
                        <span>Select all</span>
                      </button>
                      <button
                        type="button"
                        className="proposal-text-btn"
                        onClick={() => selectAllProposalItems(false)}
                      >
                        <Square size={14} />
                        <span>Unselect all</span>
                      </button>
                    </div>
                  </div>
                )}

                {approvalFeedback && (
                  <div className="ai-status-banner" style={{ marginTop: '0.85rem' }}>
                    <Check size={17} />
                    <span>{approvalFeedback}</span>
                    <Link
                      to="/cart"
                      style={{
                        marginLeft: 'auto',
                        fontWeight: 700,
                        textDecoration: 'underline',
                        color: 'inherit'
                      }}
                    >
                      View Cart &rarr;
                    </Link>
                  </div>
                )}
              </div>

              {/* Bundle Items List with Checkboxes, Quantity Steppers, and 1-Line "Why this?" */}
              {proposal.items && proposal.items.length > 0 ? (
                <div className="bundle-items-stack">
                  {proposal.items.map((item) => {
                    const prod = item.product;
                    const isSelected = Boolean(selectedIds[prod._id]);
                    const currentQty = proposalQuantities[prod._id] || item.quantity || 1;
                    const isAddingThis = approvingState === prod._id;
                    const maxStock = prod.stock || 10;

                    return (
                      <article
                        key={prod._id}
                        className={`bundle-item-row-card ${isSelected ? 'selected' : ''}`}
                      >
                        <div className="bundle-item-check-col">
                          <input
                            type="checkbox"
                            className="bundle-checkbox"
                            checked={isSelected}
                            onChange={() => toggleProposalItemSelection(prod._id)}
                            aria-label={`Select ${prod.name}`}
                          />
                        </div>

                        <Link to={`/products/${prod._id}`} className="bundle-item-thumb-link">
                          <img
                            src={prod.image}
                            alt={prod.name}
                            referrerPolicy="no-referrer"
                            className="bundle-item-img"
                            onError={handleImageError}
                          />
                        </Link>

                        <div className="bundle-item-info-col">
                          <div className="bundle-item-top-line">
                            <Link to={`/products/${prod._id}`} className="proposal-item-title">
                              {prod.name}
                            </Link>
                            <span className="bundle-item-line-price">
                              ₹{(prod.price * currentQty).toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="bundle-item-meta-line">
                            <span>₹{prod.price.toLocaleString('en-IN')} each</span>
                            <span>·</span>
                            <span>{prod.category}</span>
                            <span>·</span>
                            <span>
                              {prod.stock <= 5
                                ? `Only ${prod.stock} left`
                                : `${prod.stock} in stock`}
                            </span>
                          </div>

                          {/* One-line "Why this?" */}
                          <p className="bundle-why-this-line">
                            <strong>Why this?</strong> {item.reason}
                          </p>

                          <div className="bundle-item-controls-row">
                            <div className="quantity-control-group">
                              <button
                                type="button"
                                className="qty-btn"
                                onClick={() => updateProposalItemQuantity(prod._id, -1, maxStock)}
                                disabled={currentQty <= 1}
                                aria-label={`Decrease quantity for ${prod.name}`}
                              >
                                <Minus size={14} />
                              </button>
                              <span className="qty-value">{currentQty}</span>
                              <button
                                type="button"
                                className="qty-btn"
                                onClick={() => updateProposalItemQuantity(prod._id, 1, maxStock)}
                                disabled={currentQty >= maxStock}
                                aria-label={`Increase quantity for ${prod.name}`}
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <button
                              type="button"
                              className="btn btn-outline btn-sm-inline"
                              onClick={() =>
                                handleApproveSingleItem(prod._id, currentQty, prod.name)
                              }
                              disabled={Boolean(approvingState)}
                            >
                              <ShoppingCart size={14} />
                              <span>{isAddingThis ? 'Adding...' : 'Add just this'}</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state" style={{ marginTop: '1rem' }}>
                  No in-stock products matched all constraints. Try widening your budget or
                  adjusting your goal.
                </div>
              )}

              {/* Cross-Sell Card: "Customers also add this" */}
              {proposal.crossSell && proposal.crossSell.product && (
                <div className="cross-sell-card">
                  <div className="cross-sell-inner">
                    <div className="cross-sell-left">
                      <input
                        type="checkbox"
                        className="bundle-checkbox"
                        checked={includeCrossSell}
                        onChange={(e) => setIncludeCrossSell(e.target.checked)}
                        aria-label={`Include ${proposal.crossSell.product.name} in bundle`}
                      />
                      <img
                        src={proposal.crossSell.product.image}
                        alt={proposal.crossSell.product.name}
                        referrerPolicy="no-referrer"
                        onError={handleImageError}
                        className="cross-sell-thumb"
                      />
                      <div>
                        <span className="section-eyebrow" style={{ marginBottom: '0.2rem' }}>
                          {UI_STRINGS.crossSellTitle}
                        </span>
                        <h3 style={{ fontSize: '1.04rem' }}>
                          {proposal.crossSell.product.name} — ₹
                          {proposal.crossSell.product.price.toLocaleString('en-IN')}
                        </h3>
                        <p
                          style={{
                            fontSize: '0.86rem',
                            color: 'var(--text-muted)',
                            marginTop: '0.15rem'
                          }}
                        >
                          <strong>Why this?</strong> {proposal.crossSell.reason}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline btn-inline"
                      onClick={() =>
                        handleApproveSingleItem(
                          proposal.crossSell.product._id,
                          1,
                          proposal.crossSell.product.name
                        )
                      }
                      disabled={Boolean(approvingState)}
                    >
                      <ShoppingCart size={15} />
                      <span>Add to Cart</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Check My Cart Modal (only renders when persisted cart has >= 1 product) */}
      <CartAiReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        initialObjective={submittedRequest || promptInput}
      />
    </div>
  );
}

export default SmartShop;
