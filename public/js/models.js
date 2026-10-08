/**
 * Models registry controller. Fetches checkpoint registry and regression history,
 * displays in table format with status indicators and action links.
 */

const API_BASE = window.location.origin;

class ModelsController {
  constructor() {
    this.modelsData = null;
    this.regressionsData = null;
    
    // DOM elements
    this.loadingContainer = document.getElementById('loading-container');
    this.errorContainer = document.getElementById('error-container');
    this.emptyContainer = document.getElementById('empty-container');
    this.tableContainer = document.getElementById('models-table-container');
    this.modelsBody = document.getElementById('models-body');
    this.errorMessage = document.getElementById('error-message');
  }

  async init() {
    try {
      await this.fetchData();
      this.render();
    } catch (error) {
      console.error('Failed to load models:', error);
      this.showError(error.message || 'Failed to load model registry');
    }
  }

  async fetchData() {
    // Fetch models list and regressions in parallel
    const [modelsResponse, regressionsResponse] = await Promise.all([
      fetch(`${API_BASE}/api/v1/models`, { headers: { 'Accept': 'application/json' } }),
      fetch(`${API_BASE}/api/v1/regressions`, { headers: { 'Accept': 'application/json' } })
    ]);

    if (!modelsResponse.ok) throw new Error(`HTTP ${modelsResponse.status}`);
    if (!regressionsResponse.ok && regressionsResponse.status !== 404) {
      throw new Error(`HTTP ${regressionsResponse.status}`);
    }

    const [modelsData, regressionsData] = await Promise.all([
      modelsResponse.json(),
      regressionsResponse.ok ? regressionsResponse.json() : []
    ]);

    this.modelsData = modelsData.checkpoints || [];
    this.regressionsData = Array.isArray(regressionsData) ? regressionsData : [];
  }

  render() {
    if (!this.modelsData || this.modelsData.length === 0) {
      this.showEmptyState();
      return;
    }

    this.renderTable(this.modelsData);
  }

  renderTable(checkpoints) {
    let rowsHTML = '';

    checkpoints.forEach(checkpoint => {
      const latestValidation = this.getLatestValidation(checkpoint.id);
      const hasRegistion = this.hasRegression(checkpoint.id);
      
      const hashDisplay = checkpoint.hash?.slice(0, 12) + '...' || '-';
      const statusBadge = this.getStatusBadge(checkpoint.status);
      
      let validationDisplay = '-';
      let statusClass = '';
      
      if (latestValidation) {
        const successRate = (latestValidation.success_rate || 0) * 100;
        validationDisplay = `
          <div style="display: flex; align-items: center; gap: var(--space-xs);">
            <span class="font-mono text-small">${successRate.toFixed(1)}%</span>
            ${statusBadge}
          </div>
        `;
        statusClass = successRate >= 80 ? 'stats-card-success' : successRate >= 50 ? 'stats-card-warning' : 'stats-card-danger';
      }

      const viewUrl = `../validations/${latestValidation?.run_id || 'detail'}.html`;

      rowsHTML += `
        <tr>
          <td class="font-bold">${checkpoint.id.slice(0, 20)}</td>
          <td class="font-mono text-small text-muted">${hashDisplay}</td>
          <td>${validationDisplay}</td>
          <td>${hasRegistion ? '<span class="badge badge-danger">Regressive</span>' : '<span class="badge badge-neutral">Stable</span>'}</td>
          <td>
            ${latestValidation?.run_id 
              ? `<a href="${viewUrl}" class="btn btn-primary" style="padding: var(--space-xs) var(--space-sm); font-size: 0.8125rem;">View Run</a>`
              : '<span class="text-muted text-small">-</span>'
            }
          </td>
        </tr>
      `;
    });

    this.modelsBody.innerHTML = rowsHTML;
    this.showTable();
  }

  getLatestValidation(checkpointId) {
    // Find most recent validation for this checkpoint
    const validations = this.modelsData.flatMap(cp => cp.validations || []);
    const checkpointValidations = validations.filter(v => v.checkpoint_id === checkpointId);
    return checkpointValidations.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }

  hasRegression(checkpointId) {
    return this.regressionsData.some(r => {
      return r.run_id.includes(checkpointId) || r.baseline_id?.includes(checkpointId);
    });
  }

  getStatusBadge(validation) {
    if (!validation) return '<span class="badge badge-neutral">-</span>';
    
    const score = validation.composite_score || validation.success_rate * 100;
    if (score >= 80) return '<span class="badge badge-success">✓ Pass</span>';
    if (score >= 50) return '<span class="badge badge-warning">⚠ Warning</span>';
    return '<span class="badge badge-danger">✗ Fail</span>';
  }

  showTable() {
    this.loadingContainer.classList.add('hidden');
    this.errorContainer.classList.add('hidden');
    this.emptyContainer.classList.add('hidden');
    this.tableContainer.classList.remove('hidden');
  }

  showEmptyState() {
    this.loadingContainer.classList.add('hidden');
    this.emptyContainer.classList.remove('hidden');
  }

  showError(message) {
    this.loadingContainer.classList.add('hidden');
    this.errorMessage.textContent = message;
    this.errorContainer.classList.remove('hidden');
  }
}

// Initialize when ready
document.addEventListener('DOMContentLoaded', () => {
  const controller = new ModelsController();
  controller.init();
});
