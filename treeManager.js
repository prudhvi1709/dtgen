import { DEFAULT_MAX_DEPTH } from './script.js';
import { toggleSpinner, addToChatHistory } from './utils.js';

export class TreeManager {
    constructor() {
        this.pyodide = null;
        this.currentData = null;
        this.currentTree = null;
        this.previousTree = null;
        this.originalTree = null;
        this.currentAccuracy = null;
        this.previousAccuracy = null;
        this.originalAccuracy = null;
        this.nodeDepthLimits = new Map();
        this.globalMaxDepth = DEFAULT_MAX_DEPTH;
        this.onTreeUpdate = null;
    }

    setTreeUpdateCallback(callback) { this.onTreeUpdate = callback; }

    async init() {
        try {
            this.pyodide = await loadPyodide();
            await this.pyodide.loadPackage(['pandas', 'scikit-learn']);
            ['csvFile', 'targetColumn', 'generateTree', 'chatInput', 'sendChat', 'explainTree']
                .forEach(id => {
                    const element = document.getElementById(id);
                    if (element) element.disabled = false;
                });
            document.getElementById('loadingOverlay')?.classList.add('d-none');
        } catch (error) {
            console.error('Error initializing Pyodide:', error);
            document.getElementById('loadingOverlay').innerHTML = `
                <div class="text-center text-white">
                    <div class="alert alert-danger mb-3" role="alert">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>Failed to initialize Python environment
                    </div>
                    <p class="mb-0">Please refresh the page to try again.</p>
                </div>`;
        }
    }

    async processCSV(csvContent) {
        const pythonCode = `
import pandas as pd
import json
from io import StringIO

df = pd.read_csv(StringIO('''${csvContent}'''))
json.dumps({
    'columns': df.columns.tolist(),
    'dtypes': df.dtypes.astype(str).to_dict(),
    'sample': df.head().to_dict()
})`;

        const columnInfo = JSON.parse(await this.pyodide.runPythonAsync(pythonCode));
        this.currentData = csvContent;
        
        document.getElementById('columnInfo').innerHTML = `
            <h6>Columns:</h6>
            <ul>${columnInfo.columns.map(col => 
                `<li>${col} (${columnInfo.dtypes[col]})</li>`).join('')}</ul>`;
        
        const select = document.getElementById('targetColumn');
        select.innerHTML = columnInfo.columns.map(col => 
            `<option value="${col}">${col}</option>`).join('');
        
        if (select.value) await this.processAIResponse('Initial tree generation');
    }

    async processAIResponse(response) {
        this.previousTree = this.currentTree;
        this.previousAccuracy = this.currentAccuracy;

        const pythonCode = `
import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.preprocessing import LabelEncoder
import json
from io import StringIO

df = pd.read_csv(StringIO('''${this.currentData}'''))
target_col = '${document.getElementById('targetColumn').value}'

le = LabelEncoder()
y = le.fit_transform(df[target_col])
X = df.drop(target_col, axis=1)
for col in X.select_dtypes(include=['object']).columns:
    X[col] = le.fit_transform(X[col].astype(str))

class AdvancedDecisionTree(DecisionTreeClassifier):
    def __init__(self, max_depth=None, node_depth_limits=None):
        super().__init__(max_depth=max_depth, min_samples_split=2, min_samples_leaf=1)
        self.node_depth_limits = node_depth_limits or {}
    
    def _build_tree(self, X, y, sample_weight, node_depth=0, parent=None, feature=None, threshold=None):
        if (self.max_depth is not None and node_depth >= self.max_depth) or \
           (f"{feature}_{threshold}" if feature is not None else "root" in self.node_depth_limits and 
            node_depth >= self.node_depth_limits[f"{feature}_{threshold}" if feature is not None else "root"]):
            return None
        return super()._build_tree(X, y, sample_weight, node_depth, parent, feature, threshold)

clf = AdvancedDecisionTree(
    max_depth=${this.globalMaxDepth === null ? 'None' : this.globalMaxDepth},
    node_depth_limits=${JSON.stringify(Object.fromEntries(this.nodeDepthLimits))}
)
clf.fit(X, y)

json.dumps({
    'tree': export_text(clf, feature_names=X.columns.tolist(), show_weights=True),
    'accuracy': float(clf.score(X, y)),
    'target_mapping': {str(k): int(v) for k, v in zip(le.classes_, le.transform(le.classes_))}
})`;

        const treeData = JSON.parse(await this.pyodide.runPythonAsync(pythonCode));
        this.currentTree = treeData.tree;
        this.currentAccuracy = treeData.accuracy;
        if (!this.originalAccuracy) this.originalAccuracy = this.currentAccuracy;

        ['current', 'previous', 'original'].forEach(type => {
            const value = this[`${type}Accuracy`];
            document.getElementById(`${type}Accuracy`).textContent = 
                value ? (value * 100).toFixed(2) + '%' : '-';
        });

        this.onTreeUpdate?.(treeData);
        return treeData;
    }

    async handleChat(message) {
        toggleSpinner('chatSpinner', true);
        addToChatHistory('User', message);
        try {
            const response = await fetch('https://llmfoundry.straive.com/openai/v1/chat/completions', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4.1-mini',
                    messages: [
                        { role: 'system', content: 'You are an AI assistant helping with decision tree analysis.' },
                        { role: 'user', content: message }
                    ]
                })
            });
            const data = await response.json();
            addToChatHistory('AI', data.choices[0].message.content);
            await this.processAIResponse(data.choices[0].message.content);
        } catch (error) {
            console.error('Error:', error);
            addToChatHistory('System', 'Error processing your request.');
        } finally {
            toggleSpinner('chatSpinner', false);
        }
    }

    async explainTree() {
        if (!this.currentTree) return;
        toggleSpinner('explainTreeSpinner', true);
        try {
            const response = await fetch('https://llmfoundry.straive.com/openai/v1/chat/completions', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4.1-mini',
                    messages: [
                        { role: 'system', content: 'You are an AI assistant explaining decision trees.' },
                        { role: 'user', content: `Please explain this decision tree:\n${this.currentTree}` }
                    ]
                })
            });
            const data = await response.json();
            addToChatHistory('AI', `Tree Explanation:\n${data.choices[0].message.content}`);
        } catch (error) {
            console.error('Error:', error);
            addToChatHistory('System', 'Error getting tree explanation.');
        } finally {
            toggleSpinner('explainTreeSpinner', false);
        }
    }

    handleGlobalDepthChange(newDepth) {
        this.globalMaxDepth = newDepth === '' || isNaN(newDepth) ? null : newDepth > 0 ? newDepth : this.globalMaxDepth;
        this.currentData && this.processAIResponse('Updating tree with new global depth limit');
    }

    clearAllPruningLimits() {
        this.nodeDepthLimits.clear();
        this.updateNodeDepthLimitsDisplay();
        this.currentData && this.processAIResponse('Updating tree after clearing all pruning limits');
    }

    updateNodeDepthLimitsDisplay() {
        const container = document.getElementById('nodeDepthLimits');
        if (this.nodeDepthLimits.size === 0) {
            container.innerHTML = '<p class="text-muted small mb-0">No node-specific depth limits set</p>';
            return;
        }
        container.innerHTML = `<div class="list-group">${Array.from(this.nodeDepthLimits.entries())
            .map(([nodeId, depth]) => `
                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                    <span>${nodeId}</span>
                    <div>
                        <span class="badge bg-primary rounded-pill me-2">Depth: ${depth}</span>
                        <button class="btn btn-sm btn-outline-danger" onclick="treeManager.removeNodeDepthLimit('${nodeId}')">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                </div>`).join('')}</div>`;
    }

    addNodeDepthLimit(nodeId, depth) {
        this.nodeDepthLimits.set(nodeId, depth);
        this.updateNodeDepthLimitsDisplay();
        this.currentData && this.processAIResponse('Updating tree with new depth limits');
    }

    removeNodeDepthLimit(nodeId) {
        this.nodeDepthLimits.delete(nodeId);
        this.updateNodeDepthLimitsDisplay();
        this.currentData && this.processAIResponse('Updating tree after removing depth limit');
    }
} 