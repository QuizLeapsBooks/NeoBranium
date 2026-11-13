import { auth, onAuthStateChanged } from '/js/auth.js';
import {
  createUsageApiClient,
  formatUsageValue,
  getFeatureLabel,
  prepareUsageView,
  getUtcDateRange,
  resolveUsageApiBase,
  validateUtcDateRange
} from '/js/ai-usage-dashboard-model.js';

const byId = id => document.getElementById(id);
const dashboardContent = byId('dashboardContent');
const signInNotice = byId('signInNotice');
const usageStatus = byId('usageStatus');
const usageError = byId('usageError');
const usageErrorText = byId('usageErrorText');
const usageView = byId('usageView');
const presetButtons = [...document.querySelectorAll('[data-preset]')];
const customRange = byId('customRange');
const rangeFrom = byId('rangeFrom');
const rangeTo = byId('rangeTo');
const backendUrl = resolveUsageApiBase(
  window.location.href,
  document.querySelector('meta[name="backend-url"]')?.content
);
const api = createUsageApiClient({
  apiBase: backendUrl,
  getCurrentUser: () => auth.currentUser
});

let activeRange = getUtcDateRange('7d');
let requestSequence = 0;
let authenticatedUser = null;
let authExpired = false;

function setHidden(element, hidden) {
  element.hidden = hidden;
}

function setStatus(text) {
  usageStatus.textContent = text;
}

function updateRangeButtons(preset) {
  for (const button of presetButtons) {
    const selected = button.dataset.preset === preset;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  setHidden(customRange, preset !== 'custom');
}

function makeSvgElement(tag, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function renderActivityChart(series) {
  const chart = byId('activityChart');
  chart.replaceChildren();
  const hasRequests = series.some(day => day.success + day.failed + day.cancelled > 0);
  setHidden(byId('activityEmpty'), hasRequests);
  if (!hasRequests) return;

  const width = 820;
  const height = 220;
  const margin = { top: 10, right: 12, bottom: 31, left: 36 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(1, ...series.map(day => day.success + day.failed + day.cancelled));
  const step = plotWidth / series.length;
  const barWidth = Math.max(2, Math.min(20, step * 0.62));
  const svg = makeSvgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': 'Daily successful, failed, and cancelled AI requests'
  });
  const title = makeSvgElement('title');
  title.textContent = 'Daily AI request activity';
  svg.append(title);

  for (let tick = 0; tick <= 3; tick += 1) {
    const value = Math.ceil(maxValue * tick / 3);
    const y = margin.top + plotHeight - plotHeight * tick / 3;
    svg.append(makeSvgElement('line', { x1: margin.left, x2: width - margin.right, y1: y, y2: y, class: 'aiu-svg-grid' }));
    const label = makeSvgElement('text', { x: margin.left - 7, y: y + 3, 'text-anchor': 'end', class: 'aiu-svg-label' });
    label.textContent = formatUsageValue(value);
    svg.append(label);
  }

  series.forEach((day, index) => {
    const x = margin.left + step * index + (step - barWidth) / 2;
    let bottom = margin.top + plotHeight;
    const total = day.success + day.failed + day.cancelled;
    const stack = [
      ['success', 'aiu-svg-success'],
      ['failed', 'aiu-svg-failed'],
      ['cancelled', 'aiu-svg-cancelled']
    ];
    for (const [field, className] of stack) {
      const barHeight = plotHeight * day[field] / maxValue;
      if (barHeight > 0) {
        bottom -= barHeight;
        const rect = makeSvgElement('rect', {
          x, y: bottom, width: barWidth, height: barHeight,
          rx: Math.min(3, barWidth / 3), class: className
        });
        const tooltip = makeSvgElement('title');
        tooltip.textContent = `${day.date}: ${day.success} successful, ${day.failed} failed, ${day.cancelled} cancelled`;
        rect.append(tooltip);
        svg.append(rect);
      }
    }
    const labelInterval = Math.ceil(series.length / 6);
    if (index % labelInterval === 0 || index === series.length - 1) {
      const label = makeSvgElement('text', {
        x: margin.left + step * index + step / 2,
        y: height - 8,
        'text-anchor': 'middle',
        class: 'aiu-svg-label'
      });
      label.textContent = day.date.slice(5);
      svg.append(label);
    }
    if (total === 0 && series.length <= 1) {
      const marker = makeSvgElement('circle', {
        cx: x + barWidth / 2, cy: margin.top + plotHeight, r: 2, fill: '#76869e'
      });
      svg.append(marker);
    }
  });
  chart.append(svg);
}

function renderTokens(totals) {
  const fields = [
    { title: 'Provider-measured', input: totals.providerInputTokens, output: totals.providerOutputTokens, className: '' },
    { title: 'Estimated', input: totals.estimatedInputTokens, output: totals.estimatedOutputTokens, className: 'aiu-token-fill--estimate' }
  ];
  const knownValues = fields.flatMap(group => [group.input, group.output]).filter(Number.isFinite);
  const empty = knownValues.length === 0;
  setHidden(byId('tokenEmpty'), !empty);
  const container = byId('tokenBreakdown');
  container.replaceChildren();
  if (empty) return;
  const maxValue = Math.max(1, ...knownValues);
  for (const group of fields) {
    if (group.input === null && group.output === null) continue;
    const section = document.createElement('div');
    section.className = 'aiu-token-group';
    const heading = document.createElement('div');
    heading.className = 'aiu-token-group-title';
    const label = document.createElement('span');
    label.textContent = group.title;
    const knownTotal = [group.input, group.output].filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
    const value = document.createElement('span');
    value.textContent = `${formatUsageValue(knownTotal)} known tokens`;
    heading.append(label, value);
    section.append(heading);
    for (const [name, amount, suffix] of [
      ['Input', group.input, ''],
      ['Output', group.output, ' aiu-token-fill--out']
    ]) {
      const line = document.createElement('div');
      line.className = 'aiu-token-line';
      const lineLabel = document.createElement('span');
      lineLabel.textContent = name;
      const track = document.createElement('div');
      track.className = 'aiu-token-track';
      const fill = document.createElement('div');
      fill.className = `aiu-token-fill${group.className}${suffix}`;
      fill.style.width = Number.isFinite(amount) ? `${Math.max(0, amount / maxValue * 100)}%` : '0%';
      track.append(fill);
      const number = document.createElement('strong');
      number.textContent = formatUsageValue(amount);
      line.append(lineLabel, track, number);
      section.append(line);
    }
    container.append(section);
  }
}

function renderFeatureBreakdown(byFeature) {
  const entries = Object.entries(byFeature).sort((a, b) => b[1].requests - a[1].requests);
  const list = byId('featureBreakdown');
  list.replaceChildren();
  setHidden(byId('featureEmpty'), entries.length > 0);
  const maxRequests = Math.max(1, ...entries.map(([, bucket]) => bucket.requests));
  for (const [feature, bucket] of entries) {
    const row = document.createElement('div');
    row.className = 'aiu-feature-row';
    const name = document.createElement('span');
    name.className = 'aiu-feature-name';
    name.textContent = getFeatureLabel(feature);
    const count = document.createElement('span');
    count.className = 'aiu-feature-count';
    count.textContent = `${formatUsageValue(bucket.requests)} requests`;
    const track = document.createElement('div');
    track.className = 'aiu-feature-track';
    const fill = document.createElement('span');
    fill.style.width = `${bucket.requests / maxRequests * 100}%`;
    track.append(fill);
    row.append(name, count, track);
    list.append(row);
  }
}

function renderProviderBreakdown(byProvider) {
  const entries = Object.entries(byProvider).sort((a, b) => b[1].providerAttempts - a[1].providerAttempts);
  const list = byId('providerBreakdown');
  list.replaceChildren();
  setHidden(byId('providerEmpty'), entries.length > 0);
  for (const [provider, bucket] of entries) {
    const row = document.createElement('div');
    row.className = 'aiu-provider-row';
    const name = document.createElement('span');
    name.textContent = provider === 'unknown'
      ? 'Unclassified provider'
      : provider.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
    const count = document.createElement('span');
    count.textContent = `${formatUsageValue(bucket.providerAttempts)} provider attempts`;
    row.append(name, count);
    list.append(row);
  }
}

function renderTable(byFeature) {
  const entries = Object.entries(byFeature).sort((a, b) => b[1].requests - a[1].requests);
  const body = byId('usageTableBody');
  body.replaceChildren();
  setHidden(byId('tableEmpty'), entries.length > 0);
  for (const [feature, bucket] of entries) {
    const row = document.createElement('tr');
    const values = [
      getFeatureLabel(feature),
      bucket.requests,
      bucket.successfulRequests,
      bucket.failedRequests,
      bucket.cancelledRequests,
      bucket.providerInputTokens,
      bucket.providerOutputTokens,
      bucket.estimatedKnownTotalTokens,
      bucket.fallbackAttempts
    ];
    for (const [index, value] of values.entries()) {
      const cell = document.createElement('td');
      cell.textContent = index === 0 ? value : formatUsageValue(value);
      row.append(cell);
    }
    body.append(row);
  }
}

function renderUsage(payload) {
  const usage = prepareUsageView(payload.daily, activeRange.from, activeRange.to);
  const totals = usage.totals;
  for (const [id, value] of [
    ['metricRequests', totals.requests],
    ['metricSuccess', totals.successfulRequests],
    ['metricFailed', totals.failedRequests],
    ['metricInput', totals.providerInputTokens],
    ['metricOutput', totals.providerOutputTokens],
    ['metricEstimated', totals.estimatedKnownTotalTokens],
    ['metricFallbacks', totals.fallbackAttempts]
  ]) {
    byId(id).textContent = formatUsageValue(value);
  }
  const unavailable = totals.unavailableUsageAttempts > 0 || totals.partiallyKnownUsageAttempts > 0;
  byId('metricInput').nextElementSibling.textContent = unavailable
    ? 'Known provider reports; some usage unavailable'
    : 'Reported by providers';
  byId('metricOutput').nextElementSibling.textContent = unavailable
    ? 'Known provider reports; some usage unavailable'
    : 'Reported by providers';

  renderActivityChart(usage.series);
  renderTokens(totals);
  renderFeatureBreakdown(usage.byFeature);
  renderProviderBreakdown(usage.byProvider);
  renderTable(usage.byFeature);
}

async function loadUsage() {
  if (!authenticatedUser || authExpired) return;
  const sequence = ++requestSequence;
  setHidden(usageError, true);
  setHidden(usageView, true);
  setStatus('Loading persisted usage…');
  try {
    const payload = await api.fetchDaily(activeRange.from, activeRange.to, authenticatedUser);
    if (sequence !== requestSequence) return;
    renderUsage(payload);
    setHidden(usageView, false);
    setStatus(payload.daily.length ? `Showing ${activeRange.from} to ${activeRange.to} (UTC).` : 'No saved daily usage for this period.');
  } catch (error) {
    if (sequence !== requestSequence) return;
    setStatus('');
    usageErrorText.textContent = error.message || 'Could not load AI usage.';
    const retryButton = byId('retryButton');
    retryButton.textContent = error.code === 'AUTH_EXPIRED' ? 'Sign in again' : 'Try again';
    if (error.code === 'AUTH_EXPIRED') {
      authExpired = true;
      for (const control of [...presetButtons, byId('applyRange')]) control.disabled = true;
      retryButton.onclick = () => { window.location.href = '/htmls/sign.html'; };
    } else {
      retryButton.onclick = loadUsage;
    }
    setHidden(usageError, false);
  }
}

for (const button of presetButtons) {
  button.addEventListener('click', () => {
    const preset = button.dataset.preset;
    updateRangeButtons(preset);
    if (preset === 'custom') {
      const defaults = getUtcDateRange('7d');
      rangeFrom.value = defaults.from;
      rangeTo.value = defaults.to;
      const today = new Date().toISOString().slice(0, 10);
      rangeFrom.max = today;
      rangeTo.max = today;
      return;
    }
    activeRange = getUtcDateRange(preset);
    loadUsage();
  });
}

byId('applyRange').addEventListener('click', () => {
  const today = new Date().toISOString().slice(0, 10);
  if (!validateUtcDateRange(rangeFrom.value, rangeTo.value, today)) {
    setStatus('Choose valid UTC dates in order, within the last 90 days.');
    return;
  }
  activeRange = { from: rangeFrom.value, to: rangeTo.value };
  loadUsage();
});

byId('menuToggle').addEventListener('click', () => {
  const sidebar = byId('sidebar');
  const open = !sidebar.classList.contains('is-open');
  sidebar.classList.toggle('is-open', open);
  byId('menuToggle').setAttribute('aria-expanded', String(open));
  setHidden(byId('navBackdrop'), !open);
});
byId('navBackdrop').addEventListener('click', () => {
  byId('sidebar').classList.remove('is-open');
  byId('menuToggle').setAttribute('aria-expanded', 'false');
  setHidden(byId('navBackdrop'), true);
});

setStatus('Checking your sign-in…');
onAuthStateChanged(auth, user => {
  authenticatedUser = user;
  authExpired = false;
  for (const control of [...presetButtons, byId('applyRange')]) control.disabled = false;
  setHidden(dashboardContent, !user);
  setHidden(signInNotice, Boolean(user));
  if (user) loadUsage();
  else {
    requestSequence += 1;
    setStatus('');
  }
});
