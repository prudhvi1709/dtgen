let pyodide;
let currentData = null;
let currentTree = null;
let previousTree = null;
let originalTree = null;
let currentAccuracy = null;
let previousAccuracy = null;
let originalAccuracy = null;

// Initialize Pyodide
async function initPyodide() {
    try {
        pyodide = await loadPyodide();
        await pyodide.loadPackage(['pandas', 'scikit-learn']);
        enableInteractiveElements();
    } catch (error) {
        console.error('Error initializing Pyodide:', error);
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div class="text-center text-white">
                    <div class="alert alert-danger mb-3" role="alert">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        Failed to initialize Python environment
                    </div>
                    <p class="mb-0">Please refresh the page to try again.</p>
                </div>
            `;
            // Don't hide the overlay on error, just update its content
        }
    }
}

// Enable interactive elements after Pyodide initialization
function enableInteractiveElements() {
    const elements = [
        'csvFile',
        'targetColumn',
        'generateTree',
        'chatInput',
        'sendChat',
        'explainTree'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = false;
        }
    });

    // Hide loading overlay using Bootstrap's d-none class
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('d-none');
    }
}

// Initialize the application
async function init() {
    await initPyodide();
    setupEventListeners();
}

// Set up event listeners
function setupEventListeners() {
    document.getElementById('csvFile').addEventListener('change', handleFileUpload);
    document.getElementById('sendChat').addEventListener('click', handleChat);
    document.getElementById('explainTree').addEventListener('click', explainTree);
    document.getElementById('generateTree').addEventListener('click', handleGenerateTree);
}

// Helper function to toggle spinner
function toggleSpinner(spinnerId, show) {
    const spinner = document.getElementById(spinnerId);
    if (spinner) {
        spinner.classList.toggle('d-none', !show);
    }
}

// Handle CSV file upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    toggleSpinner('generateTreeSpinner', true);
    const reader = new FileReader();
    reader.onload = async function(e) {
        const csvContent = e.target.result;
        await processCSV(csvContent);
        toggleSpinner('generateTreeSpinner', false);
    };
    reader.readAsText(file);
}

// Handle generate tree button click
async function handleGenerateTree() {
    if (currentData) {
        toggleSpinner('generateTreeSpinner', true);
        await processAIResponse('Initial tree generation');
        toggleSpinner('generateTreeSpinner', false);
    }
}

// Process CSV data
async function processCSV(csvContent) {
    const pythonCode = `
import pandas as pd
import json
from io import StringIO

# Read CSV
df = pd.read_csv(StringIO('''${csvContent}'''))

# Get column information
column_info = {
    'columns': df.columns.tolist(),
    'dtypes': df.dtypes.astype(str).to_dict(),
    'sample': df.head().to_dict()
}

json.dumps(column_info)
    `;

    const result = await pyodide.runPythonAsync(pythonCode);
    const columnInfo = JSON.parse(result);
    
    currentData = csvContent;
    updateColumnInfo(columnInfo);
    populateTargetColumn(columnInfo.columns);
    
    // Generate initial tree if target column is already selected
    const targetColumn = document.getElementById('targetColumn').value;
    if (targetColumn) {
        await processAIResponse('Initial tree generation');
    }
}

// Update column information display
function updateColumnInfo(columnInfo) {
    const columnInfoDiv = document.getElementById('columnInfo');
    columnInfoDiv.innerHTML = `
        <h6>Columns:</h6>
        <ul>
            ${columnInfo.columns.map(col => `<li>${col} (${columnInfo.dtypes[col]})</li>`).join('')}
        </ul>
    `;
}

// Populate target column dropdown
function populateTargetColumn(columns) {
    const select = document.getElementById('targetColumn');
    select.innerHTML = columns.map(col => `<option value="${col}">${col}</option>`).join('');
}

// Handle chat with AI
async function handleChat() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    if (!message) return;

    toggleSpinner('chatSpinner', true);
    addToChatHistory('User', message);
    chatInput.value = '';

    try {
        const response = await fetch('https://llmfoundry.straive.com/openai/v1/chat/completions', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4.1-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI assistant helping with decision tree analysis.'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ]
            })
        });

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        addToChatHistory('AI', aiResponse);

        // Process AI response and update tree if needed
        await processAIResponse(aiResponse);
    } catch (error) {
        console.error('Error:', error);
        addToChatHistory('System', 'Error processing your request.');
    } finally {
        toggleSpinner('chatSpinner', false);
    }
}

// Add message to chat history
function addToChatHistory(sender, message) {
    const chatHistory = document.getElementById('chatHistory');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'mb-2';
    messageDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Process AI response and update tree
async function processAIResponse(response) {
    // Save current tree as previous
    previousTree = currentTree;
    previousAccuracy = currentAccuracy;

    // Generate new tree based on AI response
    const pythonCode = `
import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.preprocessing import LabelEncoder
import json
from io import StringIO

# Read data
df = pd.read_csv(StringIO('''${currentData}'''))

# Get target column
target_col = '${document.getElementById('targetColumn').value}'

# Handle categorical data
le = LabelEncoder()
y = le.fit_transform(df[target_col])

# Prepare features
X = df.drop(target_col, axis=1)
categorical_cols = X.select_dtypes(include=['object']).columns
for col in categorical_cols:
    X[col] = le.fit_transform(X[col].astype(str))

# Create and fit the tree
clf = DecisionTreeClassifier(max_depth=3)
clf.fit(X, y)

# Get tree structure with original feature names
tree_structure = export_text(clf, feature_names=X.columns.tolist())
accuracy = float(clf.score(X, y))  # Convert to Python float

# Create mapping for target values and convert to native Python types
target_mapping = {str(k): int(v) for k, v in zip(le.classes_, le.transform(le.classes_))}

json.dumps({
    'tree': tree_structure,
    'accuracy': accuracy,
    'target_mapping': target_mapping
})
    `;

    const result = await pyodide.runPythonAsync(pythonCode);
    const treeData = JSON.parse(result);
    
    currentTree = treeData.tree;
    currentAccuracy = treeData.accuracy;
    
    if (!originalAccuracy) {
        originalAccuracy = currentAccuracy;
    }

    updateTreeVisualization();
    updateMetrics();
}

// Parse tree structure for D3
function parseTreeStructure(treeText) {
    const lines = treeText.split('\n');
    const root = { name: 'Root', children: [] };
    let stack = [root];
    let currentDepth = 0;

    for (const line of lines) {
        if (!line.trim()) continue;

        // Count leading spaces to determine depth
        const depth = line.search(/\S/);
        const content = line.trim();

        // Create node
        const node = {
            name: content,
            children: []
        };

        // Adjust stack based on depth
        while (stack.length > depth + 1) {
            stack.pop();
        }

        // Add node to parent
        stack[stack.length - 1].children.push(node);
        stack.push(node);
    }

    return root;
}

// Update tree visualization
function updateTreeVisualization() {
    if (!currentTree) return;

    const container = document.getElementById('treeContainer');
    container.innerHTML = '';

    // Parse the tree and compute dimensions
    const parsedTree = parseTreeStructure(currentTree);
    const height = Math.max(400, countLeafNodes(parsedTree) * 40);
    const depth = getTreeDepth(parsedTree);
    const width = Math.max(container.clientWidth || 800, depth * 220); // 220px per level

    const treeLayout = d3.tree().size([height - 40, width - 160]); // [height, width]

    const root = d3.hierarchy(parsedTree);
    treeLayout(root);

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', 'translate(80,20)');

    // Draw links
    svg.selectAll('.link')
        .data(root.links())
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('fill', 'none')
        .attr('stroke', '#ccc')
        .attr('stroke-width', 1.5)
        .attr('d', d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x)
        );

    // Draw nodes
    const node = svg.selectAll('.node')
        .data(root.descendants())
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.y},${d.x})`);

    node.append('circle')
        .attr('r', 5)
        .attr('fill', '#fff')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 2);

    node.append('text')
        .attr('dy', '.31em')
        .attr('x', d => d.children ? -10 : 10)
        .attr('text-anchor', d => d.children ? 'end' : 'start')
        .text(d => d.data.name)
        .call(wrap, 180);
}

// Helper function to wrap text
function wrap(text, width) {
    text.each(function() {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const lineHeight = 1.1; // ems
        const y = text.attr('y');
        const dy = parseFloat(text.attr('dy'));
        let tspan = text.text(null).append('tspan').attr('x', 0).attr('y', y).attr('dy', dy + 'em');
        
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(' '));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(' '));
                line = [word];
                tspan = text.append('tspan').attr('x', 0).attr('y', y).attr('dy', ++lineNumber * lineHeight + dy + 'em').text(word);
            }
        }
    });
}

// Helper to count leaf nodes for dynamic height
function countLeafNodes(node) {
    if (!node.children || node.children.length === 0) return 1;
    return node.children.map(countLeafNodes).reduce((a, b) => a + b, 0);
}

// Update metrics display
function updateMetrics() {
    document.getElementById('currentAccuracy').textContent = 
        currentAccuracy ? (currentAccuracy * 100).toFixed(2) + '%' : '-';
    document.getElementById('previousAccuracy').textContent = 
        previousAccuracy ? (previousAccuracy * 100).toFixed(2) + '%' : '-';
    document.getElementById('originalAccuracy').textContent = 
        originalAccuracy ? (originalAccuracy * 100).toFixed(2) + '%' : '-';
}

// Explain tree
async function explainTree() {
    if (!currentTree) return;

    toggleSpinner('explainTreeSpinner', true);
    try {
        const response = await fetch('https://llmfoundry.straive.com/openai/v1/chat/completions', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4.1-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI assistant explaining decision trees.'
                    },
                    {
                        role: 'user',
                        content: `Please explain this decision tree:\n${currentTree}`
                    }
                ]
            })
        });

        const data = await response.json();
        const explanation = data.choices[0].message.content;
        addToChatHistory('AI', `Tree Explanation:\n${explanation}`);
    } catch (error) {
        console.error('Error:', error);
        addToChatHistory('System', 'Error getting tree explanation.');
    } finally {
        toggleSpinner('explainTreeSpinner', false);
    }
}

// Helper function to get tree depth
function getTreeDepth(node) {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(getTreeDepth));
}

// Initialize the application
init(); 