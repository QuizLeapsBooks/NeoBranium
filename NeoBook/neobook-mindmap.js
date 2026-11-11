const D3_URL = 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
const MAX_VISIBLE_NODES = 300;

export function initMindMapFeature(state, apiRequest, escapeHtml, showToast) {
  const setup = document.getElementById('mindMapSetupModal');
  const workspace = document.getElementById('mindMapWorkspace');
  const canvasWrap = document.getElementById('mindMapCanvasWrap');
  const svgElement = document.getElementById('mindMapSvg');
  if (!setup || !workspace || !canvasWrap || !svgElement) return;

  const view = {
    map: null,
    d3: null,
    svg: null,
    world: null,
    linksLayer: null,
    nodesLayer: null,
    zoom: null,
    selectedNodeId: null,
    collapsedNodeIds: new Set(),
    positions: {},
    viewport: { x: 0, y: 0, k: 1 },
    width: 0,
    height: 0,
    visibleNodes: [],
    saveTimer: null,
    saveInFlight: false,
    savePending: false,
    resizeObserver: null,
    isGenerating: false,
    identityEpoch: 0
  };

  const readySources = () => (state.sources || []).filter(source => source.status === 'ready');
  const nodeIndex = () => {
    const index = new Map();
    const visit = node => {
      if (!node || index.size >= MAX_VISIBLE_NODES) return;
      index.set(node.id, node);
      (node.children || []).forEach(visit);
    };
    visit(view.map?.tree);
    return index;
  };

  function setModalOpen(open) {
    setup.classList.toggle('open', open);
    setup.setAttribute('aria-hidden', String(!open));
  }

  function showLoading(show, message = '') {
    const loader = document.getElementById('mindMapLoading');
    const detail = document.getElementById('mindMapLoadingMessage');
    if (loader) loader.hidden = !show;
    if (detail && message) detail.textContent = message;
  }

  function renderSourceChoices() {
    const list = document.getElementById('mindMapSourceList');
    const sources = readySources();
    if (!list) return;
    if (!sources.length) {
      list.innerHTML = '<div class="mindmap-list-empty">Add a ready source to this chat before generating a mind map.</div>';
      return;
    }
    list.innerHTML = sources.map(source => `
      <label class="mindmap-source-option">
        <input type="checkbox" value="${escapeHtml(source.id)}" checked>
        <span class="mindmap-source-type"><i class="fas ${source.type === 'pdf' ? 'fa-file-pdf' : source.type === 'youtube' ? 'fa-play' : source.type === 'text' ? 'fa-align-left' : 'fa-globe'}"></i></span>
        <span class="mindmap-source-name">${escapeHtml(source.title || 'Untitled source')}</span>
      </label>
    `).join('');
  }

  function sourceMode() {
    return document.querySelector('input[name="mindMapSourceMode"]:checked')?.value || 'all';
  }

  function syncSourceMode() {
    const disabled = sourceMode() !== 'selected';
    document.querySelectorAll('#mindMapSourceList input[type="checkbox"]').forEach(input => {
      input.disabled = disabled;
    });
  }

  async function loadSavedMaps() {
    const list = document.getElementById('mindMapSavedList');
    if (!list || !state.activeNotebook?.id || !state.activeChat?.id) {
      if (list) list.innerHTML = '<div class="mindmap-list-empty">Open a chat to view its saved maps.</div>';
      return;
    }
    list.innerHTML = '<div class="mindmap-list-empty"><i class="fas fa-spinner fa-spin"></i> Loading saved maps…</div>';
    try {
      const response = await apiRequest(`/api/neobook/notebooks/${encodeURIComponent(state.activeNotebook.id)}/chats/${encodeURIComponent(state.activeChat.id)}/mindmaps`);
      const maps = response.maps || [];
      list.innerHTML = maps.length ? '' : '<div class="mindmap-list-empty">No saved maps in this chat yet.</div>';
      maps.forEach(map => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mindmap-saved-item';
        button.innerHTML = `<span class="mindmap-saved-icon"><i class="fas fa-diagram-project"></i></span><span class="mindmap-saved-text"><strong>${escapeHtml(map.title || 'Mind Map')}</strong><small>${map.nodeCount || 0} topics · ${map.sourceCount || 0} sources</small></span><i class="fas fa-chevron-right"></i>`;
        button.addEventListener('click', () => loadMap(map.id));
        list.appendChild(button);
      });
    } catch (error) {
      list.innerHTML = '<div class="mindmap-list-empty">Saved maps could not be loaded.</div>';
      showToast(error.message || 'Could not load saved mind maps.', 'error');
    }
  }

  async function openSetup() {
    renderSourceChoices();
    syncSourceMode();
    setModalOpen(true);
    await loadSavedMaps();
  }

  function collectNodeIds(tree, result = []) {
    if (!tree || result.length >= MAX_VISIBLE_NODES) return result;
    result.push(tree.id);
    (tree.children || []).forEach(child => collectNodeIds(child, result));
    return result;
  }

  function setCurrentMap(map, { fit = false } = {}) {
    view.map = map;
    view.hasRestoredViewport = false;
    view.selectedNodeId = map.uiState?.selectedNodeId || map.tree?.id || null;
    view.collapsedNodeIds = new Set(map.uiState?.collapsedNodeIds || []);
    view.positions = map.uiState?.positions || {};
    view.viewport = map.uiState?.viewport || { x: 0, y: 0, k: 1 };
    const title = document.getElementById('mindMapTitle');
    const sourceSummary = document.getElementById('mindMapSourceSummary');
    if (title) title.textContent = map.title || map.tree?.title || 'Mind Map';
    if (sourceSummary) sourceSummary.textContent = `${(map.sourceIds || []).length} source${map.sourceIds?.length === 1 ? '' : 's'} · ${map.nodeCount || collectNodeIds(map.tree).length} topics`;
    workspace.hidden = false;
    document.body.classList.add('mindmap-open');
    showLoading(false);
    if (document.getElementById('mindMapEmpty')) document.getElementById('mindMapEmpty').hidden = true;
    updateSelectedDetails();
    initializeGraph({ fit });
  }

  async function loadMap(mapId) {
    const identityEpoch = view.identityEpoch;
    setModalOpen(false);
    showLoading(true, 'Reopening your saved map.');
    workspace.hidden = false;
    document.body.classList.add('mindmap-open');
    try {
      const response = await apiRequest(`/api/neobook/mindmaps/${encodeURIComponent(mapId)}`);
      if (identityEpoch !== view.identityEpoch) return;
      setCurrentMap(response.map);
    } catch (error) {
      if (identityEpoch !== view.identityEpoch) return;
      showLoading(false);
      workspace.hidden = true;
      document.body.classList.remove('mindmap-open');
      showToast(error.message || 'Could not reopen this mind map.', 'error');
    }
  }

  function selectedSourceIds() {
    if (sourceMode() === 'all') return readySources().map(source => source.id);
    return [...document.querySelectorAll('#mindMapSourceList input[type="checkbox"]:checked')].map(input => input.value);
  }

  async function generate(sourceIds = selectedSourceIds()) {
    if (view.isGenerating) return;
    if (!state.activeNotebook?.id || !state.activeChat?.id) {
      showToast('Open a chat and add sources before generating a mind map.', 'error');
      return;
    }
    if (!sourceIds.length) {
      showToast('Select at least one ready source.', 'error');
      return;
    }
    view.isGenerating = true;
    const identityEpoch = view.identityEpoch;
    setModalOpen(false);
    workspace.hidden = false;
    document.body.classList.add('mindmap-open');
    showLoading(true, 'Finding themes and relationships in your sources.');
    document.getElementById('mindMapSvg').replaceChildren();
    try {
      const response = await apiRequest(`/api/neobook/notebooks/${encodeURIComponent(state.activeNotebook.id)}/mindmaps/generate`, {
        method: 'POST',
        body: JSON.stringify({
          chatId: state.activeChat.id,
          sourceIds,
          subject: state.activeNotebook.title || ''
        })
      });
      if (identityEpoch !== view.identityEpoch) return;
      setCurrentMap(response.map, { fit: true });
      showToast('Your mind map is ready to explore.', 'success');
    } catch (error) {
      if (identityEpoch !== view.identityEpoch) return;
      showLoading(false);
      const empty = document.getElementById('mindMapEmpty');
      if (empty) {
        empty.textContent = error.message || 'The mind map could not be generated.';
        empty.hidden = false;
      }
      showToast(error.message || 'Could not generate the mind map.', 'error');
    } finally {
      if (identityEpoch === view.identityEpoch) view.isGenerating = false;
    }
  }

  function visibleTree() {
    if (!view.map?.tree || !view.d3) return null;
    return view.d3.hierarchy(view.map.tree, node =>
      view.collapsedNodeIds.has(node.id) ? null : node.children
    );
  }

  function nodeClass(node, pathIds) {
    const classes = ['mindmap-node'];
    if (node.depth === 0) classes.push('is-root');
    else if (node.children?.length) classes.push('has-children');
    else classes.push('is-leaf');
    if (node.data.id === view.selectedNodeId) classes.push('is-selected');
    if (pathIds.has(node.data.id) && node.data.id !== view.selectedNodeId) classes.push('is-on-path');
    if (view.collapsedNodeIds.has(node.data.id)) classes.push('is-collapsed');
    if (node.data.isGenerating) classes.push('is-generating');
    return classes.join(' ');
  }

  function wrapTitle(text, limit = 25) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(word => {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > limit && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines.slice(0, 2);
  }

  function renderGraph({ fit = false } = {}) {
    if (!view.map?.tree || !view.d3 || !view.world) return;
    const d3 = view.d3;
    const root = visibleTree();
    if (!root) return;
    const layout = d3.tree().nodeSize([108, 270]);
    layout(root);
    root.each(node => {
      const saved = view.positions[node.data.id];
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        node.x = saved.x;
        node.y = saved.y;
      }
    });
    const nodes = root.descendants().slice(0, MAX_VISIBLE_NODES);
    preventNodeOverlaps(nodes);
    view.visibleNodes = nodes;
    const links = root.links().filter(link => nodes.includes(link.target));
    const linkPath = link => d3.linkHorizontal().x(point => point.x).y(point => point.y)({
      source: { x: link.source.y + 226, y: link.source.x },
      target: { x: link.target.y, y: link.target.x }
    });
    const pathIds = new Set();
    const selected = nodes.find(node => node.data.id === view.selectedNodeId);
    selected?.ancestors().forEach(node => pathIds.add(node.data.id));

    const linkSelection = view.linksLayer.selectAll('path.mindmap-link')
      .data(links, link => `${link.source.data.id}:${link.target.data.id}`);
    linkSelection.exit().transition().duration(140).style('opacity', 0).remove();
    linkSelection.enter().append('path')
      .attr('class', 'mindmap-link')
      .attr('d', link => linkPath({ source: link.source, target: link.source }))
      .merge(linkSelection)
      .classed('is-on-path', link => pathIds.has(link.source.data.id) && pathIds.has(link.target.data.id))
      .transition().duration(220)
      .attr('d', linkPath);

    const nodeSelection = view.nodesLayer.selectAll('g.mindmap-node')
      .data(nodes, node => node.data.id);
    nodeSelection.exit().transition().duration(140).style('opacity', 0).remove();
    const enter = nodeSelection.enter().append('g')
      .attr('class', 'mindmap-node')
      .attr('transform', node => `translate(${node.y},${node.x})`)
      .style('opacity', 0);
    enter.append('rect').attr('class', 'mindmap-node-card');
    enter.append('text').attr('class', 'mindmap-node-title');
    enter.append('text').attr('class', 'mindmap-node-summary');
    enter.append('circle').attr('class', 'mindmap-node-toggle').attr('r', 9);
    enter.append('text').attr('class', 'mindmap-node-toggle-label');
    enter.append('title');
    const merged = enter.merge(nodeSelection)
      .attr('class', node => nodeClass(node, pathIds))
      .attr('aria-label', node => `${node.data.title}. ${node.data.summary}`)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-expanded', node => String(Boolean(node.data.children?.length) && !view.collapsedNodeIds.has(node.data.id)))
      .attr('transform', node => `translate(${node.y},${node.x})`)
      .on('click', (event, node) => {
        event.stopPropagation();
        view.selectedNodeId = node.data.id;
        updateSelectedDetails();
        renderGraph();
        scheduleSave();
      })
      .on('keydown', (event, node) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        view.selectedNodeId = node.data.id;
        updateSelectedDetails();
        renderGraph();
        scheduleSave();
      });
    merged.select('title').text(node => `${node.data.title}\n${node.data.summary}`);
    merged.select('rect.mindmap-node-card')
      .attr('x', 0).attr('y', -42).attr('width', 226).attr('height', 84).attr('rx', 12);
    merged.select('text.mindmap-node-title').each(function(node) {
      const text = d3.select(this);
      text.selectAll('tspan').remove();
      wrapTitle(node.data.title).forEach((line, index) => {
        text.append('tspan').attr('x', 14).attr('y', wrapTitle(node.data.title).length > 1 ? -12 + index * 16 : -3)
          .text(line);
      });
    });
    merged.select('text.mindmap-node-summary')
      .attr('x', 14).attr('y', 18)
      .text(node => String(node.data.summary || '').slice(0, 55));
    merged.select('circle.mindmap-node-toggle')
      .attr('cx', 210).attr('cy', 0)
      .on('click', (event, node) => {
        event.stopPropagation();
        if (node.data.isGenerating) return;
        if (node.data.children?.length) {
          if (view.collapsedNodeIds.has(node.data.id)) view.collapsedNodeIds.delete(node.data.id);
          else view.collapsedNodeIds.add(node.data.id);
          renderGraph();
          scheduleSave();
        } else {
          void expandNode(node.data.id);
        }
      });
    merged.select('text.mindmap-node-toggle-label')
      .attr('x', 210).attr('y', 4)
      .text(node => node.data.children?.length
        ? (view.collapsedNodeIds.has(node.data.id) ? '+' : '−')
        : (node.data.isGenerating ? '…' : '+'))
      .on('click', (event, node) => {
        event.stopPropagation();
        if (node.data.isGenerating) return;
        if (node.data.children?.length) {
          if (view.collapsedNodeIds.has(node.data.id)) view.collapsedNodeIds.delete(node.data.id);
          else view.collapsedNodeIds.add(node.data.id);
          renderGraph();
          scheduleSave();
        } else {
          void expandNode(node.data.id);
        }
      });
    merged.transition().duration(180).style('opacity', 1);
    bindNodeDrag(merged);
    if (fit) fitToScreen();
  }

  function preventNodeOverlaps(nodes) {
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      for (let pass = 0; pass < 8; pass++) {
        let adjusted = false;
        for (let otherIndex = 0; otherIndex < index; otherIndex++) {
          const other = nodes[otherIndex];
          if (Math.abs(node.y - other.y) >= 242 || Math.abs(node.x - other.x) >= 100) continue;
          const nodeIsPinned = Boolean(view.positions[node.data.id]);
          const otherIsPinned = Boolean(view.positions[other.data.id]);
          const movable = nodeIsPinned && !otherIsPinned ? other : node;
          const fixed = movable === node ? other : node;
          movable.x = movable.x >= fixed.x ? fixed.x + 102 : fixed.x - 102;
          adjusted = true;
        }
        if (!adjusted) break;
      }
    }
  }

  function bindNodeDrag(selection) {
    const d3 = view.d3;
    selection.call(d3.drag()
      .on('start', function() { d3.select(this).raise().classed('is-dragging', true); })
      .on('drag', function(event, node) {
        let nextX = event.y;
        const nextY = event.x;
        for (let pass = 0; pass < 12; pass++) {
          let collided = false;
          for (const other of view.visibleNodes) {
            if (other.data.id === node.data.id) continue;
            if (Math.abs(nextY - other.y) < 242 && Math.abs(nextX - other.x) < 100) {
              nextX = nextX >= other.x ? other.x + 100 : other.x - 100;
              collided = true;
            }
          }
          if (!collided) break;
        }
        node.y = nextY;
        node.x = nextX;
        view.positions[node.data.id] = { x: node.x, y: node.y };
        d3.select(this).attr('transform', `translate(${node.y},${node.x})`);
        view.linksLayer.selectAll('path.mindmap-link')
          .attr('d', link => d3.linkHorizontal().x(point => point.x).y(point => point.y)({
            source: { x: link.source.y + 226, y: link.source.x },
            target: { x: link.target.y, y: link.target.x }
          }));
      })
      .on('end', function() {
        d3.select(this).classed('is-dragging', false);
        scheduleSave();
      }));
  }

  function initializeGraph({ fit = false } = {}) {
    if (!view.map?.tree || view.map.tree.children == null) return;
    if (!view.d3) {
      void import(D3_URL).then(d3 => {
        view.d3 = d3;
        initializeGraph({ fit });
      }).catch(error => {
        showLoading(false);
        const empty = document.getElementById('mindMapEmpty');
        if (empty) {
          empty.textContent = 'The map viewer could not load. Check your connection and try again.';
          empty.hidden = false;
        }
        console.error('[NeoBook Mind Map] Could not load D3:', error);
      });
      return;
    }
    const d3 = view.d3;
    const bounds = canvasWrap.getBoundingClientRect();
    view.width = Math.max(320, bounds.width);
    view.height = Math.max(360, bounds.height);
    view.svg = d3.select(svgElement).attr('width', view.width).attr('height', view.height);
    if (!view.world) {
      view.svg.selectAll('*').remove();
      view.world = view.svg.append('g').attr('class', 'mindmap-world');
      view.linksLayer = view.world.append('g').attr('class', 'mindmap-links');
      view.nodesLayer = view.world.append('g').attr('class', 'mindmap-nodes');
      view.zoom = d3.zoom().scaleExtent([0.03, 2.5])
        .on('zoom', event => {
          view.world.attr('transform', event.transform);
          view.viewport = { x: event.transform.x, y: event.transform.y, k: event.transform.k };
          scheduleSave();
        });
      view.svg.call(view.zoom).on('dblclick.zoom', null);
      view.resizeObserver = new ResizeObserver(() => initializeGraph());
      view.resizeObserver.observe(canvasWrap);
    }
    renderGraph({ fit });
    if (!view.hasRestoredViewport) {
      const initial = view.viewport;
      view.svg.call(view.zoom.transform, d3.zoomIdentity.translate(initial.x || 0, initial.y || 0).scale(initial.k || 1));
      view.hasRestoredViewport = true;
      if (fit || (initial.x === 0 && initial.y === 0 && initial.k === 1)) fitToScreen();
    }
    showLoading(false);
    document.body.classList.add('mindmap-open');
  }

  function fitToScreen() {
    if (!view.d3 || !view.svg || !view.zoom || !view.map) return;
    const root = visibleTree();
    if (!root) return;
    view.d3.tree().nodeSize([108, 270])(root);
    root.each(node => {
      const saved = view.positions[node.data.id];
      if (saved) { node.x = saved.x; node.y = saved.y; }
    });
    const nodes = root.descendants();
    preventNodeOverlaps(nodes);
    const xMin = Math.min(...nodes.map(node => node.y)) - 40;
    const xMax = Math.max(...nodes.map(node => node.y)) + 266;
    const yMin = Math.min(...nodes.map(node => node.x)) - 70;
    const yMax = Math.max(...nodes.map(node => node.x)) + 70;
    const width = Math.max(1, xMax - xMin);
    const height = Math.max(1, yMax - yMin);
    const scale = Math.max(0.03, Math.min(1.35, (view.width - 80) / width, (view.height - 90) / height));
    const x = (view.width - width * scale) / 2 - xMin * scale;
    const y = (view.height - height * scale) / 2 - yMin * scale;
    view.svg.transition().duration(240).call(view.zoom.transform, view.d3.zoomIdentity.translate(x, y).scale(scale));
  }

  function updateSelectedDetails() {
    const node = nodeIndex().get(view.selectedNodeId);
    const empty = document.querySelector('.mindmap-details-empty');
    const details = document.getElementById('mindMapNodeDetails');
    if (!node || !details) {
      if (empty) empty.hidden = false;
      if (details) details.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    details.hidden = false;
    document.getElementById('mindMapNodeTitle').textContent = node.title || 'Topic';
    document.getElementById('mindMapNodeSummary').textContent = node.summary || '';
    const answer = document.getElementById('mindMapAnswer');
    answer.hidden = true;
    answer.textContent = '';
    const citations = document.getElementById('mindMapCitationList');
    citations.replaceChildren();
    if (!node.citations?.length) {
      citations.innerHTML = '<span class="mindmap-no-citations">No direct source reference is available for this topic.</span>';
    } else {
      node.citations.forEach(citation => {
        const item = document.createElement(citation.url ? 'a' : 'div');
        item.className = 'mindmap-citation';
        if (citation.url) {
          item.href = citation.url;
          item.target = '_blank';
          item.rel = 'noopener noreferrer';
        }
        const locator = citation.pageNum ? ` · p. ${citation.pageNum}` : citation.timestamp ? ` · ${citation.timestamp}` : '';
        item.textContent = `${citation.title || 'Source'}${locator}`;
        citations.appendChild(item);
      });
    }
    document.getElementById('btnMindMapExpand').disabled = view.isGenerating;
    document.getElementById('btnMindMapExplain').disabled = view.isGenerating;
  }

  function scheduleSave() {
    if (!view.map?.id) return;
    clearTimeout(view.saveTimer);
    view.saveTimer = setTimeout(() => { void saveState(); }, 500);
  }

  async function saveState() {
    if (!view.map?.id) return;
    if (view.saveInFlight) {
      view.savePending = true;
      return;
    }
    view.saveInFlight = true;
    const mapId = view.map.id;
    const identityEpoch = view.identityEpoch;
    try {
      const result = await apiRequest(`/api/neobook/mindmaps/${encodeURIComponent(mapId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          uiState: {
            collapsedNodeIds: [...view.collapsedNodeIds],
            positions: view.positions,
            viewport: view.viewport,
            selectedNodeId: view.selectedNodeId
          }
        })
      });
      if (view.map?.id === mapId && view.identityEpoch === identityEpoch) view.map.uiState = result.uiState;
    } catch (error) {
      showToast(error.message || 'Could not save your map changes.', 'error');
    } finally {
      view.saveInFlight = false;
      if (view.savePending) {
        view.savePending = false;
        void saveState();
      }
    }
  }

  async function expandNode(nodeId) {
    if (!view.map?.id || view.isGenerating) return;
    const node = nodeIndex().get(nodeId);
    if (!node) return;
    view.isGenerating = true;
    const identityEpoch = view.identityEpoch;
    node.isGenerating = true;
    renderGraph();
    updateSelectedDetails();
    try {
      const response = await apiRequest(`/api/neobook/mindmaps/${encodeURIComponent(view.map.id)}/nodes/${encodeURIComponent(nodeId)}/expand`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      if (identityEpoch !== view.identityEpoch) return;
      node.children = [...(node.children || []), ...(response.children || [])];
      node.hasBeenExpanded = true;
      view.collapsedNodeIds.delete(nodeId);
      view.map.nodeCount = response.nodeCount;
      const summary = document.getElementById('mindMapSourceSummary');
      if (summary) summary.textContent = `${(view.map.sourceIds || []).length} source${view.map.sourceIds?.length === 1 ? '' : 's'} · ${view.map.nodeCount} topics`;
      renderGraph();
      updateSelectedDetails();
      showToast('Source-supported subtopics added.', 'success');
    } catch (error) {
      if (identityEpoch !== view.identityEpoch) return;
      showToast(error.message || 'Could not generate subtopics for this topic.', 'error');
    } finally {
      if (identityEpoch === view.identityEpoch) {
        node.isGenerating = false;
        view.isGenerating = false;
        renderGraph();
        updateSelectedDetails();
      }
    }
  }

  async function explainSelectedNode() {
    const nodeId = view.selectedNodeId;
    if (!view.map?.id || !nodeId || view.isGenerating) return;
    view.isGenerating = true;
    const identityEpoch = view.identityEpoch;
    updateSelectedDetails();
    const button = document.getElementById('btnMindMapExplain');
    const answer = document.getElementById('mindMapAnswer');
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Explaining…</span>';
    answer.hidden = false;
    answer.textContent = 'Finding the most relevant source passages…';
    try {
      const response = await apiRequest(`/api/neobook/mindmaps/${encodeURIComponent(view.map.id)}/nodes/${encodeURIComponent(nodeId)}/explain`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      if (identityEpoch !== view.identityEpoch) return;
      answer.textContent = response.explanation || 'No explanation was returned.';
      if (response.citations?.length) {
        const label = document.createElement('strong');
        label.textContent = 'Explanation references';
        answer.appendChild(document.createElement('br'));
        answer.appendChild(label);
        response.citations.forEach(citation => {
          const item = document.createElement('div');
          item.className = 'mindmap-answer-citation';
          item.textContent = `${citation.title || 'Source'}${citation.pageNum ? ` · p. ${citation.pageNum}` : citation.timestamp ? ` · ${citation.timestamp}` : ''}`;
          answer.appendChild(item);
        });
      }
    } catch (error) {
      if (identityEpoch !== view.identityEpoch) return;
      answer.textContent = error.message || 'Could not explain this topic.';
      showToast(error.message || 'Could not explain this topic.', 'error');
    } finally {
      if (identityEpoch === view.identityEpoch) {
        button.innerHTML = '<i class="fas fa-lightbulb"></i><span>Explain with AI</span>';
        view.isGenerating = false;
        updateSelectedDetails();
      }
    }
  }

  function setCollapsed(allCollapsed) {
    const expandableIds = [];
    const visit = (node, isRoot = false) => {
      if (!node) return;
      if (node.children?.length && !isRoot) expandableIds.push(node.id);
      (node.children || []).forEach(child => visit(child));
    };
    visit(view.map?.tree, true);
    view.collapsedNodeIds = allCollapsed ? new Set(expandableIds) : new Set();
    renderGraph();
    scheduleSave();
  }

  function downloadSvg() {
    const svg = document.getElementById('mindMapSvg');
    if (!svg || !view.map) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(view.width));
    clone.setAttribute('height', String(view.height));
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = '.mindmap-link{fill:none;stroke:#cbd5e1;stroke-width:1.6}.mindmap-link.is-on-path{stroke:#5b21b6;stroke-width:2.6}.mindmap-node-card{fill:#fff;stroke:#dbe1ea;stroke-width:1.2}.mindmap-node.is-root .mindmap-node-card{fill:#f4f0ff;stroke:#7c3aed;stroke-width:2}.mindmap-node.is-selected .mindmap-node-card{stroke:#5b21b6;stroke-width:2}.mindmap-node-title{font:600 13px sans-serif;fill:#1f2937}.mindmap-node-summary{font:11px sans-serif;fill:#6b7280}.mindmap-node-toggle{fill:#fff;stroke:#a78bfa;stroke-width:1.3}.mindmap-node-toggle-label{font:600 13px sans-serif;fill:#5b21b6;text-anchor:middle}';
    clone.prepend(style);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(view.map.title || 'mind-map').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').toLowerCase()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function closeWorkspace() {
    workspace.hidden = true;
    document.body.classList.remove('mindmap-open');
    clearTimeout(view.saveTimer);
    void saveState();
  }

  function clearForIdentityChange() {
    clearTimeout(view.saveTimer);
    view.identityEpoch++;
    view.savePending = false;
    view.isGenerating = false;
    view.resizeObserver?.disconnect();
    view.resizeObserver = null;
    view.map = null;
    view.collapsedNodeIds.clear();
    view.positions = {};
    view.selectedNodeId = null;
    view.hasRestoredViewport = false;
    workspace.hidden = true;
    document.body.classList.remove('mindmap-open');
    svgElement.replaceChildren();
    view.world = null;
    view.svg = null;
    view.linksLayer = null;
    view.nodesLayer = null;
    view.zoom = null;
  }

  document.addEventListener('neobook:identity-change', clearForIdentityChange);
  document.getElementById('btnOpenMindMap')?.addEventListener('click', openSetup);
  document.getElementById('btnOpenMindMap')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void openSetup();
    }
  });
  document.getElementById('btnCloseMindMapSetup')?.addEventListener('click', () => setModalOpen(false));
  document.getElementById('btnCancelMindMapSetup')?.addEventListener('click', () => setModalOpen(false));
  document.querySelectorAll('input[name="mindMapSourceMode"]').forEach(input => input.addEventListener('change', syncSourceMode));
  document.getElementById('btnGenerateMindMap')?.addEventListener('click', () => void generate());
  document.getElementById('btnMindMapBack')?.addEventListener('click', closeWorkspace);
  document.getElementById('btnMindMapRegenerate')?.addEventListener('click', () => {
    closeWorkspace();
    void openSetup();
  });
  document.getElementById('btnMindMapZoomIn')?.addEventListener('click', () => {
    if (view.svg && view.zoom) view.svg.transition().duration(140).call(view.zoom.scaleBy, 1.25);
  });
  document.getElementById('btnMindMapZoomOut')?.addEventListener('click', () => {
    if (view.svg && view.zoom) view.svg.transition().duration(140).call(view.zoom.scaleBy, 0.8);
  });
  document.getElementById('btnMindMapFit')?.addEventListener('click', fitToScreen);
  document.getElementById('btnMindMapExpandAll')?.addEventListener('click', () => setCollapsed(false));
  document.getElementById('btnMindMapCollapseAll')?.addEventListener('click', () => setCollapsed(true));
  document.getElementById('btnMindMapReset')?.addEventListener('click', () => {
    view.positions = {};
    view.collapsedNodeIds.clear();
    renderGraph({ fit: true });
    scheduleSave();
  });
  document.getElementById('btnMindMapExport')?.addEventListener('click', downloadSvg);
  document.getElementById('btnMindMapExplain')?.addEventListener('click', explainSelectedNode);
  document.getElementById('btnMindMapExpand')?.addEventListener('click', () => {
    if (view.selectedNodeId) void expandNode(view.selectedNodeId);
  });
}
