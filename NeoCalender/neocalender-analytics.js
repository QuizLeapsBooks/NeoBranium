/**
 * NeoCalender/neocalender-analytics.js
 *
 * Client-side productivity analytics visualizer for NeoCalender.
 * Uses real task data from the backend to render stats, trends, and completion metrics.
 */

export class NeoCalenderAnalytics {
  constructor(containerEl) {
    this.container = containerEl;
  }

  render(stats) {
    if (!this.container) return;
    if (!stats) {
      this.container.innerHTML = '<div class="nc-empty-state"><i class="bi bi-bar-chart"></i><p>No analytics data available yet.</p></div>';
      return;
    }

    const {
      totalTasks = 0,
      totalCompleted = 0,
      pendingCount = 0,
      overdueCount = 0,
      completedToday = 0,
      completedThisWeek = 0,
      completionRate = 0,
      categoryCounts = {},
      priorityCounts = { low: 0, medium: 0, high: 0, urgent: 0 },
      dailyTrends = [],
      mostProductiveDay = 'N/A'
    } = stats;

    // Build trend chart bars
    const maxDailyCompleted = Math.max(1, ...dailyTrends.map(d => d.completed || 0));
    const trendBarsHtml = dailyTrends.map(d => {
      const heightPercent = Math.round(((d.completed || 0) / maxDailyCompleted) * 100);
      const dayLabel = new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' });
      return `
        <div class="nc-trend-col" title="${d.date}: ${d.completed} completed, ${d.created} created">
          <div class="nc-trend-bar-track">
            <div class="nc-trend-bar-fill" style="height: ${Math.max(8, heightPercent)}%">
              ${d.completed > 0 ? `<span class="nc-trend-count">${d.completed}</span>` : ''}
            </div>
          </div>
          <span class="nc-trend-label">${dayLabel}</span>
        </div>
      `;
    }).join('');

    // Category breakdown list
    const totalCategorized = Object.values(categoryCounts).reduce((a, b) => a + b, 0) || 1;
    const categoryBarsHtml = Object.entries(categoryCounts).map(([cat, count]) => {
      const pct = Math.round((count / totalCategorized) * 100);
      return `
        <div class="nc-stat-bar-item">
          <div class="nc-stat-bar-header">
            <span class="nc-stat-name">${this.escapeHtml(cat)}</span>
            <span class="nc-stat-val">${count} (${pct}%)</span>
          </div>
          <div class="nc-progress-track">
            <div class="nc-progress-fill nc-cat-fill" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }).join('') || '<p class="nc-muted-text">No categories assigned yet.</p>';

    // Priority breakdown
    const priorityColors = {
      urgent: 'var(--nc-urgent, #ef4444)',
      high: 'var(--nc-high, #f97316)',
      medium: 'var(--nc-medium, #eab308)',
      low: 'var(--nc-low, #10b981)'
    };
    const priorityBarsHtml = Object.entries(priorityCounts).map(([pri, count]) => {
      const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
      return `
        <div class="nc-stat-bar-item">
          <div class="nc-stat-bar-header">
            <span class="nc-stat-name text-capitalize">${pri}</span>
            <span class="nc-stat-val">${count} tasks</span>
          </div>
          <div class="nc-progress-track">
            <div class="nc-progress-fill" style="width: ${pct}%; background: ${priorityColors[pri]}"></div>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="nc-analytics-grid">
        <!-- Top Metrics Cards -->
        <div class="nc-metric-card">
          <div class="nc-metric-icon bg-success-subtle text-success">
            <i class="bi bi-check2-circle"></i>
          </div>
          <div class="nc-metric-copy">
            <span class="nc-metric-label">Completed Today</span>
            <h3 class="nc-metric-value">${completedToday}</h3>
            <span class="nc-metric-sub">${completedThisWeek} completed this week</span>
          </div>
        </div>

        <div class="nc-metric-card">
          <div class="nc-metric-icon bg-primary-subtle text-primary">
            <i class="bi bi-pie-chart-fill"></i>
          </div>
          <div class="nc-metric-copy">
            <span class="nc-metric-label">Completion Rate</span>
            <h3 class="nc-metric-value">${completionRate}%</h3>
            <span class="nc-metric-sub">${totalCompleted} of ${totalTasks} total tasks</span>
          </div>
        </div>

        <div class="nc-metric-card">
          <div class="nc-metric-icon bg-warning-subtle text-warning">
            <i class="bi bi-hourglass-split"></i>
          </div>
          <div class="nc-metric-copy">
            <span class="nc-metric-label">Pending Tasks</span>
            <h3 class="nc-metric-value">${pendingCount}</h3>
            <span class="nc-metric-sub">Active in your schedule</span>
          </div>
        </div>

        <div class="nc-metric-card ${overdueCount > 0 ? 'nc-metric-danger' : ''}">
          <div class="nc-metric-icon ${overdueCount > 0 ? 'bg-danger-subtle text-danger' : 'bg-secondary-subtle text-secondary'}">
            <i class="bi bi-exclamation-triangle"></i>
          </div>
          <div class="nc-metric-copy">
            <span class="nc-metric-label">Overdue Tasks</span>
            <h3 class="nc-metric-value ${overdueCount > 0 ? 'text-danger' : ''}">${overdueCount}</h3>
            <span class="nc-metric-sub">${overdueCount > 0 ? 'Need immediate attention' : 'All up to date!'}</span>
          </div>
        </div>
      </div>

      <!-- Highlights Banner -->
      <div class="nc-insight-banner mb-4">
        <i class="bi bi-lightning-charge-fill nc-insight-icon"></i>
        <div class="nc-insight-text">
          <strong>Productivity Insight:</strong> Your most productive day of the week is <strong>${mostProductiveDay}</strong>. Keep up your study rhythm!
        </div>
      </div>

      <!-- Two-column detailed breakdown -->
      <div class="nc-analytics-detail-grid">
        <!-- 7-Day Completion Trend -->
        <div class="nc-card">
          <div class="nc-card-header">
            <h4><i class="bi bi-graph-up me-2"></i>7-Day Completion Trend</h4>
          </div>
          <div class="nc-trend-chart">
            ${trendBarsHtml}
          </div>
        </div>

        <!-- Category Distribution -->
        <div class="nc-card">
          <div class="nc-card-header">
            <h4><i class="bi bi-tags me-2"></i>Task Distribution by Category</h4>
          </div>
          <div class="nc-stat-bars">
            ${categoryBarsHtml}
          </div>
        </div>

        <!-- Priority Breakdown -->
        <div class="nc-card nc-card-full">
          <div class="nc-card-header">
            <h4><i class="bi bi-flag me-2"></i>Priority Breakdown</h4>
          </div>
          <div class="nc-priority-bars-grid">
            ${priorityBarsHtml}
          </div>
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
