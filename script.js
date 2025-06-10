// Configuration
export const DEFAULT_MAX_DEPTH = null;

import { TreeManager } from './treeManager.js';
import { TreeRenderer } from './treeRenderer.js';
import { toggleSpinner } from './utils.js';

// Initialize managers
const treeManager = new TreeManager();
const treeRenderer = new TreeRenderer('treeContainer');
//  temporary to do testing in console
window.treeManager = treeManager; 

// Initialize the application
async function init() {
    await treeManager.init();
    setupEventListeners();
    
    // Set up tree update callback
    treeManager.setTreeUpdateCallback((treeData) => {
        treeRenderer.render(treeData.tree);
    });
}

// Set up event listeners
function setupEventListeners() {
    document.getElementById('csvFile').addEventListener('change', handleFileUpload);
    document.getElementById('sendChat').addEventListener('click', handleChat);
    document.getElementById('explainTree').addEventListener('click', () => treeManager.explainTree());
    document.getElementById('generateTree').addEventListener('click', handleGenerateTree);
    document.getElementById('globalMaxDepth').addEventListener('change', e => treeManager.handleGlobalDepthChange(parseInt(e.target.value)));
    document.getElementById('clearPruningLimits').addEventListener('click', () => treeManager.clearAllPruningLimits());
    document.getElementById('targetColumn').addEventListener('change', handleGenerateTree);
    document.getElementById('resetNodeOrder').addEventListener('click', resetNodeOrder);
    
    // Add Enter key support for chat input
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleChat();
        }
    });

    // Chat overlay toggle
    document.getElementById('toggleChat').addEventListener('click', () => {
        const chatOverlay = document.getElementById('chatOverlay');
        const noTreeWarning = document.getElementById('noTreeWarning');
        
        // Show/hide warning based on tree availability
        if (treeManager.trees.current) {
            noTreeWarning.classList.add('d-none');
        } else {
            noTreeWarning.classList.remove('d-none');
        }
        
        chatOverlay.classList.toggle('d-none');
        document.getElementById('chatInput').focus();
    });

    // Close chat overlay with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('chatOverlay').classList.add('d-none');
        }
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

// Reset node ordering
function resetNodeOrder() {
    treeManager.nodeOrder.clear();
    treeManager._refreshTree('Resetting node ordering');
}

// Initialize the application
init(); 