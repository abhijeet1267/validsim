/**
 * Failure Analysis controller for individual run detail pages.
 * Fetches run data and failures, renders decision banner, metrics, taxonomy chart,
 * and failed episodes list with proper loading/error states.
 */

const API_BASE = window.location.origin;

class FailureAnalysisController {
  constructor(runId) {
    this.runId = runId;
    this.runData = null;
    this.failuresData = null;

    // Cache DOM references
    this.dom = {};
    const domIds = [
      'loading-container', 'error-container', 'detail-container',
      'decision-banner', 'success-rate', 'composite-score', 'episode-count',
      'run-id', 'checkpoint-id', 'task-id', 'robot-name', 'env-name',
      'status-badge', 'created-at', 'failure-analysis-section',
      'failure-summary', 'failure-chart-container', 'episodes-container'
    ];
    domIds.forEach(id => {
      this.dom[id] = document.getElementById(id);
    });

    // PDF download handler
    this.downloadPdfBtn = document.getElementById('download-pdf-btn');
    if (this.downloadPdfBtn) {
      this.downloadPdfBtn.addEventListener('click', (e) => this.handlePdfDownload(e));
    }
  }

  async init() {
    try {
      await this.fetchData();
      this.render();
    } catch (error) {
      console.error('Failed to load run data:', error);
      this.showError(error.message || 'Failed to load run details');
    }
  }

  async fetchData() {
    // Parallel fetch of run metadata and failure analysis
    const [runResponse, failuresResponse] = await Promise.all([
      fetch(`${API_BASE}/api/v1/validations/${this.runId}`, {
        headers: { 'Accept': 'application/json' }
      }),
      fetch(`${API_BASE}/api/v1/validations/${this.runId}/failures`, {
        headers: { 'Accept': 'application/json' }
      })
    ]);

    if (!runResponse.ok) throw new Error(`HTTP ${runResponse.status}`);
    
    const runData = await runResponse.json();
    
    let failuresData = { episodes: [] };
    if (failuresResponse.ok) {
      failuresData = await failuresResponse.json();
    }

    this.runData = runData;
    this.failuresData = failuresData;
  }

  render() {
    if (!this.runData) return;

    // Render basic metadata first
    this.renderMetadata();

    // Then render state-specific content
    const hasFailures = this.failuresData.episodes && 
                       this.failuresData.episodes.length > 0;

    if (hasFailures) {
      this.renderFailureAnalysis();
    } else {
      this.renderSuccessState();
    }

    // Hide loading, show detail container
    if (this.dom['loading-container']) this.dom['loading-container'].classList.add('hidden');
    if (this.dom['detail-container']) this.dom['detail-container'].classList.remove('hidden');
  }

  renderMetadata() {
    const r = this.runData;

    this.dom['success-rate'].textContent = 
      ((r.success_rate || 0) * 100).toFixed(1) + '%';
    
    this.dom['composite-score'].textContent = 
      r.composite_score ? r.composite_score.toFixed(2) : '-';
    
    this.dom['episode-count'].textContent = r.episodes_count?.toString() || '0';

    this.dom['run-id'].textContent = r.run_id;
    this.dom['checkpoint-id'].textContent = r.checkpoint_id.slice(0, 32) + '...';
    this.dom['task-id'].textContent = r.task_name || r.task_id || '-';
    this.dom['robot-name'].textContent = r.robot_name || '-';
    this.dom['env-name'].textContent = r.environment_name || '-';

    this.dom['status-badge'].innerHTML = this.getStatusBadge(r.status);

    this.dom['created-at'].textContent = new Date(r.created_at).toLocaleString();

    // Render decision banner if deploy_decision exists
    if (r.deploy_decision) {
      this.renderDecisionBanner(r.deploy_decision);
    }
  }

  renderDecisionBanner(decision) {
    const isApproved = decision === 'APPROVE';
    
    this.dom['decision-banner'].innerHTML = `
      <div class="status-banner status-banner-${isApproved ? 'approved' : 'blocked'}">
        <h2 style="margin: 0;">${isApproved ? '✓' : '✗'} Deployment Decision: ${decision}</h2>
        <p class="mt-sm text-muted">${isApproved ? 
          'This run passed all validation gates and is approved for deployment.' : 
          'This run failed validation gates and should not be deployed.'}</p>
      </div>
    `;
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

  renderFailureAnalysis() {
    const taxonomy = this.failuresData.failure_taxonomy || {};
    const episodes = this.failuresData.episodes || [];
    const totalFailures = episodes.length;
    const episodeCount = this.runData.episodes_count || 1;
    
    // Show summary
    const failRate = ((totalFailures / episodeCount) * 100).toFixed(1);
    this.dom['failure-summary'].textContent = 
      `Detected ${totalFailures} failed episodes (${failRate}% failure rate) across ${Object.keys(taxonomy).length} distinct failure modes.`;

    // Render taxonomy bar chart
    let chartHTML = '<div style="display: flex; flex-direction: column; gap: var(--space-md);">';
    
    const sortedModes = Object.entries(taxonomy)
      .sort((a, b) => b[1] - a[1]);
    
    sortedModes.forEach(([mode, count]) => {
      const percentage = ((count / totalFailures) * 100).toFixed(1);
      chartHTML += `
        <div class="failure-mode-item">
          <div class="failure-mode-label">${this.escapeHtml(mode)}</div>
          <div class="failure-mode-bar-wrapper">
            <div class="failure-mode-bar" style="width: ${percentage}%"></div>
          </div>
          <div class="failure-mode-stats">
            <span>${this.escapeHtml(mode)}</span>
            <span class="font-mono text-small">
              ${count} episodes (${percentage}%)
            </span>
          </div>
        </div>
      `;
    });

    chartHTML += '</div>';
    this.dom['failure-chart-container'].innerHTML = chartHTML;

    // Render episodes table
    let episodesHTML = '<div class="table-container">';
    
    episodes.slice(0, 20).forEach(episode => {
      episodesHTML += `
        <div class="episode-row">
          <div style="display: flex; justify-content: space-between; padding: var(--space-sm) var(--space-md); border-bottom: 1px solid var(--bg-tertiary); font-family: var(--font-mono); font-size: 0.875rem;">
            <span style="flex: 1;" class="font-mono text-small">
              ${this.escapeHtml(episode.episode_id?.slice(0, 48) || '-')}
            </span>
            <span style="width: 180px; text-align: right;" class="text-muted">
              ${episode.timestamp ? new Date(episode.timestamp).toLocaleString() : '-'}
            </span>
          </div>
          <div style="padding: var(--space-sm) var(--space-md); color: var(--fg-muted); border-bottom: 1px solid var(--bg-tertiary); font-family: var(--font-mono); font-size: 0.875rem;">
            ${this.escapeHtml(episode.error_message || 'Unknown failure mode')}
          </div>
        </div>
      `;
    });

    episodesHTML += '</div>';
    this.dom['episodes-container'].innerHTML = episodesHTML;

    // Show failure analysis section
    this.dom['failure-analysis-section'].classList.remove('hidden');
  }

  renderSuccessState() {
    this.dom['decision-banner'].innerHTML = `
      <div class="status-banner status-banner-approved">
        <h2 style="margin: 0;">✓ Validation Passed</h2>
        <p class="mt-sm text-muted">No critical failures detected in this run.</p>
      </div>
    `;
    
    this.dom['failure-analysis-section'].classList.add('hidden');
  }

  showError(message) {
    if (this.dom['loading-container']) {
      this.dom['loading-container'].classList.add('hidden');
    }
    
    this.dom['error-container'].classList.remove('hidden');
    if (this.dom['error-message']) {
      this.dom['error-message'].textContent = message;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async handlePdfDownload(e) {
    e.preventDefault();
    
    if (!this.downloadPdfBtn) return;
    
    const originalText = this.downloadPdfBtn.textContent;
    this.downloadPdfBtn.textContent = '⏳ Downloading...';
    this.downloadPdfBtn.disabled = true;
    
    try {
      const response = await fetch(`${API_BASE}/api/v1/validations/${this.runId}/scorecard.pdf`, {
        headers: { 'Accept': 'application/pdf' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${this.runId}-scorecard.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download scorecard PDF. Please try again.');
    } finally {
      this.downloadPdfBtn.textContent = originalText;
      this.downloadPdfBtn.disabled = false;
    }
  }
}

// Initialize from URL path pattern: /validations/[id].html
const pathMatch = window.location.pathname.match(/\/validations\/([^/]+)\.html$/);
if (pathMatch) {
  const runId = decodeURIComponent(pathMatch[1]);
  new FailureAnalysisController(runId).init();
} else {
  console.warn('URL does not match expected pattern for validation detail page');
}
