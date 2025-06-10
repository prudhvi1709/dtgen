export class TreeRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.allExpanded = false;
        document.getElementById('toggleTree').addEventListener('click', () => this.toggleAll());
    }

    render(treeText) {
        if (!treeText) {
            this.container.innerHTML = `<div class="text-muted text-center py-5"><i class="bi bi-diagram-3 display-4"></i><p class="mt-3">No decision tree available</p></div>`;
            return;
        }
        const lines = treeText.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
            this.container.innerHTML = `<div class="text-muted text-center py-5"><i class="bi bi-exclamation-triangle display-4"></i><p class="mt-3">Unable to parse tree structure</p></div>`;
            return;
        }
        const rootNode = this.parseTree(lines);
        this.disposeAllTooltips();
        this.container.innerHTML = this.renderTreeNode(rootNode, 0);
        this.attachEventListeners();
        document.getElementById('treeLegend').classList.remove('d-none');
        document.getElementById('toggleTree').disabled = false;
    }

    parseTree(lines) {
        const rootNode = { content: lines[0].trim(), depth: 0, children: [], isLeaf: this.isLeafNode(lines[0]) };
        this.parseChildren(lines, 1, rootNode, 0);
        return rootNode;
    }

    parseChildren(lines, startIndex, parentNode, parentDepth) {
        let currentIndex = startIndex;
        while (currentIndex < lines.length) {
            const line = lines[currentIndex];
            const depth = this.getLineDepth(line);
            if (depth <= parentDepth) break;
            if (depth === parentDepth + 1) {
                const childNode = { content: line.trim(), depth, children: [], isLeaf: this.isLeafNode(line) };
                parentNode.children.push(childNode);
                currentIndex = this.parseChildren(lines, currentIndex + 1, childNode, depth);
            } else currentIndex++;
        }
        return currentIndex;
    }

    getLineDepth(line) {
        const leadingSpaces = line.match(/^(\s*)/)[1].length;
        const pipeCount = (line.match(/\|/g) || []).length;
        return pipeCount > 0 ? Math.floor(pipeCount / 2) : Math.floor(leadingSpaces / 4);
    }

    isLeafNode(content) {
        return content.includes('class:') || content.includes('value:') || (!content.includes('<=') && !content.includes('>'));
    }

    renderTreeNode(node, depth = 0) {
        if (!node) return '';
        const hasChildren = node.children && node.children.length > 0;
        const shouldBeExpandable = this.shouldNodeBeExpandable(node);
        const nodeInfo = this.analyzeNodeContent(node.content);
        let html = `<div class="tree-node ${(hasChildren && shouldBeExpandable) ? 'collapsed' : 'leaf'}" data-depth="${depth}" title="${this.generateTooltip(nodeInfo)}" data-bs-toggle="tooltip" data-bs-placement="top">
            <div class="tree-content">${this.formatNodeContent(nodeInfo, shouldBeExpandable)}</div>`;
        if (hasChildren) {
            html += `<div class="tree-children ${shouldBeExpandable ? 'd-none' : ''} ms-4 border-start border-2 ps-3">`;
            for (let i = 0; i < node.children.length; i++) {
                const branchLabel = this.getBranchLabel(nodeInfo, i, node.children.length);
                html += `<div class="tree-branch">${branchLabel ? `<div class="ms-3 my-2">${branchLabel}</div>` : ''}${this.renderTreeNode(node.children[i], depth + 1)}</div>`;
            }
            html += `</div>`;
        }
        return html + `</div>`;
    }

    shouldNodeBeExpandable(node) {
        if (!node.children || node.children.length === 0) return false;
        const allChildrenAreLeaves = node.children.every(child => 
            this.isLeafNode(child.content) || (child.children && child.children.length === 0));
        if (allChildrenAreLeaves) return false;
        if (node.children.length === 1) {
            const singleChild = node.children[0];
            if (this.isLeafNode(singleChild.content) || (singleChild.children && singleChild.children.every(grandchild => this.isLeafNode(grandchild.content)))) {
                return false;
            }
        }
        return this.getMaxDepthToLeaf(node) > 2;
    }

    getMaxDepthToLeaf(node) {
        if (!node.children || node.children.length === 0 || this.isLeafNode(node.content)) return 0;
        return 1 + Math.max(...node.children.map(child => this.getMaxDepthToLeaf(child)));
    }

    analyzeNodeContent(content) {
        const cleaned = content.replace(/^\|*---\s*/, '').replace(/^\|*\s*/, '').trim();
        if (cleaned.includes('<=') || cleaned.includes('>')) {
            const parts = cleaned.split(/\s*(<=|>)\s*/);
            if (parts.length >= 3) {
                return { type: 'decision', feature: parts[0].trim(), operator: parts[1],
                    threshold: parseFloat(parts[2]) || parts[2], original: content };
            }
        }
        if (cleaned.includes('class:') || cleaned.includes('value:') || cleaned.includes('samples:')) {
            return { type: 'leaf', content: cleaned, original: content };
        }
        return { type: 'unknown', content: cleaned, original: content };
    }

    formatNodeContent(nodeInfo, shouldBeExpandable = true) {
        if (nodeInfo.type === 'decision') {
            const operatorSymbol = nodeInfo.operator === '<=' ? '≤' : '>';
            const nodeId = `${nodeInfo.feature}_${nodeInfo.threshold}`;
            return `<div class="card border mb-2"><div class="card-body py-2 px-3"><div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center">${shouldBeExpandable ? 
                '<i class="bi bi-chevron-right text-muted me-2 expand-icon" style="font-size: 0.8rem; transition: transform 0.2s;"></i>' : 
                '<i class="bi bi-arrow-right text-muted me-2" style="font-size: 0.8rem;"></i>'}
                <span class="text-body fw-medium">${this.formatFeatureName(nodeInfo.feature)}</span>
                <span class="text-muted mx-2">${operatorSymbol}</span>
                <span class="badge text-body border">${nodeInfo.threshold}</span>
                </div>
                <div class="d-flex align-items-center">
                ${shouldBeExpandable ? '<small class="text-muted expand-text me-2">click to expand</small>' : ''}
                <div class="btn-group btn-group-sm ms-2 node-reorder-controls" data-node-id="${nodeId}">
                    <button class="btn btn-outline-secondary btn-sm node-reorder-up" data-node-id="${nodeId}" title="Move up in priority"><i class="bi bi-arrow-up-short"></i></button>
                    <button class="btn btn-outline-secondary btn-sm node-reorder-down" data-node-id="${nodeId}" title="Move down in priority"><i class="bi bi-arrow-down-short"></i></button>
                </div>
                </div>
                </div></div></div>`;
        } else if (nodeInfo.type === 'leaf') {
            return `<div class="card border-0 mb-2"><div class="card-body py-2 px-3"><div class="d-flex align-items-center">
                <i class="bi bi-dot text-success me-2" style="font-size: 1.2rem;"></i>
                <span class="text-muted me-2">Result:</span>
                <span class="text-body fw-medium">${this.formatLeafContent(nodeInfo.content)}</span>
                </div></div></div>`;
        } else {
            return `<div class="card border-0 mb-2"><div class="card-body py-2 px-3"><div class="d-flex align-items-center">
                <i class="bi bi-dot text-muted me-2" style="font-size: 1.2rem;"></i>
                <span class="text-body">${nodeInfo.content}</span>
                </div></div></div>`;
        }
    }

    formatFeatureName(feature) {
        return feature.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').toLowerCase()
            .replace(/^\w/, c => c.toUpperCase()).trim();
    }

    formatLeafContent(content) {
        if (content.includes('class:')) {
            const classMatch = content.match(/class:\s*([^,\s]+)/);
            if (classMatch) return this.formatFeatureName(classMatch[1]);
        }
        if (content.includes('value:')) {
            const valueMatch = content.match(/value:\s*\[([\d.,\s]+)\]/);
            if (valueMatch) {
                const values = valueMatch[1].split(',').map(v => parseFloat(v.trim()));
                const maxIndex = values.indexOf(Math.max(...values));
                return `Class ${maxIndex} (${(values[maxIndex] * 100).toFixed(1)}%)`;
            }
        }
        return content;
    }

    getBranchLabel(parentNodeInfo, childIndex, totalChildren) {
        if (parentNodeInfo.type === 'decision' && totalChildren === 2) {
            const isFirst = childIndex === 0;
            const opText = isFirst ? 
                (parentNodeInfo.operator === '<=' ? '≤' : '>') : 
                (parentNodeInfo.operator === '<=' ? '>' : '≤');
            const cls = isFirst ? 'success' : 'danger';
            const label = isFirst ? 'Yes' : 'No';
            return `<span class="badge bg-${cls} bg-opacity-10 text-${cls} border-${cls}">${label} (${opText} ${parentNodeInfo.threshold})</span>`;
        }
        return null;
    }

    generateTooltip(nodeInfo) {
        if (nodeInfo.type === 'decision') {
            const opText = nodeInfo.operator === '<=' ? 'less than or equal to' : 'greater than';
            return `Decision Node: This checks if ${this.formatFeatureName(nodeInfo.feature)} is ${opText} ${nodeInfo.threshold}. Click to expand and see what happens for each case.`;
        } 
        return nodeInfo.type === 'leaf' ? 
            `Leaf Node: This is a final prediction/classification. No further decisions are made after reaching this point.` : 
            `Tree Node: Part of the decision tree structure. Click to explore further.`;
    }

    attachEventListeners() {
        this.container.querySelectorAll('.tree-node').forEach(node => {
            const hasChildren = node.querySelector('.tree-children');
            if (hasChildren) {
                node.addEventListener('click', (e) => { 
                    // Don't toggle if click was on reorder buttons
                    if (e.target.closest('.node-reorder-controls')) return;
                    e.stopPropagation(); 
                    this.toggleNode(node); 
                });
                node.style.cursor = 'pointer';
                node.classList.add('clickable');
                const cardElement = node.querySelector('.card');
                if (cardElement) {
                    node.addEventListener('mouseenter', () => { cardElement.classList.add('border-primary'); cardElement.style.borderWidth = '1px'; });
                    node.addEventListener('mouseleave', () => { cardElement.classList.remove('border-primary'); cardElement.style.borderWidth = ''; });
                }
            }
        });

        // Add event listeners for node reordering buttons
        this.container.querySelectorAll('.node-reorder-up, .node-reorder-down').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the click from toggling the tree node
                const nodeId = button.getAttribute('data-node-id');
                const direction = button.classList.contains('node-reorder-up') ? 'up' : 'down';
                
                // Add animation class
                const nodeElement = button.closest('.tree-node');
                nodeElement.classList.add('reordering');
                
                // Visual feedback animation
                button.classList.add('active');
                
                // Add bootstrap animation
                const card = nodeElement.querySelector('.card');
                card.classList.add('animate__animated');
                card.classList.add(direction === 'up' ? 'animate__fadeInUp' : 'animate__fadeInDown');
                
                // Call reordering function
                window.treeManager.reorderNode(nodeId, direction);
                
                // Remove animation classes after delay
                setTimeout(() => {
                    button.classList.remove('active');
                    nodeElement.classList.remove('reordering');
                }, 500);
            });
        });
        
        this.initializeTooltips();
    }

    disposeAllTooltips() {
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(element => {
            const tooltip = bootstrap.Tooltip.getInstance(element);
            if (tooltip) tooltip.dispose();
        });
    }

    initializeTooltips() {
        this.disposeAllTooltips();
        [].slice.call(this.container.querySelectorAll('[data-bs-toggle="tooltip"]')).forEach(el => {
            new bootstrap.Tooltip(el, {
                trigger: 'hover focus', placement: 'top', container: 'body', 
                boundary: 'viewport', delay: { show: 300, hide: 100 }
            });
        });
    }

    toggleNode(node) {
        const children = node.querySelector('.tree-children');
        if (!children) return;
        const isCollapsed = node.classList.contains('collapsed');
        const expandIcon = node.querySelector('.expand-icon');
        const expandText = node.querySelector('.expand-text');
        if (isCollapsed) {
            node.classList.replace('collapsed', 'expanded');
            children.classList.remove('d-none');
            if (expandIcon) expandIcon.style.transform = 'rotate(90deg)';
            if (expandText) expandText.textContent = 'click to collapse';
        } else {
            node.classList.replace('expanded', 'collapsed');
            children.classList.add('d-none');
            if (expandIcon) expandIcon.style.transform = 'rotate(0deg)';
            if (expandText) expandText.textContent = 'click to expand';
        }
    }

    toggleAll() {
        this.allExpanded = !this.allExpanded;
        this.container.querySelectorAll('.tree-node').forEach(node => {
            const children = node.querySelector('.tree-children');
            if (!children) return;
            const expandIcon = node.querySelector('.expand-icon');
            const expandText = node.querySelector('.expand-text');
            if (this.allExpanded) {
                node.classList.replace('collapsed', 'expanded');
                children.classList.remove('d-none');
                if (expandIcon) expandIcon.style.transform = 'rotate(90deg)';
                if (expandText) expandText.textContent = 'click to collapse';
            } else {
                node.classList.replace('expanded', 'collapsed');
                children.classList.add('d-none');
                if (expandIcon) expandIcon.style.transform = 'rotate(0deg)';
                if (expandText) expandText.textContent = 'click to expand';
            }
        });
        document.getElementById('toggleTree').innerHTML = this.allExpanded ? 
            '<i class="bi bi-arrows-collapse"></i> Collapse All' : 
            '<i class="bi bi-arrows-expand"></i> Expand All';
    }

    highlightPath(pathConditions) {
        this.container.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('highlighted');
            if (pathConditions && pathConditions.length > 0) {
                const content = node.querySelector('.tree-content').textContent;
                if (pathConditions.some(condition => content.includes(condition))) {
                    node.classList.add('highlighted');
                }
            }
        });
    }
} 