import { DEFAULT_MAX_DEPTH, toggleSpinner, addToChatHistory } from './script.js';

const LLM_API_ENDPOINT = 'https://llmfoundry.straive.com/openai/v1/chat/completions';
const LLM_MODEL_NAME = 'gpt-4.1-mini';

export class TreeManager {
    constructor() {
        this.pyodide = null;
        this.currentData = null;
        this.trees = { current: null, previous: null, original: null };
        this.accuracies = { current: null, previous: null, original: null };
        this.metrics = { 
            precision: { current: null, previous: null, original: null },
            recall: { current: null, previous: null, original: null },
            f1: { current: null, previous: null, original: null }
        };
        this.activeMetric = 'accuracy'; // Default metric
        this.nodeDepthLimits = new Map();
        this.globalMaxDepth = DEFAULT_MAX_DEPTH;
        this.onTreeUpdate = null;
        this.nodeOrder = new Map(); // Track custom node order
        this._isReordering = false;
    }

    setTreeUpdateCallback(callback) { this.onTreeUpdate = callback; }

    async init() {
        try {
            this.pyodide = await loadPyodide();
            await this.pyodide.loadPackage(['pandas', 'scikit-learn']);
            this._enableElements(['csvFile', 'targetColumn', 'generateTree', 'chatInput', 'sendChat', 'toggleChat', 'explainTree']);
            document.getElementById('loadingOverlay')?.classList.add('d-none');
            
            // Setup metric change event listener
            const metricSelector = document.getElementById('metricSelector');
            if (metricSelector) {
                metricSelector.addEventListener('change', (e) => {
                    this.activeMetric = e.target.value;
                    this._updateMetricDisplay();
                });
            }
        } catch (error) {
            console.error('Error initializing Pyodide:', error);
            this._showError('Failed to initialize Python environment');
        }
    }

    async processCSV(csvContent) {
        const columnInfo = JSON.parse(await this._runPython(`
import pandas as pd, json, numpy as np; from io import StringIO

# Custom JSON encoder to handle NaN values
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.floating, float)) and (np.isnan(obj) or not np.isfinite(obj)):
            return None
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NpEncoder, self).default(obj)

try:
    # Read the CSV
    df = pd.read_csv(StringIO('''${csvContent}'''))
    
    # Create a safe copy of the sample data with NaN values replaced with 0
    sample_df = df.head().fillna(0)
    
    # For the sample dict, convert to Python native types to avoid JSON issues
    sample_dict = {}
    for col in sample_df.columns:
        sample_dict[col] = sample_df[col].to_list()
    
    result = json.dumps({
        'columns': df.columns.tolist(),
        'dtypes': df.dtypes.astype(str).to_dict(),
        'sample': sample_dict
    }, cls=NpEncoder)
except Exception as e:
    result = json.dumps({
        'error': str(e),
        'columns': [],
        'dtypes': {},
        'sample': {}
    })

result`));
        
        this.currentData = csvContent;
        this._updateColumnInfo(columnInfo);
        this._populateTargetColumn(columnInfo.columns);
        document.getElementById('explainTree').disabled = true;
        if (document.getElementById('targetColumn').value) await this.processAIResponse('Initial tree generation');
    }

    async processAIResponse(response) {
        try {
            this._updateTreeState();
            const pythonResult = await this._runPython(this._getTreeCode());
            const treeData = JSON.parse(pythonResult);
            
            // Check if there was an error in the Python code
            if (treeData.error) {
                console.error("Python error:", treeData.error);
                addToChatHistory('System', `Error processing data: ${treeData.error}`);
                return null;
            }
            
            this.trees.current = treeData.tree;
            this.accuracies.current = treeData.accuracy;
            this.metrics.precision.current = treeData.precision;
            this.metrics.recall.current = treeData.recall;
            this.metrics.f1.current = treeData.f1;
            
            if (!this.accuracies.original) {
                this.accuracies.original = this.accuracies.current;
                this.trees.original = this.trees.current;
                this.metrics.precision.original = this.metrics.precision.current;
                this.metrics.recall.original = this.metrics.recall.current;
                this.metrics.f1.original = this.metrics.f1.current;
            }
            this._updateMetricDisplay();
            document.getElementById('explainTree').disabled = false;
            this.onTreeUpdate?.(treeData);
            return treeData;
        } catch (error) {
            console.error("Error in processAIResponse:", error);
            addToChatHistory('System', `Error processing tree: ${error.message || error}`);
            return null;
        }
    }

    async handleChat(message) {
        return this._apiCall('chatSpinner', async () => {
            addToChatHistory('User', message);
            
            // Create context message including current tree state
            const contextMessage = this.trees.current 
                ? `Current Decision Tree State:\n${this.trees.current}\n\nUser Question: ${message}`
                : `No decision tree has been generated yet. User Question: ${message}`;
            
            const response = await this._callAI(
                'You are an AI assistant helping with decision tree analysis. Always reference the current tree state when answering questions.',
                contextMessage
            );
            
            addToChatHistory('AI', response);
            await this.processAIResponse(response);
        }, 'Error processing your request.');
    }

    async explainTree() {
        if (!this.trees.current) return;
        return this._apiCall('explainTreeSpinner', async () => {
            // Get node-level explanations
            const nodeExplanations = await this._getNodeLevelExplanations();
            
            // Get general tree explanation
            const treeExplanation = await this._callAI(
                'You are an AI assistant explaining decision trees. Provide a brief, clear explanation.',
                `Please briefly explain this decision tree:\n${this.trees.current}\n\nInclude performance metrics: Accuracy: ${(this.accuracies.current * 100).toFixed(2)}%, Precision: ${(this.metrics.precision.current * 100).toFixed(2)}%, Recall: ${(this.metrics.recall.current * 100).toFixed(2)}%, F1: ${(this.metrics.f1.current * 100).toFixed(2)}%`
            );
            
            // Combine explanations
            const combinedExplanation = `
                <h5>Overall Tree Analysis</h5>
                <div class="mb-3">${treeExplanation.replace(/\n/g, '<br>')}</div>
                
                <h5>Key Node Explanations</h5>
                <div class="accordion" id="nodeExplanationsAccordion">
                    ${nodeExplanations}
                </div>
            `;
            
            document.getElementById('treeExplanationContent').innerHTML = combinedExplanation;
            document.getElementById('treeExplanationCard').classList.remove('d-none');
        }, 'Error getting tree explanation.');
    }

    async _getNodeLevelExplanations() {
        // Get decision nodes from the tree
        const treeLines = this.trees.current.split('\n');
        const decisionNodes = treeLines
            .filter(line => (line.includes('<=') || line.includes('>')))
            .slice(0, 3); // Limit to top 3 most important nodes for performance
        
        if (decisionNodes.length === 0) return '<div class="alert alert-info">No significant decision nodes found to explain.</div>';
        
        // Get explanations for each node
        let nodeExplanationsHTML = '';
        
        for (let i = 0; i < decisionNodes.length; i++) {
            const node = decisionNodes[i].trim();
            const nodeInfo = this._parseNodeInfo(node);
            
            if (nodeInfo) {
                const nodeExplanation = await this._callAI(
                    'You are an AI assistant providing brief, technical explanations for decision tree nodes. Keep explanations under 100 words.',
                    `Explain the significance of this decision node in the tree: "${node}". Why is this split important?`
                );
                
                nodeExplanationsHTML += `
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#nodeCollapse${i}">
                                <strong>${nodeInfo.feature} ${nodeInfo.operator} ${nodeInfo.threshold}</strong>
                            </button>
                        </h2>
                        <div id="nodeCollapse${i}" class="accordion-collapse collapse">
                            <div class="accordion-body">
                                ${nodeExplanation.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        return nodeExplanationsHTML;
    }

    _parseNodeInfo(nodeText) {
        // Parse feature, operator and threshold from node text
        const match = nodeText.match(/([^\s<>]+)\s*([<>]=?)\s*([^\s]+)/);
        if (match && match.length >= 4) {
            return {
                feature: match[1],
                operator: match[2],
                threshold: match[3]
            };
        }
        return null;
    }

    handleGlobalDepthChange(newDepth) {
        this.globalMaxDepth = newDepth === '' || isNaN(newDepth) ? null : Math.max(0, newDepth) || this.globalMaxDepth;
        this._refreshTree('Updating tree with new global depth limit');
    }

    clearAllPruningLimits() {
        this.nodeDepthLimits.clear();
        this.updateNodeDepthLimitsDisplay();
        this._refreshTree('Updating tree after clearing all pruning limits');
    }

    addNodeDepthLimit(nodeId, depth) { this._modifyNodeDepthLimit(() => this.nodeDepthLimits.set(nodeId, depth), 'Updating tree with new depth limits'); }
    removeNodeDepthLimit(nodeId) { this._modifyNodeDepthLimit(() => this.nodeDepthLimits.delete(nodeId), 'Updating tree after removing depth limit'); }

    // Node reordering functionality
    reorderNode(nodeId, direction) {
        // Check if we're still processing a previous reordering
        if (this._isReordering) return;
        
        this._isReordering = true;
        
        // Show visual feedback for current operation
        const statusElement = document.createElement('div');
        statusElement.className = 'alert alert-info alert-dismissible fade show position-fixed bottom-0 end-0 m-3';
        statusElement.style.zIndex = '1050';
        statusElement.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                <div>Reordering node ${nodeId} ${direction}</div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        document.body.appendChild(statusElement);
        
        // Set a timeout to remove the status element
        setTimeout(() => {
            statusElement.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(statusElement);
            }, 150);
        }, 1500);
        
        // Update the node order
        const order = this.nodeOrder.get(nodeId) || 0;
        this.nodeOrder.set(nodeId, direction === 'up' ? order - 1 : order + 1);
        
        // Refresh the tree with a delay to allow animation to complete
        setTimeout(() => {
            this._refreshTree(`Reordering node ${nodeId} ${direction}`);
            this._isReordering = false;
        }, 300);
    }

    updateNodeDepthLimitsDisplay() {
        const container = document.getElementById('nodeDepthLimits');
        container.innerHTML = this.nodeDepthLimits.size === 0 ? '<p class="text-muted small mb-0">No node-specific depth limits set</p>' : 
            `<div class="list-group">${Array.from(this.nodeDepthLimits.entries()).map(([nodeId, depth]) => 
                `<div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"><span>${nodeId}</span><div><span class="badge bg-primary rounded-pill me-2">Depth: ${depth}</span><button class="btn btn-sm btn-outline-danger" onclick="treeManager.removeNodeDepthLimit('${nodeId}')"><i class="bi bi-x"></i></button></div></div>`).join('')}</div>`;
    }

    // Helper methods
    async _runPython(code) { return await this.pyodide.runPythonAsync(code); }
    
    async _apiCall(spinnerId, operation, errorMessage) {
        toggleSpinner(spinnerId, true);
        try { await operation(); } catch (error) { console.error('Error:', error); addToChatHistory('System', errorMessage); } finally { toggleSpinner(spinnerId, false); }
    }

    async _callAI(systemMessage, userMessage) {
        const response = await fetch(LLM_API_ENDPOINT, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: LLM_MODEL_NAME, messages: [{ role: 'system', content: systemMessage }, { role: 'user', content: userMessage }]})
        });
        return (await response.json()).choices[0].message.content;
    }

    _enableElements(ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; }); }
    
    _showError(message) {
        document.getElementById('loadingOverlay').innerHTML = `<div class="text-center text-white"><div class="alert alert-danger mb-3" role="alert"><i class="bi bi-exclamation-triangle-fill me-2"></i>${message}</div><p class="mb-0">Please refresh the page to try again.</p></div>`;
    }

    _updateColumnInfo(columnInfo) {
        document.getElementById('columnInfo').innerHTML = `<h6>Columns:</h6><ul>${columnInfo.columns.map(col => `<li>${col} (${columnInfo.dtypes[col]})</li>`).join('')}</ul>`;
    }

    _populateTargetColumn(columns) {
        document.getElementById('targetColumn').innerHTML = columns.map(col => `<option value="${col}">${col}</option>`).join('');
    }

    _updateTreeState() { 
        this.trees.previous = this.trees.current; 
        this.accuracies.previous = this.accuracies.current; 
        this.metrics.precision.previous = this.metrics.precision.current;
        this.metrics.recall.previous = this.metrics.recall.current;
        this.metrics.f1.previous = this.metrics.f1.current;
    }
    
    _updateMetricDisplay() {
        // Display the active metric values
        ['current', 'previous', 'original'].forEach(type => {
            let value = null;
            
            switch (this.activeMetric) {
                case 'accuracy':
                    value = this.accuracies[type];
                    break;
                case 'precision':
                case 'recall':
                case 'f1':
                    value = this.metrics[this.activeMetric][type];
                    break;
            }
            
            const metricElement = document.getElementById(`${type}Accuracy`);
            if (metricElement) {
                metricElement.textContent = value ? (value * 100).toFixed(2) + '%' : '-';
            }
            
            // Update the metric name in the headers
            const metricNameDisplay = document.getElementById('currentMetricName');
            if (metricNameDisplay) {
                metricNameDisplay.textContent = this.activeMetric.charAt(0).toUpperCase() + this.activeMetric.slice(1);
            }
        });
    }

    _refreshTree(message) { if (this.currentData) this.processAIResponse(message); }
    _modifyNodeDepthLimit(operation, message) { operation(); this.updateNodeDepthLimitsDisplay(); this._refreshTree(message); }

    _getTreeCode() {
        return `import pandas as pd, numpy as np, json
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import precision_score, recall_score, f1_score
from io import StringIO

df = pd.read_csv(StringIO('''${this.currentData}'''))

# Handle NaN values - replace with 0 for numerical columns and 'missing' for categorical
numeric_cols = df.select_dtypes(include=['number']).columns
categorical_cols = df.select_dtypes(exclude=['number']).columns

# Fill NaN values
df[numeric_cols] = df[numeric_cols].fillna(0)
df[categorical_cols] = df[categorical_cols].fillna('missing')

target_col = '${document.getElementById('targetColumn').value}'

X_raw = df.drop(target_col, axis=1)
y_raw = df[target_col]

# Encode target variable
le_target = LabelEncoder()
y = le_target.fit_transform(y_raw)

# Encode features
X = X_raw.copy() # X will be the DataFrame with encoded features and original column names
feature_encoders = {}
for col in X.select_dtypes(include=['object', 'boolean']).columns: # Include boolean as they might not be 0/1
    le_feature = LabelEncoder()
    X[col] = le_feature.fit_transform(X[col].astype(str)) # Convert to string to handle mixed types or bools consistently
    feature_encoders[col] = le_feature
# Ensure all other columns are numeric. If not, they might need explicit handling or conversion.
# For this example, we assume remaining columns are numeric or DecisionTreeClassifier can handle them.

class AdvancedDecisionTree(DecisionTreeClassifier):
    def __init__(self, max_depth=None, node_depth_limits=None, node_order=None):
        super().__init__(max_depth=max_depth, min_samples_split=2, min_samples_leaf=1)
        self.node_depth_limits = node_depth_limits or {}
        # self.node_order maps node_id (e.g., "featureName_thresholdValue") to a priority (lower is better).
        self.node_order = node_order or {}
        
    def _build_tree(self, X_build, y_build, sample_weight_build, node_depth=0, parent=None, feature=None, threshold=None):
        # WARNING: Overriding _build_tree is highly fragile and not recommended.
        # Scikit-learn's DecisionTreeClassifier already handles the global 'max_depth'.
        # Implementing per-node depth limits by overriding this private method
        # is complex, error-prone, and may break with scikit-learn updates.
        # The logic for 'node_depth_limits' here is a conceptual attempt and likely NOT effective
        # or may interact badly with the tree construction.
        # A proper way to achieve per-node depth limits would require a more significant
        # modification of the tree building algorithm or post-pruning strategies.

        # The original check for node_depth_limits was:
        # current_node_id_tuple_key = (feature, threshold) # Assuming feature is index, threshold is value
        # if self.node_depth_limits.get(current_node_id_tuple_key) is not None and node_depth >= self.node_depth_limits[current_node_id_tuple_key]:
        #     return None # Attempt to prune

        # For safety and correctness, relying on standard max_depth and other pruning params is better.
        # This custom override is too risky.
        return super()._build_tree(X_build, y_build, sample_weight_build, node_depth, parent, feature, threshold)

    def _find_best_split(self, X_split, y_split, sample_weight_split):
        # X_split is numpy array, y_split is numpy array
        feature_names_list = X.columns.tolist() # Closure: X is the DataFrame prepared outside with original column names

        best_idx, best_thr, best_improvement = super()._find_best_split(X_split, y_split, sample_weight_split)
        
        # WARNING: Overriding _find_best_split is highly fragile and not recommended.
        # The following logic attempts to enforce node_order by directly overriding
        # the chosen split (best_idx, best_thr) if a higher priority node is found.
        # CRITICAL FLAW: This override does NOT re-evaluate the quality (e.g., impurity reduction)
        # of the prioritized split. It can force the tree to make a very poor quality split
        # simply because it has a high priority, potentially leading to a significantly
        # suboptimal tree. A correct implementation would need to calculate the improvement
        # for any prioritized split and compare it appropriately.
        # The node_id for node_order is expected to be "featureName_thresholdValue".

        if best_idx != -1: # A split was found by the parent method
            current_best_feature_name = feature_names_list[best_idx]
            # Format threshold to ensure consistent string representation for matching keys in node_order
            current_best_node_id = f"{current_best_feature_name}_{float(best_thr):.6f}"
            current_best_priority = self.node_order.get(current_best_node_id, float('inf'))

            # Iterate over features in X_split (which is a numpy array)
            for f_idx in range(X_split.shape[1]):
                feat_name_for_id = feature_names_list[f_idx] # Get original feature name using index

                # Iterate over unique thresholds present in the current subset X_split for this feature
                unique_thresholds_for_feature = np.unique(X_split[:, f_idx])

                for thr_val_for_id in unique_thresholds_for_feature:
                    # Format threshold for consistency
                    node_id_to_check = f"{feat_name_for_id}_{float(thr_val_for_id):.6f}"
                    priority_to_check = self.node_order.get(node_id_to_check, float('inf'))

                    if priority_to_check < current_best_priority:
                        # Found a node with higher priority.
                        # As noted in WARNING, this directly overrides without checking split quality.
                        current_best_priority = priority_to_check
                        best_idx = f_idx
                        best_thr = thr_val_for_id
                        # best_improvement is NOT updated for this new forced split.
        return best_idx, best_thr, best_improvement

clf = AdvancedDecisionTree(
    max_depth=${this.globalMaxDepth === null ? 'None' : this.globalMaxDepth}, 
    node_depth_limits=json.loads('''${JSON.stringify(Object.fromEntries(this.nodeDepthLimits))}'''),
    node_order=json.loads('''${JSON.stringify(Object.fromEntries(this.nodeOrder))}''')
)

# The actual fitting and metrics calculation is now done in the try-except block below

# Ensure all values are JSON serializable
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.floating, float)) and (np.isnan(obj) or not np.isfinite(obj)):
            return None
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NpEncoder, self).default(obj)

try:
    # Convert X (pandas DataFrame) to NumPy array for scikit-learn fitting
    # Check for remaining NaN values after fillna operations
    if X.isnull().any().any() or y_raw.isnull().any():
        raise ValueError("Data still contains NaN values after preprocessing")
        
    X_np = X.to_numpy()
    clf.fit(X_np, y)
    
    accuracy = float(clf.score(X_np, y))
    y_pred = clf.predict(X_np)
    
    # Calculate additional metrics
    precision = float(precision_score(y, y_pred, average='weighted', zero_division=0))
    recall = float(recall_score(y, y_pred, average='weighted', zero_division=0))
    f1 = float(f1_score(y, y_pred, average='weighted', zero_division=0))
    
    result = json.dumps({
        'tree': export_text(clf, feature_names=X.columns.tolist(), show_weights=True), 
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'target_mapping': {str(le_target.classes_[i]): int(i) for i in range(len(le_target.classes_))}
    }, cls=NpEncoder)
except Exception as e:
    import traceback
    error_message = str(e) + "\\n" + traceback.format_exc()
    result = json.dumps({
        'error': error_message,
        'tree': "Error generating tree",
        'accuracy': 0,
        'precision': 0,
        'recall': 0,
        'f1': 0
    })

result`
    }

}