/**
 * @file GraphCanvas.js
 * SVG Graph Visualization Component
 * 
 * Renders Graph vertices, edges, directed arrows, weights, and algorithm step highlights.
 * Supports zoom & pan, interactive vertex dragging with live incident edge recalculation,
 * and distinct visual node selection roles (start, target, active, visited, path).
 */

export const KIND_COLORS = {
  sanh:     { fill: "#f59e0b", stroke: "#b45309", text: "#1c1204" },
  hl:       { fill: "#5ecb95", stroke: "#15803d", text: "#072412" },
  phong:    { fill: "#70a9db", stroke: "#1d4ed8", text: "#091d45" },
  cauthang: { fill: "#b18df0", stroke: "#6d28d9", text: "#1f0a42" }
};

/**
 * Calculates point on rectangle border for precise marker arrow anchoring.
 */
export function getNodeBorderPoint(node, targetX, targetY, isBuilding = false, padding = 3) {
  const nw = isBuilding ? 104 : 64;
  const nh = isBuilding ? 38 : 34;
  const halfW = nw / 2 + padding;
  const halfH = nh / 2 + padding;

  const dx = targetX - node.x;
  const dy = targetY - node.y;
  if (dx === 0 && dy === 0) return { x: node.x, y: node.y };

  const angle = Math.atan2(dy, dx);
  const cosT = Math.cos(angle);
  const sinT = Math.sin(angle);

  const tx = halfW / Math.abs(cosT || 1e-6);
  const ty = halfH / Math.abs(sinT || 1e-6);
  const tMin = Math.min(tx, ty);

  return {
    x: node.x + tMin * cosT,
    y: node.y + tMin * sinT
  };
}

export class GraphCanvas {
  /**
   * @param {Object} options
   * @param {SVGSVGElement} options.svgElement - Target SVG container
   * @param {SVGGElement} options.zoomLayer - Zoom/Pan transform container
   * @param {Function} [options.onNodeClick] - Callback when a node is clicked
   */
  constructor({ svgElement, zoomLayer, onNodeClick }) {
    this.svg = svgElement;
    this.zoomLayer = zoomLayer;
    this.onNodeClick = onNodeClick || (() => {});

    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.startX = 0;
    this.startY = 0;

    // Node dragging state
    this.isDraggingNode = false;
    this.draggedNodeId = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.nodeInitialX = 0;
    this.nodeInitialY = 0;
    this.hasMovedDistance = false;

    // Selected roles
    this.selectedStartNodeId = null;
    this.selectedTargetNodeId = null;

    this.graph = null;
    this.nodesMap = new Map();
    this.edgesList = [];

    this._setupInteractions();
  }

  _setupInteractions() {
    if (!this.svg) return;

    // Canvas background panning
    this.svg.addEventListener('mousedown', (e) => {
      if (e.target.closest('.nodebox') || e.target.closest('.nodelabel') || e.target.closest('.node-sub') || e.target.closest('.zoom-controls') || this.isDraggingNode) {
        return;
      }
      this.isPanning = true;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      // 1. Handle SVG Canvas Panning
      if (this.isPanning) {
        this.panX = e.clientX - this.startX;
        this.panY = e.clientY - this.startY;
        this._updateTransform();
        return;
      }

      // 2. Handle Node Dragging
      if (this.isDraggingNode && this.draggedNodeId) {
        const dx = (e.clientX - this.dragStartX) / this.scale;
        const dy = (e.clientY - this.dragStartY) / this.scale;

        if (!this.hasMovedDistance && Math.hypot(dx, dy) > 4) {
          this.hasMovedDistance = true;
          if (typeof document !== 'undefined' && document.body) {
            document.body.style.cursor = 'grabbing';
          }
        }

        if (this.hasMovedDistance) {
          const node = this.nodesMap.get(this.draggedNodeId);
          if (node) {
            // Clamp within canvas boundaries
            const newX = Math.max(35, Math.min(905, this.nodeInitialX + dx));
            const newY = Math.max(25, Math.min(425, this.nodeInitialY + dy));
            node.x = newX;
            node.y = newY;

            // Sync with graph model if vertex object exists
            if (this.graph && typeof this.graph.getNode === 'function') {
              const graphNode = this.graph.getNode(this.draggedNodeId);
              if (graphNode) {
                graphNode.x = newX;
                graphNode.y = newY;
              }
            }

            this._updateNodePosition(node);
            this._updateIncidentEdges(node.id);
          }
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
      }

      if (this.isDraggingNode) {
        const nodeId = this.draggedNodeId;
        const wasDragged = this.hasMovedDistance;

        this.isDraggingNode = false;
        this.draggedNodeId = null;
        this.hasMovedDistance = false;

        if (typeof document !== 'undefined' && document.body) {
          document.body.style.cursor = '';
        }

        // Only trigger click callback if mouse was not dragged
        if (!wasDragged && nodeId) {
          this.onNodeClick(nodeId);
        }
      }
    });

    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      this.zoom(delta);
    }, { passive: false });
  }

  _updateTransform() {
    if (this.zoomLayer) {
      this.zoomLayer.setAttribute(
        'transform',
        `translate(${this.panX.toFixed(1)}, ${this.panY.toFixed(1)}) scale(${this.scale.toFixed(2)})`
      );
    }
  }

  zoom(delta) {
    this.scale = Math.min(3.0, Math.max(0.4, this.scale + delta));
    this._updateTransform();
  }

  resetZoom() {
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this._updateTransform();
  }

  /**
   * Sets node visual roles (start / target)
   * @param {Object} roles
   * @param {string|null} [roles.startNodeId]
   * @param {string|null} [roles.targetNodeId]
   */
  setSelectionRoles({ startNodeId = null, targetNodeId = null }) {
    this.selectedStartNodeId = startNodeId;
    this.selectedTargetNodeId = targetNodeId;
    this._reapplySelectionRoles();
  }

  _reapplySelectionRoles() {
    if (!this.zoomLayer) return;

    // Clear previous role classes
    this.zoomLayer.querySelectorAll('.node-start, .node-target').forEach(el => {
      el.classList.remove('node-start', 'node-target');
    });

    if (this.selectedStartNodeId) {
      const startRect = this.zoomLayer.querySelector(`#node_${this.selectedStartNodeId}`);
      if (startRect) startRect.classList.add('node-start');
    }

    if (this.selectedTargetNodeId) {
      const targetRect = this.zoomLayer.querySelector(`#node_${this.selectedTargetNodeId}`);
      if (targetRect) targetRect.classList.add('node-target');
    }
  }

  /**
   * Loads and renders a Graph instance.
   * Auto-assigns circular coordinates if vertices lack x/y coordinates.
   * 
   * @param {import('../../core/models/Graph.js').Graph} graph
   * @param {Object} [presetRaw] - Optional raw preset for layout metadata
   */
  setGraph(graph, presetRaw = null) {
    this.graph = graph;
    this.nodesMap.clear();
    this.edgesList = [];

    if (!graph) {
      if (this.zoomLayer) this.zoomLayer.innerHTML = '';
      return;
    }

    const rawNodes = graph.getNodes();
    const isBuilding = presetRaw ? !!presetRaw.isBuilding : false;

    // Check if coordinates exist
    const hasCoordinates = rawNodes.every(n => typeof n.x === 'number' && typeof n.y === 'number');

    // Assign layout coordinates
    rawNodes.forEach((node, i) => {
      let x = node.x;
      let y = node.y;

      if (!hasCoordinates) {
        // Arrange vertices in a centered circle
        const n = rawNodes.length;
        const angle = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2;
        const radius = Math.min(180, Math.max(100, 30 * n));
        x = 470 + radius * Math.cos(angle);
        y = 225 + radius * Math.sin(angle);
      }

      this.nodesMap.set(node.id, {
        ...node,
        x,
        y,
        isBuilding,
      });
    });

    // Collect edges
    const rawEdges = graph.getEdges();
    this.edgesList = rawEdges.map(e => ({
      from: e.from,
      to: e.to,
      weight: e.weight,
      directed: graph.isDirected,
    }));

    this.render();
  }

  render() {
    if (!this.zoomLayer || !this.graph) return;
    this.zoomLayer.innerHTML = '';

    const nodes = Array.from(this.nodesMap.values());
    const isBuilding = nodes.some(n => n.isBuilding);

    // Render floor tags if building graph
    if (isBuilding) {
      const t2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t2.setAttribute('class', 'floor-tag');
      t2.setAttribute('x', '40');
      t2.setAttribute('y', '95');
      t2.setAttribute('fill', '#5ecb95');
      t2.textContent = 'TẦNG 2';
      this.zoomLayer.appendChild(t2);

      const t1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t1.setAttribute('class', 'floor-tag');
      t1.setAttribute('x', '40');
      t1.setAttribute('y', '310');
      t1.setAttribute('fill', '#70a9db');
      t1.textContent = 'TẦNG 1';
      this.zoomLayer.appendChild(t1);

      const div = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      div.setAttribute('class', 'floor-divider');
      div.setAttribute('x1', '60');
      div.setAttribute('y1', '165');
      div.setAttribute('x2', '880');
      div.setAttribute('y2', '165');
      this.zoomLayer.appendChild(div);
    }

    // Render Edges
    this.edgesList.forEach((e) => {
      const uNode = this.nodesMap.get(e.from);
      const vNode = this.nodesMap.get(e.to);
      if (!uNode || !vNode) return;

      const isDir = e.directed;
      const hasReverse = isDir && this.edgesList.some(other => other.from === e.to && other.to === e.from);

      let wx = (uNode.x + vNode.x) / 2;
      let wy = (uNode.y + vNode.y) / 2;

      let edgeEl;
      if (isDir) {
        if (hasReverse) {
          // Curved path for opposite bidirectional pair
          const dx = vNode.x - uNode.x, dy = vNode.y - uNode.y;
          const dist = Math.hypot(dx, dy) || 1;
          const nx = dy / dist, ny = -dx / dist;
          const offset = Math.min(36, Math.max(20, dist * 0.16));
          const cx = (uNode.x + vNode.x) / 2 + offset * nx;
          const cy = (uNode.y + vNode.y) / 2 + offset * ny;

          const startPt = getNodeBorderPoint(uNode, cx, cy, isBuilding, 2);
          const endPt = getNodeBorderPoint(vNode, cx, cy, isBuilding, 5);

          edgeEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          edgeEl.setAttribute('class', 'edge directed');
          edgeEl.setAttribute('id', `edge_${e.from}_${e.to}`);
          edgeEl.setAttribute('d', `M ${startPt.x.toFixed(1)} ${startPt.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${endPt.x.toFixed(1)} ${endPt.y.toFixed(1)}`);
          this.zoomLayer.appendChild(edgeEl);

          wx = 0.25 * startPt.x + 0.5 * cx + 0.25 * endPt.x;
          wy = 0.25 * startPt.y + 0.5 * cy + 0.25 * endPt.y;
        } else {
          // Straight directed line
          const startPt = getNodeBorderPoint(uNode, vNode.x, vNode.y, isBuilding, 2);
          const endPt = getNodeBorderPoint(vNode, uNode.x, uNode.y, isBuilding, 5);

          edgeEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          edgeEl.setAttribute('class', 'edge directed');
          edgeEl.setAttribute('id', `edge_${e.from}_${e.to}`);
          edgeEl.setAttribute('x1', startPt.x.toFixed(1));
          edgeEl.setAttribute('y1', startPt.y.toFixed(1));
          edgeEl.setAttribute('x2', endPt.x.toFixed(1));
          edgeEl.setAttribute('y2', endPt.y.toFixed(1));
          this.zoomLayer.appendChild(edgeEl);

          wx = (startPt.x + endPt.x) / 2;
          wy = (startPt.y + endPt.y) / 2;
        }
      } else {
        // Undirected edge
        edgeEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        edgeEl.setAttribute('class', 'edge');
        edgeEl.setAttribute('id', `edge_${e.from}_${e.to}`);
        edgeEl.setAttribute('x1', uNode.x.toFixed(1));
        edgeEl.setAttribute('y1', uNode.y.toFixed(1));
        edgeEl.setAttribute('x2', vNode.x.toFixed(1));
        edgeEl.setAttribute('y2', vNode.y.toFixed(1));
        this.zoomLayer.appendChild(edgeEl);

        const isVert = Math.abs(uNode.x - vNode.x) < 20;
        wx += isVert ? 18 : 0;
        wy += isVert ? 0 : -12;
      }

      // Weight badge
      if (typeof e.weight === 'number') {
        const gW = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gW.setAttribute('id', `badge_${e.from}_${e.to}`);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'weight-badge');
        rect.setAttribute('x', (wx - 14).toFixed(1));
        rect.setAttribute('y', (wy - 9).toFixed(1));
        rect.setAttribute('width', '28');
        rect.setAttribute('height', '18');
        gW.appendChild(rect);

        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('class', 'weight-text');
        txt.setAttribute('x', wx.toFixed(1));
        txt.setAttribute('y', wy.toFixed(1));
        txt.textContent = String(e.weight);
        gW.appendChild(txt);

        this.zoomLayer.appendChild(gW);
      }
    });

    // Render Nodes
    const nw = isBuilding ? 104 : 64;
    const nh = isBuilding ? 38 : 34;

    nodes.forEach((nd) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', `node_group_${nd.id}`);
      g.style.cursor = 'grab';

      // Start drag listener on node
      g.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.isDraggingNode = true;
        this.draggedNodeId = nd.id;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const currentData = this.nodesMap.get(nd.id);
        this.nodeInitialX = currentData.x;
        this.nodeInitialY = currentData.y;
        this.hasMovedDistance = false;
      });

      const color = KIND_COLORS[nd.kind] || KIND_COLORS.phong;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', 'nodebox');
      rect.setAttribute('id', `node_${nd.id}`);
      rect.setAttribute('x', (nd.x - nw / 2).toFixed(1));
      rect.setAttribute('y', (nd.y - nh / 2).toFixed(1));
      rect.setAttribute('width', String(nw));
      rect.setAttribute('height', String(nh));
      rect.setAttribute('fill', color.fill);
      rect.setAttribute('stroke', color.stroke);
      g.appendChild(rect);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('class', 'nodelabel');
      label.setAttribute('x', nd.x.toFixed(1));
      label.setAttribute('y', (nd.y - (isBuilding ? 3 : 0)).toFixed(1));
      label.setAttribute('fill', color.text);
      label.setAttribute('font-size', isBuilding ? '11.5px' : '13px');
      label.textContent = nd.short || nd.name || nd.id;
      g.appendChild(label);

      if (isBuilding) {
        const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sub.setAttribute('class', 'node-sub');
        sub.setAttribute('id', `node_sub_${nd.id}`);
        sub.setAttribute('x', nd.x.toFixed(1));
        sub.setAttribute('y', (nd.y + 11).toFixed(1));
        sub.setAttribute('fill', color.text);
        sub.textContent = '';
        g.appendChild(sub);
      }

      this.zoomLayer.appendChild(g);
    });

    this._reapplySelectionRoles();
  }

  _updateNodePosition(node) {
    if (!this.zoomLayer) return;

    const nw = node.isBuilding ? 104 : 64;
    const nh = node.isBuilding ? 38 : 34;

    const rect = this.zoomLayer.querySelector(`#node_${node.id}`);
    if (rect) {
      rect.setAttribute('x', (node.x - nw / 2).toFixed(1));
      rect.setAttribute('y', (node.y - nh / 2).toFixed(1));
    }

    const g = this.zoomLayer.querySelector(`#node_group_${node.id}`);
    if (g) {
      const label = g.querySelector('.nodelabel');
      if (label) {
        label.setAttribute('x', node.x.toFixed(1));
        label.setAttribute('y', (node.y - (node.isBuilding ? 3 : 0)).toFixed(1));
      }

      const sub = g.querySelector(`#node_sub_${node.id}`);
      if (sub) {
        sub.setAttribute('x', node.x.toFixed(1));
        sub.setAttribute('y', (node.y + 11).toFixed(1));
      }
    }
  }

  _updateIncidentEdges(nodeId) {
    if (!this.zoomLayer) return;

    this.edgesList.forEach(e => {
      if (e.from === nodeId || e.to === nodeId) {
        this._updateEdgeGeometry(e);
      }
    });
  }

  _updateEdgeGeometry(e) {
    const uNode = this.nodesMap.get(e.from);
    const vNode = this.nodesMap.get(e.to);
    if (!uNode || !vNode) return;

    const isBuilding = uNode.isBuilding || vNode.isBuilding;
    const isDir = e.directed;
    const hasReverse = isDir && this.edgesList.some(other => other.from === e.to && other.to === e.from);

    let wx = (uNode.x + vNode.x) / 2;
    let wy = (uNode.y + vNode.y) / 2;

    const edgeEl = this.zoomLayer.querySelector(`#edge_${e.from}_${e.to}`);
    if (!edgeEl) return;

    if (isDir) {
      if (hasReverse) {
        const dx = vNode.x - uNode.x, dy = vNode.y - uNode.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dy / dist, ny = -dx / dist;
        const offset = Math.min(36, Math.max(20, dist * 0.16));
        const cx = (uNode.x + vNode.x) / 2 + offset * nx;
        const cy = (uNode.y + vNode.y) / 2 + offset * ny;

        const startPt = getNodeBorderPoint(uNode, cx, cy, isBuilding, 2);
        const endPt = getNodeBorderPoint(vNode, cx, cy, isBuilding, 5);

        edgeEl.setAttribute('d', `M ${startPt.x.toFixed(1)} ${startPt.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${endPt.x.toFixed(1)} ${endPt.y.toFixed(1)}`);

        wx = 0.25 * startPt.x + 0.5 * cx + 0.25 * endPt.x;
        wy = 0.25 * startPt.y + 0.5 * cy + 0.25 * endPt.y;
      } else {
        const startPt = getNodeBorderPoint(uNode, vNode.x, vNode.y, isBuilding, 2);
        const endPt = getNodeBorderPoint(vNode, uNode.x, uNode.y, isBuilding, 5);

        edgeEl.setAttribute('x1', startPt.x.toFixed(1));
        edgeEl.setAttribute('y1', startPt.y.toFixed(1));
        edgeEl.setAttribute('x2', endPt.x.toFixed(1));
        edgeEl.setAttribute('y2', endPt.y.toFixed(1));

        wx = (startPt.x + endPt.x) / 2;
        wy = (startPt.y + endPt.y) / 2;
      }
    } else {
      edgeEl.setAttribute('x1', uNode.x.toFixed(1));
      edgeEl.setAttribute('y1', uNode.y.toFixed(1));
      edgeEl.setAttribute('x2', vNode.x.toFixed(1));
      edgeEl.setAttribute('y2', vNode.y.toFixed(1));

      const isVert = Math.abs(uNode.x - vNode.x) < 20;
      wx += isVert ? 18 : 0;
      wy += isVert ? 0 : -12;
    }

    // Update weight badge
    const badge = this.zoomLayer.querySelector(`#badge_${e.from}_${e.to}`);
    if (badge) {
      const rect = badge.querySelector('.weight-badge');
      const txt = badge.querySelector('.weight-text');
      if (rect) {
        rect.setAttribute('x', (wx - 14).toFixed(1));
        rect.setAttribute('y', (wy - 9).toFixed(1));
      }
      if (txt) {
        txt.setAttribute('x', wx.toFixed(1));
        txt.setAttribute('y', wy.toFixed(1));
      }
    }
  }

  /**
   * Updates visual step highlights.
   * 
   * @param {Object} presentationStep - Output of StepFormatter.formatStep()
   */
  applyStepHighlights(presentationStep) {
    if (!this.zoomLayer || !this.graph) return;

    // Reset nodes to default styling
    const nodes = Array.from(this.nodesMap.values());

    nodes.forEach(nd => {
      const rect = this.zoomLayer.querySelector(`#node_${nd.id}`);
      const color = KIND_COLORS[nd.kind] || KIND_COLORS.phong;
      if (rect) {
        rect.setAttribute('class', 'nodebox');
        rect.setAttribute('fill', color.fill);
        rect.setAttribute('stroke', color.stroke);
        rect.setAttribute('stroke-width', '2');
      }
    });

    // Reset edges to default styling
    this.edgesList.forEach(e => {
      const line = this.zoomLayer.querySelector(`#edge_${e.from}_${e.to}`);
      if (line) {
        line.setAttribute('class', e.directed ? 'edge directed' : 'edge');
      }
    });

    if (!presentationStep) {
      this._reapplySelectionRoles();
      return;
    }

    const highlights = presentationStep.highlights || {};
    const highlightedNodes = highlights.nodes || [];
    const highlightedEdges = highlights.edges || [];

    // Apply node highlights
    highlightedNodes.forEach((nodeId, idx) => {
      const rect = this.zoomLayer.querySelector(`#node_${nodeId}`);
      if (rect) {
        const action = presentationStep.action;
        if (action === 'FINISH') {
          rect.classList.add('on-path');
        } else if (action === 'SELECT_NODE') {
          rect.classList.add('settled');
        } else if (action === 'ACCEPT_EDGE') {
          // In Prim ACCEPT_EDGE, [p, u] where u (idx === 1) is the newly settled node into MST
          if (idx === 1 || highlightedNodes.length === 1) {
            rect.classList.add('settled');
          } else {
            rect.classList.add('active-u');
          }
        } else if (idx === 0) {
          rect.classList.add('active-u');
        } else {
          rect.classList.add('active-v');
        }
      }
    });

    // Apply edge highlights
    highlightedEdges.forEach(edgeKey => {
      // edgeKey can be "u->v", "u--v", or "u_v"
      const parts = edgeKey.split(/->|--|_/);
      if (parts.length >= 2) {
        const u = parts[0], v = parts[1];
        let line = this.zoomLayer.querySelector(`#edge_${u}_${v}`);
        if (!line && !this.graph.isDirected) {
          line = this.zoomLayer.querySelector(`#edge_${v}_${u}`);
        }
        if (line) {
          const action = presentationStep.action;
          let stateClass = 'checking';
          if (action === 'RELAX_EDGE' || action === 'ACCEPT_EDGE') stateClass = 'relaxed';
          else if (action === 'REJECT_EDGE') stateClass = 'rejected';
          else if (action === 'FINISH') stateClass = 'path';

          const baseCls = this.graph.isDirected ? 'edge directed ' : 'edge ';
          line.setAttribute('class', baseCls + stateClass);
        }
      }
    });

    this._reapplySelectionRoles();
  }
}
