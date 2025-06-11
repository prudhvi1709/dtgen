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
