const statusEl = document.getElementById('status');
const contentEl = document.getElementById('content');
const statsEl = document.getElementById('global-stats');
const detailEl = document.getElementById('detail-panel');
const insightsEl = document.getElementById('insights');
const tooltipEl = document.getElementById('tooltip');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const resetBtn = document.getElementById('reset-btn');

let graphData;
let nodeById = new Map();
let selectedNode = null;
let hoveredNode = null;
let svg;
let g;
let linkSelection;
let nodeSelection;
let simulation;
let zoom;

fetch('./graph-data.json')
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then((data) => {
    if (!data?.nodes?.length) throw new Error('Dataset has no nodes.');
    graphData = data;
    nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
    initUI();
    drawGraph();
  })
  .catch((err) => {
    statusEl.textContent = `Error: ${err.message}. Could not load graph-data.json`;
  });

function initUI() {
  statusEl.hidden = true;
  contentEl.hidden = false;
  insightsEl.hidden = false;

  statsEl.innerHTML = `
    <span class="stat-chip">Words: ${graphData.nodes.length}</span>
    <span class="stat-chip">Connections: ${graphData.links.length}</span>
  `;

  searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return;
    const found = nodeById.get(query);
    if (!found) {
      statusEl.hidden = false;
      statusEl.textContent = `No word found for "${query}".`;
      return;
    }
    statusEl.hidden = true;
    selectNode(found);
    focusNode(found);
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchBtn.click();
  });

  resetBtn.addEventListener('click', () => {
    selectedNode = null;
    hoveredNode = null;
    updateStyles();
    detailEl.innerHTML = `<h2>Word details</h2><p class="muted">Click a node to inspect its definition and neighbors.</p>`;
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1));
  });

  renderInsights();
}

function drawGraph() {
  const graphEl = document.getElementById('graph');
  const width = graphEl.clientWidth;
  const height = graphEl.clientHeight;

  const links = graphData.links.map((d) => ({ ...d }));
  const nodes = graphData.nodes.map((d) => ({ ...d }));

  svg = d3.select('#graph').attr('viewBox', [0, 0, width, height]);
  g = svg.append('g');

  zoom = d3.zoom().scaleExtent([0.2, 3]).on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);

  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(52).strength(0.18))
    .force('charge', d3.forceManyBody().strength(-85))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius((d) => 3 + Math.sqrt(Math.max(1, d.inDegree))));

  linkSelection = g.append('g')
    .attr('stroke', '#9ab89d')
    .attr('stroke-opacity', 0.25)
    .selectAll('line')
    .data(links)
    .join('line');

  nodeSelection = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', (d) => 3 + Math.log2(d.inDegree + d.outDegree + 1))
    .attr('fill', '#2a7f4a')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 0.7)
    .on('mouseenter', (event, d) => {
      hoveredNode = d;
      tooltipEl.hidden = false;
      tooltipEl.textContent = `${d.id} (in:${d.inDegree}, out:${d.outDegree})`;
      tooltipEl.style.left = `${event.offsetX}px`;
      tooltipEl.style.top = `${event.offsetY}px`;
      updateStyles();
    })
    .on('mousemove', (event) => {
      tooltipEl.style.left = `${event.offsetX}px`;
      tooltipEl.style.top = `${event.offsetY}px`;
    })
    .on('mouseleave', () => {
      hoveredNode = null;
      tooltipEl.hidden = true;
      updateStyles();
    })
    .on('click', (_event, d) => {
      selectNode(d);
      focusNode(d);
    })
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

  simulation.on('tick', () => {
    linkSelection
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    nodeSelection
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y);
  });
}

function selectNode(node) {
  selectedNode = nodeById.get(node.id) ?? node;
  renderDetails(selectedNode);
  updateStyles();
}

function focusNode(node) {
  const graphEl = document.getElementById('graph');
  const width = graphEl.clientWidth;
  const height = graphEl.clientHeight;
  const scale = 1.8;
  svg.transition().duration(500).call(
    zoom.transform,
    d3.zoomIdentity.translate(width / 2 - node.x * scale, height / 2 - node.y * scale).scale(scale)
  );
}

function renderDetails(node) {
  const incoming = node.incomingNeighbors?.slice(0, 20) ?? [];
  const outgoing = node.outgoingNeighbors?.slice(0, 20) ?? [];
  detailEl.innerHTML = `
    <h2>${node.id}</h2>
    <p>${node.definition}</p>
    <p><strong>Incoming:</strong> ${node.inDegree}</p>
    <p><strong>Outgoing:</strong> ${node.outDegree}</p>
    <p><strong>Words that define it:</strong> ${incoming.length ? incoming.join(', ') : 'None'}</p>
    <p><strong>Words it helps define:</strong> ${outgoing.length ? outgoing.join(', ') : 'None'}</p>
  `;
}

function updateStyles() {
  const active = selectedNode ?? hoveredNode;
  if (!active) {
    nodeSelection.attr('fill', '#2a7f4a').attr('opacity', 0.9);
    linkSelection.attr('stroke-opacity', 0.25).attr('stroke', '#9ab89d');
    return;
  }

  const neighbors = new Set([active.id, ...(active.incomingNeighbors || []), ...(active.outgoingNeighbors || [])]);

  nodeSelection
    .attr('fill', (d) => (d.id === active.id ? '#14532d' : neighbors.has(d.id) ? '#2a7f4a' : '#a6b9a9'))
    .attr('opacity', (d) => (neighbors.has(d.id) ? 1 : 0.35));

  linkSelection
    .attr('stroke', (d) => (d.source.id === active.id || d.target.id === active.id ? '#14532d' : '#9ab89d'))
    .attr('stroke-opacity', (d) => (d.source.id === active.id || d.target.id === active.id ? 0.8 : 0.08));
}

function renderInsights() {
  const byIn = [...graphData.nodes].sort((a, b) => b.inDegree - a.inDegree).slice(0, 8);
  const byOut = [...graphData.nodes].sort((a, b) => b.outDegree - a.outDegree).slice(0, 8);
  const byRatio = [...graphData.nodes]
    .filter((n) => n.inDegree > 0)
    .map((n) => ({ ...n, ratio: (n.outDegree / n.inDegree) }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 8);

  const block = (title, rows, key) => {
    const max = Math.max(1, ...rows.map((r) => r[key]));
    return `
      <article>
        <h3>${title}</h3>
        ${rows.map((row) => `
          <div class="bar-row">
            <span>${row.id}</span>
            <span class="bar"><span style="width:${(row[key] / max) * 100}%"></span></span>
            <strong>${row[key].toFixed ? row[key].toFixed(1) : row[key]}</strong>
          </div>
        `).join('')}
      </article>`;
  };

  insightsEl.innerHTML = `
    <h2>Insights</h2>
    <div class="insight-grid">
      ${block('Top words by incoming degree', byIn, 'inDegree')}
      ${block('Top words by outgoing degree', byOut, 'outDegree')}
      ${block('Out/In degree ratio highlights', byRatio, 'ratio')}
    </div>
  `;
}

function dragstarted(event) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  event.subject.fx = event.subject.x;
  event.subject.fy = event.subject.y;
}

function dragged(event) {
  event.subject.fx = event.x;
  event.subject.fy = event.y;
}

function dragended(event) {
  if (!event.active) simulation.alphaTarget(0);
  event.subject.fx = null;
  event.subject.fy = null;
}
