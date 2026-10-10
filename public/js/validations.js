/**
 * Validations page controller. Fetches runs from API, renders list/detail views,
 * handles loading/error/empty states with graceful degradation if JS fails to load.
 */

const API_BASE = window.location.origin;

class ValidationController {
  constructor(elementId) {
    this.container = document.getElementById(elementId);
    this.runsData = null;
  }

  async init() {
    this.container.classList.remove('hidden');
    await this.fetchRuns();
    this.render();
  }

  async fetchRuns(limit = 50, offset = 0) {
    try {
      const url = new URL(`${API_BASE}/api/v1/validations`);
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('offset', offset.toString());

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.runsData = data.validations || [];
      return this.runsData;
    } catch (error) {
      console.error('Failed to fetch validations:', error);
      this.runsData = [];
      throw error;
    }
  }

  render() {
    if (!this.runsData || this.runsData.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.renderTable(this.runsData);
  }

  renderTable(runs) {
    let tableHTML = `
      <table>
        <thead>
          <tr>
            <th>Run ID</th>
            <th>Checkpoint</th>
            <th>Status</th>
            <th>Success Rate</th>
            <th>Score</th>
            <th>Decision</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
    `;

    runs.forEach(run => {
      const runUrl = `/validations/${run.run_id}.html`;
      const statusBadge = this.getStatusBadge(run.status);
      const scoreDisplay = run.success_rate ? `${(run.success_rate * 100).toFixed(1)}%` : '-';
      const decisionBadgethis.getDecisionBadge(run.deploy_decision);
      const dateDisplay = new Date(run.created_at).toLocaleDateString();

      tableHTML += `
        <tr>
          <td><a href="${runUrl}">${run.run_id.slice(0, 8)}...</a></td>
          <td class="font-mono text-small">${run.checkpoint_id.slice(0, 12)}...</td>
          <td>${statusBadge}</td>
          <td>${scoreDisplay}</td>
          <td>${run.composite_score ? run.composite_score.toFixed(2) : '-'}</td>
          <td>${decisionBadget}</td>
          <td class="text-small text-muted">${dateDisplay}</td>
        </tr>
      `;
    });

    tableHTML += '</tbody></table>';
    this.container.innerHTML = tableHTML;
  }

  getStatusBadge(status) {
    const badges = {
      'COMPLETED': '<span class="badge badge-success">✓ Completed</span>',
      'RUNNING': '<span class="badge badge-info">• Running</span>',
      'FAILED': '<span class="badge badge-danger">✗ Failed</span>',
      'BLOCKED': '<span class="badge badge-warning">⚠ Blocked</span>',
      'CREATED': '<span class="badge badge-neutral">Created</span>'
    };
    return badges[status] || badges['CREATED'];
  }

  getDecisionBadge(decision) {
    if (!decision) return '<span class="badge badge-neutral">-</span>';
    
    if (decision === 'APPROVE') {
      return '<span class="badge badge-success" style="--accent: var(--success)">✓ Approved</span>';
    }
    if (decision === 'BLOCK') {
      return '<span class="badge badge-danger" style="--accent: var(--danger)">✗ Blocked</span>';
    }
    return '<span class="badge badge-neutral">Unknown</span>';
  }

  renderEmptyState() {
    this.container.innerHTML = `
      <div class="card empty-state">
        <div class="empty-state-icon">📊</div>
        <h3>No validation runs yet</h3>
        <p>Start a validation run to see results here.</p>
        <button class="btn btn-primary mt-md" onclick="window.location.href='/'">Go to Home</button>
      </div>
    `;
  }

  showError(message = 'Failed to load validation data') {
    this.container.innerHTML = `
      <div class="card error-state">
        <span class="error-icon">⚠️</span>
        <h3>Error Loading Data</h3>
        <p>${message}</p>
        <button class="btn btn-secondary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

/**
 * Failure Analysis view for individual run detail pages
 */
class FailureAnalysisController {
  constructor(runId) {
    this.runId = runId;
    this.data = null;
  }

  async init() {
    await this.fetchData();
    this.render();
  }

  async fetchData() {
    try {
      const [runResponse, failuresResponse] = await Promise.all([
        fetch(`${API_BASE}/api/v1/validations/${this.runId}`, { headers: { 'Accept': 'application/json' } }),
        fetch(`${API_BASE}/api/v1/validations/${this.runId}/failures`, { headers: { 'Accept': 'application/json' } })
      ]);

      if (!runResponse.ok || !failuresResponse.ok) throw new Error('Failed to fetch run data');

      const [runData, failuresData] = await Promise.all([runResponse.json(), failuresResponse.json()]);
      this.data = { run: runData, failures: failuresData };
    } catch (error) {
      console.error('Failed to fetch failure data:', error);
      this.data = null;
    }
  }

  render() {
    if (!this.data) {
      this.renderError();
      return;
    }

    if (!this.data.failures.episodes || this.data.failures.episodes.length === 0) {
      this.renderSuccessState();
      return;
    }

    this.renderFailureAnalysis(this.data.failures);
  }

  renderFailureAnalysis(failures) {
    const taxonomy = failures.failure_taxonomy || {};
    const episodes = failures.episodes || [];
    
    let chartHTML = '<div class="chart-container" style="margin-top: var(--space-lg);">';
    
    const sortedModes = Object.entries(taxonomy).sort((a, b) => b[1] - a[1]);
    
    sortedModes.forEach(([mode, count]) => {
      const percentage = ((count / episodes.length) * 100).toFixed(1);
      chartHTML += `
        <div class="failure-mode-item">
          <div class="failure-mode-label">${mode}</div>
          <div class="failure-mode-bar-wrapper">
            <div class="failure-mode-bar" style="width: ${percentage}%"></div>
          </div>
          <div class="failure-mode-stats">
            <span class="font-mono text-small">${count} episodes (${percentage}%)</span>
          </div>
        </div>
      `;
    });

    chartHTML += '</div>';

    let episodesHTML = `<h3>Recent Failed Episodes</h3><div class="table-container mt-md">`;
    
    episodes.slice(0, 20).forEach(episode => {
      episodesHTML += `
        <div class="episode-row" style="padding: var(--space-sm) var(--space-md); border-bottom: 1px solid var(--bg-tertiary); font-family: var(--font-mono); font-size: 0.875rem;">
          <div style="display: flex; justify-content: space-between;">
            <span>${episode.episode_id?.slice(0, 32) || '-'}</span>
            <span class="text-muted">${new Date(episode.timestamp).toLocaleString()}</span>
          </div>
          <div style="color: var(--fg-muted); margin-top: var(--space-xs);">${episode.error_message || 'Unknown failure'}</div>
        </div>
      `;
    });

    episodesHTML += '</div>';

    const totalFailures = episodes.length;
    const successRate = ((totalFailures > 0 ? 1 - (totalFailures / this.data.run.episodes_count) : 1) * 100).toFixed(1);

    const html = `
      <div class="mt-lg">
        <div class="status-banner status-banner-blocked">
          <h2 style="margin: 0;">⚠️ Validation Blocked</h2>
          <p class="mt-sm">This run failed validation gates with ${totalFailures} failure episodes detected.</p>
        </div>

        <div class="card">
          <h3>Failure Taxonomy</h3>
          <p class="text-muted text-small">Distribution of failure modes across all failed episodes (${totalFailures} total)</p>
          ${chartHTML}
        </div>

        <div class="card mt-lg">
          ${episodesHTML}
        </div>
      </div>
    `;

    this.container.replaceWith(html);
  }

  renderSuccessState() {
    const html = `
      <div class="mt-lg">
        <div class="status-banner status-banner-approved">
          <h2 style="margin: 0;">✓ Validation Passed</h2>
          <p class="mt-sm">No critical failures detected in this run.</p>
        </div>
      </div>
    `;
    this.container.replaceWith(html);
  }

  renderError() {
    this.container.innerHTML = `
      <div class="card error-state">
        <span class="error-icon">⚠️</span>
        <h3>Error Loading Failure Data</h3>
        <p>Failed to retrieve failure analysis for this run.</p>
        <button class="btn btn-secondary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

// Initialize failure analysis on detail pages
const runIdMatch = location.pathname.match(/\/validations\/([^/]+)\.html/);
if (runIdMatch) {
  const container = document.getElementById('failure-analysis-container');
  if (container) {
    // Replace container element with inline HTML
    new FailureAnalysisController(runIdMatch[1]).init().then(() => {}).catch(() => {});
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('[data-controller="validations"]');
    if (container) {
      const controller = new ValidationController(container.id);
      controller.init().catch(() => controller.showError());
    }
  });
} else {
  const container = document.querySelector('[data-controller="validations"]');
  if (container) {
    const controller = new ValidationController(container.id);
    controller.init().catch(() => controller.showError());
  }
}
