// Configuration
export const DEFAULT_MAX_DEPTH = null;
export const NODE_DIMENSIONS = {
    width: 250,
    height: 50,
    verticalGap: 80,
    horizontalGap: 40
};
export const TREE_DIMENSIONS = {
    minWidth: 800,
    minHeight: 400
};
export const COLORS = {
    root: 'var(--bs-primary)',
    leaf: 'var(--bs-info-bg-subtle)',
    decision: 'var(--bs-warning-bg-subtle)',
    rootStroke: 'var(--bs-primary-border-subtle)',
    leafStroke: 'var(--bs-info-border-subtle)',
    decisionStroke: 'var(--bs-warning-border-subtle)',
    link: 'var(--bs-primary)'
};

import { TreeManager } from './treeManager.js';
import { TreeVisualizer } from './treeVisualizer.js';
import { toggleSpinner } from './utils.js';

// Initialize managers
const treeManager = new TreeManager();
const treeVisualizer = new TreeVisualizer('modalTreeContainer');
//  temporary to do testing in console
window.treeManager = treeManager; 
// Initialize the application
async function init() {
    await treeManager.init();
    setupEventListeners();
    addShowTreeButton();
    
    // Set up tree update callback
    treeManager.setTreeUpdateCallback((treeData) => {
        treeVisualizer.visualize(treeData.tree);
        const treeModal = new bootstrap.Modal(document.getElementById('treeModal'));
        treeModal.show();
        document.getElementById('showTreeBtn').classList.add('d-none');
    });
}

// Add show tree button to the UI
function addShowTreeButton() {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'position-fixed bottom-0 end-0 m-3';
    buttonContainer.innerHTML = `
        <button id="showTreeBtn" class="btn btn-primary d-none" onclick="showTree()">
            <i class="bi bi-diagram-3"></i> Show Tree
        </button>
    `;
    document.body.appendChild(buttonContainer);
}

// Show tree visualization
window.showTree = function() {
    if (treeManager.currentTree) {
        treeVisualizer.visualize(treeManager.currentTree);
        const treeModal = new bootstrap.Modal(document.getElementById('treeModal'));
        treeModal.show();
    }
};

// Set up event listeners
function setupEventListeners() {
    document.getElementById('csvFile').addEventListener('change', handleFileUpload);
    document.getElementById('sendChat').addEventListener('click', handleChat);
    document.getElementById('explainTree').addEventListener('click', () => treeManager.explainTree());
    document.getElementById('generateTree').addEventListener('click', handleGenerateTree);
    document.getElementById('globalMaxDepth').addEventListener('change', e => treeManager.handleGlobalDepthChange(parseInt(e.target.value)));
    document.getElementById('clearPruningLimits').addEventListener('click', () => treeManager.clearAllPruningLimits());
    document.getElementById('targetColumn').addEventListener('change', handleGenerateTree);

    // Add event listener for modal close
    document.getElementById('treeModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('showTreeBtn').classList.remove('d-none');
    });
}

// Handle CSV file upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    toggleSpinner('generateTreeSpinner', true);
    const reader = new FileReader();
    reader.onload = async function(e) {
        await treeManager.processCSV(e.target.result);
        toggleSpinner('generateTreeSpinner', false);
    };
    reader.readAsText(file);
}

// Handle generate tree button click
async function handleGenerateTree() {
    if (treeManager.currentData) {
        toggleSpinner('generateTreeSpinner', true);
        await treeManager.processAIResponse('Initial tree generation');
        toggleSpinner('generateTreeSpinner', false);
    }
}

// Handle chat
async function handleChat() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.value = '';
    await treeManager.handleChat(message);
}

// Initialize the application
init(); 