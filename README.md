# Decision Tree Builder

An interactive web application for building, visualizing, and modifying decision trees with AI assistance. This tool combines machine learning capabilities with an intuitive interface to help users create, understand, and refine decision trees for data analysis and prediction tasks.

## Key Features

- **Data Integration**
  - Upload and analyze CSV datasets
  - Automatic feature detection and preprocessing
  - Support for categorical and numerical data

- **AI-Powered Assistance**
  - Natural language chat interface for tree modifications
  - Intelligent feature derivation from raw data
  - Contextual explanations of decision nodes and tree structure
  - Performance analysis and improvement suggestions

- **Advanced Visualization**
  - Custom interactive tree visualization
  - Expandable/collapsible nodes for easy navigation
  - Visual indicators for decision thresholds and leaf nodes
  - Tooltips with contextual information

- **Tree Manipulation**
  - Dynamic node reordering to adjust feature importance
  - Pruning controls for complexity management
  - Cutoff threshold adjustments via chat interface
  - Custom depth limitations for individual branches

- **Performance Metrics**
  - Real-time accuracy tracking
  - Precision, recall, and F1 score calculations
  - Comparative metrics between tree iterations
  - Visual performance indicators

## Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge, Safari)
- Internet connection (required for CDN resources and AI functionality)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/prudhvi1709/dtgen.git
   ```

2. Open `index.html` in your web browser
   - No additional setup required - all dependencies are loaded from CDN

## How to Use

1. **Data Import**
   - Upload your CSV dataset using the file input
   - The application will automatically detect columns and data types

2. **Initial Configuration**
   - Select your target prediction column
   - Click "Generate Decision Tree" to create the initial model

3. **Tree Interaction**
   - Explore the tree by expanding/collapsing nodes
   - Click "Explain Tree" to get AI-powered insights
   - Select different performance metrics to evaluate the model

4. **AI Collaboration**
   - Click "Chat with AI" to open the chat interface
   - Use natural language to request:
     - New derived columns based on domain knowledge
     - Tree structure modifications
     - Pruning specific branches
     - Adjusting decision thresholds
     - Reordering nodes for different feature priorities

5. **Refinement**
   - Compare metrics between iterations
   - Fine-tune the tree based on AI suggestions
   - Export or share your optimized model

## Technical Details

### Architecture
The application uses a client-side architecture that combines:
- JavaScript for UI interactions and tree management
- Python (via Pyodide WebAssembly) for machine learning computation
- Custom tree rendering with Bootstrap components
- LLM API for AI assistance and explanations

```mermaid
graph TD
    subgraph "Frontend"
        UI["User Interface<br/>(HTML/CSS/Bootstrap)"]
        JS["JavaScript<br/>Controllers"]
        TR["Custom Tree<br/>Visualization"]
    end
    
    subgraph "Core Components"
        TM["Tree Manager<br/>(treeManager.js)"]
        TRD["Tree Renderer<br/>(treeRenderer.js)"]
        UT["Utilities<br/>(utils.js)"]
        SC["Main Script<br/>(script.js)"]
    end
    
    subgraph "Backend Processing"
        PY["Pyodide<br/>(Python in Browser)"]
        ML["scikit-learn<br/>(Decision Trees)"]
        PD["pandas<br/>(Data Processing)"]
    end
    
    subgraph "External Services"
        API["LLM API<br/>(AI Assistance)"]
        CDN["CDN Resources<br/>(Libraries)"]
    end
    
    UI --> JS
    JS --> TM
    JS --> TRD
    TM --> PY
    PY --> ML
    PY --> PD
    TRD --> TR
    TM --> API
    UI --> CDN
    UT --> JS
    SC --> TM
    SC --> TRD
    
    CSV["CSV Data<br/>(User Upload)"] --> JS
    JS --> CSV
    
    TM --> TRD
```

### Application Flow
1. User uploads CSV data through the interface
2. Data is processed in-browser using Pyodide and pandas
3. Tree Manager builds the decision tree using scikit-learn
4. Tree Renderer visualizes the tree using custom Bootstrap components
5. User interacts with the tree via UI or chat interface
6. AI assistance provided through LLM API calls
7. Tree updates are processed and reflected in real-time

### Dependencies

- **Frontend**
  - Bootstrap 5.3.0 (UI components and styling)
  - Bootstrap Icons
  
- **Machine Learning**
  - Pyodide v0.24.1 (Python in browser)
  - scikit-learn (Decision tree algorithms)
  - pandas (Data processing)

## API Configuration

To use the AI features, ensure you are logged into [LLM Foundry](https://llmfoundry.straive.com/) in your browser. The application will use your existing session to authenticate with the API service at `https://llmfoundry.straive.com/openai/v1/chat/completions`.

The LLM API endpoint and model name are defined as constants (`LLM_API_ENDPOINT` and `LLM_MODEL_NAME`) at the top of the `treeManager.js` file. You can modify these constants if you need to use a different API endpoint or language model.

## Roadmap

- [ ] Export functionality for trees and derived data
- [ ] Performance optimizations for large datasets

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 