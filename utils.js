export const toggleSpinner = (spinnerId, show) => {
    const spinner = document.getElementById(spinnerId);
    if (spinner) spinner.classList.toggle('d-none', !show);
};

export const addToChatHistory = (sender, message) => {
    const chatHistory = document.getElementById('chatHistory');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'mb-2';
    messageDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
};

export const getTreeDepth = node => !node.children?.length ? 1 : 1 + Math.max(...node.children.map(getTreeDepth));

export const countLeafNodes = node => !node.children?.length ? 1 : node.children.map(countLeafNodes).reduce((a, b) => a + b, 0);

export const parseTreeStructure = treeText => {
    const lines = treeText.split('\n').filter(line => line.trim());
    const root = { name: 'Root', children: [] };
    const stack = [root];

    lines.forEach(line => {
        const depth = (line.match(/^\s*\|/g) || []).length;
        const content = line.replace(/^\s*\|+\s*/, '').trim();
        if (!content) return;

        const node = { name: content, children: [] };
        while (stack.length > depth + 1) stack.pop();
        stack[stack.length - 1].children.push(node);
        stack.push(node);
    });

    return root;
}; 