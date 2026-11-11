const D3_URL = 'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js';
const MAX_VISIBLE_NODES = 300;
const MAX_FULL_GRAPH_ANIMATION_NODES = 120;
const MAX_ANIMATED_BATCH_SIZE = 24;
const MAX_ANIMATED_MOVED_NODES = 40;
let d3LoadPromise = null;

function loadD3() {
  if (globalThis.d3) return Promise.resolve(globalThis.d3);
  if (d3LoadPromise) return d3LoadPromise;
  d3LoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = D3_URL;
    script.async = true;
    script.onload = () => {
      if (globalThis.d3) resolve(globalThis.d3);
      else {
        script.remove();
        reject(new Error('D3 loaded without exposing its API.'));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('D3 could not be downloaded.'));
    };
    document.head.appendChild(script);
  }).catch(error => {
    d3LoadPromise = null;
    throw error;
  });
  return d3LoadPromise;
}

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
    visibleNodeById: new Map(),
    nodeById: new Map(),
    nodeElements: new Map(),
    linkElements: new Map(),
    pathNodeIds: new Set(),
    pathLinkKeys: new Set(),
    saveTimer: null,
    saveInFlight: false,
    savePending: false,
    resizeObserver: null,
    resizeFrame: 0,
    dragFrame: 0,
    pendingDrag: null,
    dragIndex: null,
    dragBehavior: null,
    d3Promise: null,
    pendingFit: false,
    savedMapsController: null,
    savedMapsPromise: null,
    savedMapsKey: null,
    mapController: null,
    aiController: null,
    generatingNodeId: null,
    isGenerating: false,
    identityEpoch: 0,
    operationEpoch: 0
  };

  const readySources = () => (state.sources || []).filter(source => source.status === 'ready');
  const nodeIndex = () => view.nodeById;

  function indexNodes(tree) {
    const index = new Map();
    const stack = tree ? [tree] : [];
    while (stack.length && index.size < MAX_VISIBLE_NODES) {
      const node = stack.pop();
      if (!node || index.has(node.id)) continue;
      index.set(node.id, node);
      for (let childIndex = (node.children || []).length - 1; childIndex >= 0; childIndex--) {
        stack.push(node.children[childIndex]);
      }
    }
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
    const requestKey = `${state.activeNotebook.id}:${state.activeChat.id}:${view.identityEpoch}`;
    if (view.savedMapsKey === requestKey && view.savedMapsPromise) {
      await view.savedMapsPromise;
      return;
    }
    view.savedMapsController?.abort();
    const controller = new AbortController();
    view.savedMapsController = controller;
    view.savedMapsKey = requestKey;
    list.innerHTML = '<div class="mindmap-list-empty"><i class="fas fa-spinner fa-spin"></i> Loading saved maps…</div>';
    const request = (async () => {
      try {
        const response = await apiRequest(`/api/neobook/notebooks/${encodeURIComponent(state.activeNotebook.id)}/chats/${encodeURIComponent(state.activeChat.id)}/mindmaps`, {
          signal: controller.signal
        });
        if (requestKey !== view.savedMapsKey) return;
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
        if (controller.signal.aborted || requestKey !== view.savedMapsKey) return;
        list.innerHTML = '<div class="mindmap-list-empty">Saved maps could not be loaded.</div>';
        showToast(error.message || 'Could not load saved mind maps.', 'error');
      } finally {
        if (view.savedMapsKey === requestKey) {
          view.savedMapsPromise = null;
          view.savedMapsController = null;
        }
      }
    })();
    view.savedMapsPromise = request;
    await request;
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
    cancelExpandAll();
    view.map = map;
    view.nodeById = indexNodes(map.tree);
    view.hasRestoredViewport = false;
    view.selectedNodeId = map.uiState?.selectedNodeId || map.tree?.id || null;
    view.collapsedNodeIds = new Set(map.uiState?.collapsedNodeIds || []);
    view.positions = map.uiState?.positions || {};
    view.visibleNodes = [];
    view.nodeElements.clear();
    view.linkElements.clear();
    view.pathNodeIds.clear();
    view.pathLinkKeys.clear();
    const answer = document.getElementById('mindMapAnswer');
    if (answer) {
      answer.hidden = true;
      answer.textContent = '';
    }
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
    const operationEpoch = view.operationEpoch;
    view.mapController?.abort();
    const controller = new AbortController();
    view.mapController = controller;
    setModalOpen(false);
    showLoading(true, 'Reopening your saved map.');
    workspace.hidden = false;
    document.body.classList.add('mindmap-open');
    try {
      const response = await apiRequest(`/api/neobook/mindmaps/${encodeURIComponent(mapId)}`, {
        signal: controller.signal
      });
      if (identityEpoch !== view.identityEpoch || operationEpoch !== view.operationEpoch) return;
      setCurrentMap(response.map);
    } catch (error) {
      if (identityEpoch !== view.identityEpoch || operationEpoch !== view.operationEpoch || controller.signal.aborted) return;
      showLoading(false);
      workspace.hidden = true;
      document.body.classList.remove('mindmap-open');
      showToast(error.message || 'Could not reopen this mind map.', 'error');
    } finally {
      if (view.mapController === controller) view.mapController = null;
    }
  }

  function selectedSourceIds() {
    if (sourceMode() === 'all') return readySources().map(source => source.id);
    return [...document.querySelectorAll('#mindMapSourceList input[type="checkbox"]:checked')].map(input => input.value);
  }

  function getProgressivelyCollapsedIds(tree) {
    return (tree?.children || [])
      .filter(node => node.children?.length)
      .map(node => node.id);
  }

  function cancelAiRequest() {
    view.operationEpoch++;
    view.aiController?.abort();
    view.aiController = null;
    if (view.generatingNodeId) {
      setNodeGeneratingState(view.generatingNodeId, false);
      view.generatingNodeId = null;
    }
    view.isGenerating = false;
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
    const operationEpoch = view.operationEpoch;
    const controller = new AbortController();
    view.aiController = controller;
    setModalOpen(false);
    workspace.hidden = false;
    document.body.classList.add('mindmap-open');
    showLoading(true, 'Finding themes and relationships in your sources.');
    try {
      const response = await apiRequest(`/api/neobook/notebooks/${encodeURIComponent(state.activeNotebook.id)}/mindmaps/generate`, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          chatId: state.activeChat.id,
          sourceIds,
          subject: state.activeNotebook.title || ''
        })
      });
      if (identityEpoch !== view.identityEpoch || operationEpoch !== view.operationEpoch) return;
      const generatedMap = response.map;
      const progressivelyCollapsedIds = generatedMap.nodeCount > MAX_FULL_GRAPH_ANIMATION_NODES
        && !generatedMap.uiState?.collapsedNodeIds?.length
        ? getProgressivelyCollapsedIds(generatedMap.tree)
        : [];
      if (progressivelyCollapsedIds.length) {
        generatedMap.uiState = {
          ...generatedMap.uiState,
          collapsedNodeIds: progressivelyCollapsedIds
        };
      }
      setCurrentMap(generatedMap, { fit: true });
      if (progressivelyCollapsedIds.length) scheduleSave();
      showToast('Your mind map is ready to explore.', 'success');
    } catch (error) {
      if (identityEpoch !== view.identityEpoch || operationEpoch !== view.operationEpoch) return;
      showLoading(false);
      const empty = document.getElementById('mindMapEmpty');
      if (empty) {
        empty.textContent = error.message || 'The mind map could not be generated.';
        empty.hidden = false;
      }
      showToast(error.message || 'Could not generate the mind map.', 'error');
    } finally {
      if (view.aiController === controller) view.aiController = null;
      if (identityEpoch === view.identityEpoch && operationEpoch === view.operationEpoch) view.isGenerating = false;
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

  function linkKey(link) {
    return `${link.source.data.id}:${link.target.data.id}`;
  }

  function pathForEdge(link) {
    return view.linkPath({
      source: { x: link.source.y + 226, y: link.source.x },
      target: { x: link.target.y, y: link.target.x }
    });
  }

  function updateSelectionHighlight() {
    const selected = view.visibleNodeById.get(view.selectedNodeId);
    const nextPathNodeIds = new Set();
    const nextPathLinkKeys = new Set();
    selected?.ancestors().forEach(node => {
      nextPathNodeIds.add(node.data.id);
      if (node.parent) nextPathLinkKeys.add(`${node.parent.data.id}:${node.data.id}`);
    });

    const changedNodeIds = new Set([...view.pathNodeIds, ...nextPathNodeIds]);
    changedNodeIds.forEach(id => {
      const element = view.nodeElements.get(id);
      if (!element) return;
      element.classList.toggle('is-selected', id === view.selectedNodeId);
      element.classList.toggle('is-on-path', nextPathNodeIds.has(id) && id !== view.selectedNodeId);
    });

    const changedLinkKeys = new Set([...view.pathLinkKeys, ...nextPathLinkKeys]);
    changedLinkKeys.forEach(key => {
      const element = view.linkElements.get(key);
      if (element) element.classList.toggle('is-on-path', nextPathLinkKeys.has(key));
    });
    view.pathNodeIds = nextPathNodeIds;
    view.pathLinkKeys = nextPathLinkKeys;
  }

  function selectNode(nodeId) {
    if (view.selectedNodeId === nodeId) return;
    view.selectedNodeId = nodeId;
    const answer = document.getElementById('mindMapAnswer');
    answer.hidden = true;
    answer.textContent = '';
    updateSelectedDetails();
    updateSelectionHighlight();
    scheduleSave();
  }

  function toggleNode(node) {
    if (node.data.isGenerating) return;
    if (node.data.children?.length) {
      if (view.collapsedNodeIds.has(node.data.id)) view.collapsedNodeIds.delete(node.data.id);
      else view.collapsedNodeIds.add(node.data.id);
      renderGraph();
      scheduleSave();
    } else {
      void expandNode(node.data.id);
    }
  }

  function setNodeGeneratingState(nodeId, isGenerating) {
    const node = nodeIndex().get(nodeId);
    if (node) node.isGenerating = isGenerating;
    const element = view.nodeElements.get(nodeId);
    if (!element || !node) return;
    element.classList.toggle('is-generating', isGenerating);
    const label = element.querySelector('.mindmap-node-toggle-label');
    if (label) {
      label.textContent = isGenerating
        ? '…'
        : (node.children?.length ? (view.collapsedNodeIds.has(nodeId) ? '+' : '−') : '+');
    }
  }

  function cancelExpandAll() {
    if (!view.expandAllFrame) return;
    cancelAnimationFrame(view.expandAllFrame);
    view.expandAllFrame = 0;
  }

  function expandAllProgressively() {
    cancelExpandAll();
    const revealNextBatch = () => {
      view.expandAllFrame = 0;
      const expandable = view.visibleNodes.filter(node =>
        view.collapsedNodeIds.has(node.data.id) && node.data.children?.length
      );
      if (!expandable.length) {
        scheduleSave();
        return;
      }

      const batch = [];
      let revealedNodeCount = 0;
      for (const node of expandable) {
        const childCount = node.data.children.length;
        if (batch.length && revealedNodeCount + childCount > MAX_ANIMATED_MOVED_NODES) continue;
        batch.push(node.data.id);
        revealedNodeCount += childCount;
      }
      batch.forEach(nodeId => view.collapsedNodeIds.delete(nodeId));
      renderGraph();
      view.expandAllFrame = requestAnimationFrame(revealNextBatch);
    };
    view.expandAllFrame = requestAnimationFrame(revealNextBatch);
  }

  function renderGraph({ fit = false } = {}) {
    if (!view.map?.tree || !view.d3 || !view.world) return;
    const d3 = view.d3;
    const root = visibleTree();
    if (!root) return;
    view.linkPath ||= d3.linkHorizontal().x(point => point.x).y(point => point.y);
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
    view.visibleNodeById = new Map(nodes.map(node => [node.data.id, node]));
    const visibleNodeSet = new Set(nodes);
    const links = root.links().filter(link => visibleNodeSet.has(link.target));
    const pathIds = new Set();
    const pathLinkKeys = new Set();
    const selected = nodes.find(node => node.data.id === view.selectedNodeId);
    selected?.ancestors().forEach(node => {
      pathIds.add(node.data.id);
      if (node.parent) pathLinkKeys.add(`${node.parent.data.id}:${node.data.id}`);
    });

    const linkSelection = view.linksLayer.selectAll('path.mindmap-link')
      .data(links, linkKey);
    const exitingLinks = linkSelection.exit();
    const enteringLinks = linkSelection.enter().append('path')
      .attr('class', 'mindmap-link')
      .attr('d', link => pathForEdge({ source: link.source, target: link.source }));
    const mergedLinks = enteringLinks.merge(linkSelection);

    const nodeSelection = view.nodesLayer.selectAll('g.mindmap-node')
      .data(nodes, node => node.data.id);
    const exitingNodes = nodeSelection.exit();
    const enter = nodeSelection.enter().append('g')
      .attr('class', 'mindmap-node')
      .attr('transform', node => `translate(${node.y},${node.x})`)
      .style('opacity', 0);
    const largeGraphChange = nodes.length > MAX_FULL_GRAPH_ANIMATION_NODES
      && enter.size() + exitingNodes.size() > MAX_ANIMATED_BATCH_SIZE;

    mergedLinks.classed('is-on-path', link => pathLinkKeys.has(linkKey(link)));
    if (largeGraphChange) {
      exitingLinks.remove();
      mergedLinks.attr('d', pathForEdge).style('opacity', 1);
    } else {
      if (exitingLinks.size() <= MAX_ANIMATED_BATCH_SIZE) {
        exitingLinks.transition().duration(140).style('opacity', 0).remove();
      } else {
        exitingLinks.remove();
      }
      if (nodes.length <= MAX_FULL_GRAPH_ANIMATION_NODES) {
        mergedLinks.transition().duration(220).attr('d', pathForEdge);
      } else {
        const changedLinks = linkSelection.filter(function(link) {
          return this.getAttribute('d') !== pathForEdge(link);
        });
        if (changedLinks.size() <= MAX_ANIMATED_MOVED_NODES) {
          changedLinks.transition().duration(180).attr('d', pathForEdge);
        } else {
          changedLinks.attr('d', pathForEdge);
        }
        enteringLinks.transition().duration(180).attr('d', pathForEdge);
      }
    }
    const linkElements = new Map();
    mergedLinks.each(function(link) {
      linkElements.set(linkKey(link), this);
    });
    view.linkElements = linkElements;

    enter.append('rect').attr('class', 'mindmap-node-card')
      .attr('x', 0).attr('y', -42).attr('width', 226).attr('height', 84).attr('rx', 12);
    enter.append('text').attr('class', 'mindmap-node-title');
    enter.append('text').attr('class', 'mindmap-node-summary');
    enter.append('circle').attr('class', 'mindmap-node-toggle').attr('r', 9).attr('cx', 210).attr('cy', 0);
    enter.append('text').attr('class', 'mindmap-node-toggle-label').attr('x', 210).attr('y', 4);
    enter.append('title');
    enter.attr('role', 'button').attr('tabindex', 0);
    enter.on('click', (event, node) => {
      event.stopPropagation();
      selectNode(node.data.id);
    }).on('keydown', (event, node) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectNode(node.data.id);
    });
    enter.select('circle.mindmap-node-toggle').on('click', (event, node) => {
      event.stopPropagation();
      toggleNode(node);
    });
    enter.select('text.mindmap-node-toggle-label').on('click', (event, node) => {
      event.stopPropagation();
      toggleNode(node);
    });
    const merged = enter.merge(nodeSelection);
    const nodeElements = new Map();
    merged.each(function(node) {
      nodeElements.set(node.data.id, this);
      const classValue = nodeClass(node, pathIds);
      if (this.getAttribute('class') !== classValue) this.setAttribute('class', classValue);
      const accessibleLabel = `${node.data.title}. ${node.data.summary}`;
      if (this.getAttribute('aria-label') !== accessibleLabel) this.setAttribute('aria-label', accessibleLabel);
      const expandedValue = String(Boolean(node.data.children?.length) && !view.collapsedNodeIds.has(node.data.id));
      if (this.getAttribute('aria-expanded') !== expandedValue) this.setAttribute('aria-expanded', expandedValue);
      const tooltip = this.querySelector('title');
      const tooltipValue = `${node.data.title}\n${node.data.summary}`;
      if (tooltip.dataset.renderedText !== tooltipValue) {
        tooltip.textContent = tooltipValue;
        tooltip.dataset.renderedText = tooltipValue;
      }
      const title = this.querySelector('text.mindmap-node-title');
      const titleValue = String(node.data.title || '');
      if (title.dataset.renderedTitle !== titleValue) {
        const lines = wrapTitle(titleValue);
        title.replaceChildren();
        lines.forEach((line, index) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', '14');
          tspan.setAttribute('y', lines.length > 1 ? String(-12 + index * 16) : '-3');
          tspan.textContent = line;
          title.appendChild(tspan);
        });
        title.dataset.renderedTitle = titleValue;
      }
      const summary = this.querySelector('text.mindmap-node-summary');
      const summaryValue = String(node.data.summary || '').slice(0, 55);
      if (summary.dataset.renderedSummary !== summaryValue) {
        summary.setAttribute('x', '14');
        summary.setAttribute('y', '18');
        summary.textContent = summaryValue;
        summary.dataset.renderedSummary = summaryValue;
      }
      const toggleLabel = this.querySelector('text.mindmap-node-toggle-label');
      const toggleValue = node.data.isGenerating
        ? '…'
        : (node.data.children?.length ? (view.collapsedNodeIds.has(node.data.id) ? '+' : '−') : '+');
      if (toggleLabel.textContent !== toggleValue) toggleLabel.textContent = toggleValue;
    });
    view.nodeElements = nodeElements;
    view.pathNodeIds = pathIds;
    view.pathLinkKeys = pathLinkKeys;
    const nodeTransform = node => `translate(${node.y},${node.x})`;
    if (largeGraphChange) {
      exitingNodes.remove();
      merged.attr('transform', nodeTransform).style('opacity', 1);
    } else if (nodes.length <= MAX_FULL_GRAPH_ANIMATION_NODES) {
      exitingNodes.transition().duration(140).style('opacity', 0).remove();
      merged.transition().duration(220).attr('transform', nodeTransform).style('opacity', 1);
    } else {
      if (exitingNodes.size() <= MAX_ANIMATED_BATCH_SIZE) {
        exitingNodes.transition().duration(140).style('opacity', 0).remove();
      } else {
        exitingNodes.remove();
      }
      const movedNodes = nodeSelection.filter(function(node) {
        return this.getAttribute('transform') !== nodeTransform(node);
      });
      if (movedNodes.size() <= MAX_ANIMATED_MOVED_NODES) {
        movedNodes.transition().duration(180).attr('transform', nodeTransform);
      } else {
        movedNodes.attr('transform', nodeTransform);
      }
      if (enter.size() <= MAX_ANIMATED_BATCH_SIZE) {
        enter.transition().duration(180).attr('transform', nodeTransform).style('opacity', 1);
      } else {
        enter.attr('transform', nodeTransform).style('opacity', 1);
      }
    }
    bindNodeDrag(merged);
    if (fit) fitToScreen();
  }

  function createSpatialIndex(nodes = []) {
    const cellHeight = 100;
    const cellWidth = 242;
    const cells = new Map();
    const cellKey = (x, y) => `${Math.floor(y / cellWidth)}:${Math.floor(x / cellHeight)}`;
    const add = node => {
      const key = cellKey(node.x, node.y);
      if (!cells.has(key)) cells.set(key, new Set());
      cells.get(key).add(node);
    };
    const remove = node => {
      const key = cellKey(node.x, node.y);
      const bucket = cells.get(key);
      bucket?.delete(node);
      if (bucket?.size === 0) cells.delete(key);
    };
    const nearby = (x, y) => {
      const column = Math.floor(y / cellWidth);
      const row = Math.floor(x / cellHeight);
      const result = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const bucket = cells.get(`${column + dy}:${row + dx}`);
          if (bucket) result.push(...bucket);
        }
      }
      return result;
    };
    nodes.forEach(add);
    return { add, remove, nearby };
  }

  function preventNodeOverlaps(nodes) {
    const spatialIndex = createSpatialIndex();
    for (const node of nodes) {
      for (let pass = 0; pass < 8; pass++) {
        const other = spatialIndex.nearby(node.x, node.y)
          .find(candidate => Math.abs(node.y - candidate.y) < 242 && Math.abs(node.x - candidate.x) < 100);
        if (!other) break;
        const nodeIsPinned = Boolean(view.positions[node.data.id]);
        const otherIsPinned = Boolean(view.positions[other.data.id]);
        const movable = nodeIsPinned && !otherIsPinned ? other : node;
        const fixed = movable === node ? other : node;
        if (movable !== node) spatialIndex.remove(movable);
        movable.x = movable.x >= fixed.x ? fixed.x + 102 : fixed.x - 102;
        if (movable !== node) spatialIndex.add(movable);
      }
      spatialIndex.add(node);
    }
  }

  function bindNodeDrag(selection) {
    const d3 = view.d3;
    if (!view.dragBehavior) {
      view.dragBehavior = d3.drag()
        .on('start', function(event, node) {
          d3.select(this).raise().classed('is-dragging', true);
          view.dragIndex = createSpatialIndex(view.visibleNodes.filter(item => item !== node));
        })
        .on('drag', function(event, node) {
          view.pendingDrag = { event, node, element: this };
          if (!view.dragFrame) view.dragFrame = requestAnimationFrame(flushDrag);
        })
        .on('end', function() {
          if (view.dragFrame) {
            cancelAnimationFrame(view.dragFrame);
            view.dragFrame = 0;
          }
          flushDrag();
          view.dragIndex = null;
          d3.select(this).classed('is-dragging', false);
          scheduleSave();
        });
    }
    selection.call(view.dragBehavior);
  }

  function flushDrag() {
    const pending = view.pendingDrag;
    view.pendingDrag = null;
    if (!pending) return;
    const { event, node, element } = pending;
    let nextX = event.y;
    const nextY = event.x;
    for (let pass = 0; pass < 12; pass++) {
      const other = view.dragIndex?.nearby(nextX, nextY)
        .find(candidate => Math.abs(nextY - candidate.y) < 242 && Math.abs(nextX - candidate.x) < 100);
      if (!other) break;
      nextX = nextX >= other.x ? other.x + 100 : other.x - 100;
    }
    node.y = nextY;
    node.x = nextX;
    view.positions[node.data.id] = { x: node.x, y: node.y };
    view.d3.select(element).attr('transform', `translate(${node.y},${node.x})`);
    const related = [];
    if (node.parent) related.push(`${node.parent.data.id}:${node.data.id}`);
    for (const child of node.children || []) related.push(`${node.data.id}:${child.data.id}`);
    for (const key of related) {
      const link = view.linkElements.get(key);
      if (link) view.d3.select(link).attr('d', pathForEdge);
    }
  }

  function initializeGraph({ fit = false } = {}) {
    if (!view.map?.tree || view.map.tree.children == null) return;
    if (!view.d3) {
      view.pendingFit ||= fit;
      if (!view.d3Promise) {
        view.d3Promise = loadD3().then(d3 => {
          view.d3 = d3;
          const shouldFit = view.pendingFit;
          view.pendingFit = false;
          if (view.map?.tree) initializeGraph({ fit: shouldFit });
        }).catch(error => {
          view.d3Promise = null;
          showLoading(false);
          const empty = document.getElementById('mindMapEmpty');
          if (empty) {
            empty.textContent = 'The map viewer could not load. Check your connection and try again.';
            empty.hidden = false;
          }
          console.error('[NeoBook Mind Map] Could not load D3:', error);
        });
      }
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
        })
        .on('end', () => {
          scheduleSave();
        });
      view.svg.call(view.zoom).on('dblclick.zoom', null);
      view.resizeObserver = new ResizeObserver(() => {
        if (view.resizeFrame) return;
        view.resizeFrame = requestAnimationFrame(() => {
          view.resizeFrame = 0;
          const resized = canvasWrap.getBoundingClientRect();
          if (Math.max(320, resized.width) !== view.width || Math.max(360, resized.height) !== view.height) {
            initializeGraph();
          }
        });
      });
      view.resizeObserver.observe(canvasWrap);
    }
    renderGraph();
    if (!view.hasRestoredViewport) {
      const initial = view.viewport;
      view.svg.call(view.zoom.transform, d3.zoomIdentity.translate(initial.x || 0, initial.y || 0).scale(initial.k || 1));
      view.hasRestoredViewport = true;
      if (fit || (initial.x === 0 && initial.y === 0 && initial.k === 1)) fitToScreen();
    } else if (fit) {
      fitToScreen();
    }
    showLoading(false);
    document.body.classList.add('mindmap-open');
  }

  function fitToScreen() {
    if (!view.d3 || !view.svg || !view.zoom || !view.map) return;
    const nodes = view.visibleNodes;
    if (!nodes.length) return;
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
    const operationEpoch = view.operationEpoch;
    const controller = new AbortController();
    view.aiController = controller;
    view.generatingNodeId = nodeId;
    setNodeGeneratingState(nodeId, true);
    updateSelectedDetails();
    let expanded = false;
    try {
      const response = await apiRequest(`/api/neobook/mindmaps/${encodeURIComponent(view.map.id)}/nodes/${encodeURIComponent(nodeId)}/expand`, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({})
      });
      if (identityEpoch !== view.identityEpoch || operationEpoch !== view.operationEpoch) return;
      node.children = [...(node.children || []), ...(response.children || [])];
      view.nodeById = indexNodes(view.map.tree);
      node.hasBeenExpanded = true;
      view.collapsedNodeIds.delete(nodeId);
      view.map.nodeCount = response.nodeCount;
      const summary = document.getElementById('mindMapSourceSummary');
      if (summary) summary.textContent = `${(view.map.sourceIds || []).length} source${view.map.sourceIds?.length === 1 ? '' : 's'} · ${view.map.nodeCount} topics`;
      expanded = true;
      showToast('Source-supported subtopics added.', 'success');
    } catch (error) {
      if (identityEpoch !== view.identityEpoch || operationEpoch !== view.operationEpoch) return;
      showToast(error.message || 'Could not generate subtopics for this topic.', 'error');
    } finally {
      if (view.aiController === controller) view.aiController = null;
      if (identityEpoch === view.identityEpoch && operationEpoch === view.operationEpoch) {
        view.generatingNodeId = null;
        setNodeGeneratingState(nodeId, false);
        view.isGenerating = false;
        if (expanded) renderGraph();
        updateSelectedDetails();
      }
    }
  }

  async function explainSelectedNode() {
    const nodeId = view.selectedNodeId;
    if (!view.map?.id || !nodeId || view.isGenerating) return;
    view.isGenerating = true;
    const identityEpoch = view.identityEpoch;
    const operationEpoch = view.operationEpoch;
    const controller = new AbortController();
    view.aiController = controller;
    updateSelectedDetails();
    const button = document.getElementById('btnMindMapExplain');
    const answer = document.getElementById('mindMapAnswer');
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Explaining…</span>';
    answer.hidden = false;
    answer.textContent = 'Finding the most relevant source passages…';
    try {
      const response = await apiRequest(`/api/neobook/mindmaps/${encodeURIComponent(view.map.id)}/nodes/${encodeURIComponent(nodeId)}/explain`, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({})
      });
      if (identityEpoch !== view.identityEpoch || operationEpoch !== view.operationEpoch) return;
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
      if (identityEpoch !== view.identityEpoch || operationEpoch !== view.operationEpoch) return;
      answer.textContent = error.message || 'Could not explain this topic.';
      showToast(error.message || 'Could not explain this topic.', 'error');
    } finally {
      if (view.aiController === controller) view.aiController = null;
      if (identityEpoch === view.identityEpoch && operationEpoch === view.operationEpoch) {
        button.innerHTML = '<i class="fas fa-lightbulb"></i><span>Explain with AI</span>';
        view.isGenerating = false;
        updateSelectedDetails();
      }
    }
  }

  function setCollapsed(allCollapsed) {
    if (!allCollapsed && view.map?.nodeCount > MAX_FULL_GRAPH_ANIMATION_NODES) {
      expandAllProgressively();
      return;
    }
    cancelExpandAll();
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
    cancelExpandAll();
    clearTimeout(view.saveTimer);
    void saveState();
    cancelAiRequest();
    view.mapController?.abort();
  }

  function clearForIdentityChange() {
    clearTimeout(view.saveTimer);
    cancelExpandAll();
    view.identityEpoch++;
    view.savePending = false;
    cancelAiRequest();
    view.savedMapsController?.abort();
    view.savedMapsKey = null;
    view.savedMapsPromise = null;
    view.mapController?.abort();
    view.resizeObserver?.disconnect();
    view.resizeObserver = null;
    if (view.resizeFrame) cancelAnimationFrame(view.resizeFrame);
    if (view.dragFrame) cancelAnimationFrame(view.dragFrame);
    view.svg?.selectAll('*').interrupt();
    view.resizeFrame = 0;
    view.dragFrame = 0;
    view.pendingDrag = null;
    view.dragIndex = null;
    view.map = null;
    view.nodeById.clear();
    view.visibleNodeById.clear();
    view.visibleNodes = [];
    view.nodeElements.clear();
    view.linkElements.clear();
    view.pathNodeIds.clear();
    view.pathLinkKeys.clear();
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
    view.dragBehavior = null;
    view.linkPath = null;
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
