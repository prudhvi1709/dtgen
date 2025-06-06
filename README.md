# Decision Tree Builder

An interactive web application for building and modifying decision trees using AI assistance.

## Features

### Implemented
- Upload CSV files and analyze data
- Chat with AI to identify new derived columns
- Interactive decision tree visualization using D3.js
- AI-powered tree explanations
- Model accuracy tracking and comparison
- Real-time tree updates and modifications

### Work in Progress (WIP)
- []Advanced tree pruning capabilities (e.g., limiting depth under specific nodes)
- []Manual cutoff adjustments through chat interface
- []Node reordering functionality
- []More granular control over tree structure modifications
- []Enhanced AI explanations with specific node-level details
- []Support for different tree metrics beyond accuracy
- []Improved error handling and user feedback
- []Performance optimizations for large datasets

## Setup

1. Clone the repository
2. Open `index.html` in a modern web browser
3. No additional setup required - all dependencies are loaded from CDN

## Usage

1. Upload a CSV file using the file input
2. Select the target column for the decision tree
3. Use the chat interface to:
   - Request new derived columns
   - Modify the tree structure
   - Prune the tree
   - Change cutoffs
   - Reorder nodes
4. Click the "Explain Tree" button to get AI-powered explanations
5. Monitor model accuracy across iterations

## Dependencies

- Bootstrap 5.3.0
- D3.js v7
- Pyodide v0.24.1
- scikit-learn (loaded via Pyodide)
- pandas (loaded via Pyodide)

## Note

The application requires an internet connection to:
- Load CDN resources
- Make API calls to the LLM service
- Load Python packages via Pyodide

## API Configuration

To use the LLM features, you need to:
1. Replace `YOUR_API_KEY` in `app.js` with your actual API key
2. Ensure you have access to the LLM service at `https://llmfoundry.straive.com/openai/v1/chat/completions` 