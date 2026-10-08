/**
 * Comparison Page Controller
 * Displays side-by-side regression analysis between two validation runs
 */

const API_BASE = ''; // Relative to current hosting context

class ComparisonController {
  constructor() {
    this.currentId = new URLSearchParams(window.location.search).get('current');
    this.baselineId = new URLSearchParams(window.location.search).get('baseline');
    
    this.loadingEl = document.getElementById('cmp-loading');
    this.errorEl = document.getElementById('cmp-error');
    this.emptyEl = document.getElementById('cmp-empty');
    this.resultsEl = document.getElementById('cmp-results');
    this.errorMsgEl = document.getElementById('cmp-error-msg');
    
    this.backBtn = document.getElementById('back-btn');
    this.retryBtn = document.getElementById('cmp-retry-btn');
    this.backLink = document.getElementById('cmp-back-btn');
    
    this.newComparisonBtn = document.getElementById('new-comparison-btn');
    
    this.init();
  }

  async init() {
    if (!this.currentId || !this.baselineId) {
      this.showState('error');
      this.errorMsgEl.textContent = 'Invalid comparison request. Missing run IDs.';
      return;
    }

    this.backBtn.addEventListener('click', () => window.location.href = '../validations/index.html');
    this.retryBtn.addEventListener('click', () => this.fetchComparison());
    this.backLink.addEventListener('click', () => window.location.href = '../validations/index.html');
    this.newComparisonBtn.addEventListener('click', () => window.location.href = '../validations/index.html');

    await this.fetchComparison();
  }

  async fetchComparison() {
    this.showState('loading');

    try {
      const response = await fetch(`${API_BASE}/api/v1/validations/${this.currentId}/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          baseline_id: this.baselineId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      this.render(data);

    } catch (error) {
      console.error('Failed to load comparison:', error);
      this.showState('error');
      this.errorMsgEl.textContent = error.message || 'Failed to load comparison data';
    }
  }

  render(data) {
    // Update breadcrumb
    document.getElementById('cmp-breadcrumb').textContent = `${data.run_id} vs ${data.baseline_id}`;

    // Update key metrics cards
    document.getElementById('stat-current-id').textContent = data.run_id;
    document.getElementById('stat-baseline-id').textContent = data.baseline_id;
    document.getElementById('stat-regressions-count').textContent = `${data.significant_count} detected`;
    document.getElementById('stat-comparison-type').textContent = 'Permutation Test + Relative Change';

    // Update decision banner
    document.getElementById('cmp-worst-severity').textContent = this.formatSeverity(data.worst_severity);
    document.getElementById('cmp-worst-severity').className = `severity-badge severity-${data.worst_severity}`;

    const hasRegressions = data.significant_count > 0;
    const summaryText = hasRegressions 
      ? `Out of ${data.items.length} metrics compared, ${data.significant_count} showed significant ${data.significant_count === data.items.length ? 'regressions' : 'changes'} (${data.worst_severity} severity).`
      : 'No significant regressions were detected between these two runs.';
    document.getElementById('cmp-summary-text').textContent = summaryText;

    // Build metric cards
    const successRateTemplate = document.getElementById('tmpl-success-rate');
    const durationTemplate = document.getElementById('tmpl-duration');
    const metricsSection = document.querySelector('.cmp-metrics-section');

    // Clear existing metric cards
    const existingCards = metricsSection.querySelectorAll('.cmp-metric-card');
    existingCards.forEach(card => card.remove());

    data.items.forEach(item => {
      let card;
      if (item.metric === 'success_rate') {
        card = successRateTemplate.content.cloneNode(true);
        
        // Format percentages
        const beforePct = (item.before * 100).toFixed(1);
        const afterPct = (item.after * 100).toFixed(1);
        const deltaPct = (item.delta * 100).toFixed(1);

        card.querySelector('.val-before').textContent = beforePct + '%';
        card.querySelector('.val-after').textContent = afterPct + '%';
        card.querySelector('.delta-val').textContent = item.delta < 0 ? '↓' : '↑';
        card.querySelector('.delta-pct').textContent = `${Math.abs(deltaPct)}${deltaPct < 0 ? '-' : '+'}`;
        
        if (item.p_value !== null) {
          card.querySelector('.p-val').textContent = item.p_value.toFixed(4);
          card.querySelector('.metric-significance').textContent = item.significant 
            ? (item.severity === 'critical' ? '⚠️ Significant' : '✓ Statistically Significant')
            : '✓ Not Significant';
        } else {
          card.querySelector('.metric-significance').textContent = 'Descriptive only';
        }

        card.querySelector('.severity-pill').textContent = this.formatSeverity(item.severity);
        card.querySelector('.severity-pill').className = `severity-pill severity-${item.severity}`;

      } else if (item.metric === 'mean_duration_s') {
        card = durationTemplate.content.cloneNode(true);
        
        const beforeSec = item.before.toFixed(2);
        const afterSec = item.after.toFixed(2);
        const deltaSec = item.delta.toFixed(2);
        const relativeChange = item.before > 0 ? (item.delta / item.before * 100).toFixed(1) : 0;

        card.querySelector('.val-before').textContent = beforeSec;
        card.querySelector('.val-after').textContent = afterSec;
        card.querySelector('.delta-val').textContent = item.delta > 0 ? '↑' : '↓';
        card.querySelector('.delta-pct').textContent = `${Math.abs(relativeChange)}%`;
        
        card.querySelector('.metric-significance').textContent = item.significant 
          ? (item.severity === 'critical' ? '⚠️ Significant' : '✓ Significant')
          : '✓ Within normal range';

        card.querySelector('.severity-pill').textContent = this.formatSeverity(item.severity);
        card.querySelector('.severity-pill').className = `severity-pill severity-${item.severity}`;
      }

      metricsSection.appendChild(card);
    });

    // Update action buttons
    document.getElementById('view-current-btn').href = `../validations/[id].html?id=${this.currentId}`;
    document.getElementById('view-baseline-btn').href = `../validations/[id].html?id=${this.baselineId}`;

    // Show results
    this.showState('results');
  }

  formatSeverity(severity) {
    switch (severity) {
      case 'critical': return '⚠️ Critical';
      case 'warning': return '⚡ Warning';
      case 'info': return 'ℹ️ Informational';
      default: return severity;
    }
  }

  showState(state) {
    this.loadingEl.classList.toggle('hidden', state !== 'loading');
    this.errorEl.classList.toggle('hidden', state !== 'error');
    this.emptyEl.classList.toggle('hidden', state !== 'empty');
    this.resultsEl.classList.toggle('hidden', state !== 'results');
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  new ComparisonController();
});
