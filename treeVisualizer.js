import { NODE_DIMENSIONS, TREE_DIMENSIONS, COLORS } from './script.js';
import { getTreeDepth, countLeafNodes, parseTreeStructure } from './utils.js';

export class TreeVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.svg = null;
        this.zoom = null;
    }

    visualize(treeText) {
        const parsedTree = parseTreeStructure(treeText);
        const depth = getTreeDepth(parsedTree);
        const leafCount = countLeafNodes(parsedTree);
        
        const width = Math.max(TREE_DIMENSIONS.minWidth, leafCount * (NODE_DIMENSIONS.width + NODE_DIMENSIONS.horizontalGap));
        const height = Math.max(TREE_DIMENSIONS.minHeight, depth * (NODE_DIMENSIONS.height + NODE_DIMENSIONS.verticalGap));

        this.setupSVG(width, height);
        this.setupZoom();
        
        const treeLayout = d3.tree().size([width - 160, height - 80]);
        const root = d3.hierarchy(parsedTree);
        treeLayout(root);

        this.drawTree(root);
        if (countLeafNodes(root.data) > 20 || getTreeDepth(root.data) > 5) {
            this.addMinimap(root, width, height);
        }
    }

    setupSVG(width, height) {
        this.container.innerHTML = '';
        this.addControls();
        
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .append('g')
            .attr('transform', 'translate(80,40)');
    }

    setupZoom() {
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => this.svg.attr('transform', event.transform));
        
        d3.select(this.container.querySelector('svg')).call(this.zoom);
    }

    drawTree(root) {
        this.svg.append('defs').append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 5)
            .attr('refY', 5)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto-start-reverse')
            .append('path')
            .attr('d', 'M 0 0 L 10 5 L 0 10 z')
            .attr('fill', COLORS.link);

        this.svg.selectAll('.link')
            .data(root.links())
            .enter()
            .append('line')
            .attr('class', 'link')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y)
            .attr('stroke', COLORS.link)
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrow)');

        const node = this.svg.selectAll('.node')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x - NODE_DIMENSIONS.width / 2},${d.y})`);

        node.append('rect')
            .attr('width', NODE_DIMENSIONS.width)
            .attr('height', NODE_DIMENSIONS.height)
            .attr('rx', 12)
            .attr('ry', 12)
            .attr('fill', d => d.depth === 0 ? COLORS.root : (!d.children ? COLORS.leaf : COLORS.decision))
            .attr('stroke', d => d.depth === 0 ? COLORS.rootStroke : (!d.children ? COLORS.leafStroke : COLORS.decisionStroke))
            .attr('stroke-width', 3);

        node.append('text')
            .attr('x', NODE_DIMENSIONS.width / 2)
            .attr('y', NODE_DIMENSIONS.height / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '14px')
            .attr('fill', d => d.depth === 0 ? '#fff' : '#333')
            .text(d => d.depth === 0 ? 'Root Node' : d.data.name);
    }

    addControls() {
        const controls = document.createElement('div');
        controls.className = 'position-absolute top-0 end-0 m-3 d-flex gap-2';
        controls.innerHTML = `
            <button class="btn btn-light btn-sm" id="zoomIn"><i class="bi bi-zoom-in"></i></button>
            <button class="btn btn-light btn-sm" id="zoomOut"><i class="bi bi-zoom-out"></i></button>
            <button class="btn btn-light btn-sm" id="resetZoom"><i class="bi bi-arrows-fullscreen"></i></button>
            <div class="dropdown">
                <button class="btn btn-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                    <i class="bi bi-download"></i> Export
                </button>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item" href="#" id="exportPNG">Save as PNG</a></li>
                    <li><a class="dropdown-item" href="#" id="exportSVG">Save as SVG</a></li>
                    <li><a class="dropdown-item" href="#" id="exportPDF">Save as PDF</a></li>
                </ul>
            </div>
        `;
        this.container.appendChild(controls);

        const svg = d3.select(this.container.querySelector('svg'));
        document.getElementById('zoomIn').onclick = () => svg.transition().duration(300).call(this.zoom.scaleBy, 1.3);
        document.getElementById('zoomOut').onclick = () => svg.transition().duration(300).call(this.zoom.scaleBy, 0.7);
        document.getElementById('resetZoom').onclick = () => svg.transition().duration(300).call(this.zoom.transform, d3.zoomIdentity);

        document.getElementById('exportPNG').onclick = () => this.exportAsPNG();
        document.getElementById('exportSVG').onclick = () => this.exportAsSVG();
        document.getElementById('exportPDF').onclick = () => this.exportAsPDF();
    }

    async exportAsPNG() {
        const svgElement = this.container.querySelector('svg');
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const link = document.createElement('a');
            link.download = 'decision-tree.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }

    exportAsSVG() {
        const svgElement = this.container.querySelector('svg');
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = 'decision-tree.svg';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }

    async exportAsPDF() {
        const svgElement = this.container.querySelector('svg');
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save('decision-tree.pdf');
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }

    addMinimap(root, width, height) {
        const minimap = document.createElement('div');
        minimap.className = 'position-absolute bottom-0 end-0 m-3 bg-light p-2 rounded shadow-sm';
        minimap.style.width = '200px';
        minimap.style.height = '150px';
        minimap.style.opacity = '0.8';
        minimap.style.cursor = 'pointer';
        this.container.appendChild(minimap);

        const minimapSvg = d3.select(minimap)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%');

        const minimapGroup = minimapSvg.append('g')
            .attr('transform', `scale(${200/width}, ${150/height})`);

        minimapGroup.selectAll('.minimap-link')
            .data(root.links())
            .enter()
            .append('line')
            .attr('class', 'minimap-link')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y)
            .attr('stroke', '#666')
            .attr('stroke-width', 1);

        minimapGroup.selectAll('.minimap-node')
            .data(root.descendants())
            .enter()
            .append('circle')
            .attr('class', 'minimap-node')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', 2)
            .attr('fill', d => d.depth === 0 ? COLORS.root : (!d.children ? COLORS.leaf : COLORS.decision));

        minimap.onclick = (event) => {
            const rect = minimap.getBoundingClientRect();
            const x = (event.clientX - rect.left) * (width / 200);
            const y = (event.clientY - rect.top) * (height / 150);
            
            d3.select(this.container.querySelector('svg'))
                .transition()
                .duration(300)
                .call(this.zoom.transform, d3.zoomIdentity.translate(width/2 - x, height/2 - y));
        };
    }
} 