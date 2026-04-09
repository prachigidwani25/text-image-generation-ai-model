const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('userInput') || document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const modeToggle = document.getElementById('mode-toggle');
const chatLabel = document.getElementById('chat-label');
const artLabel = document.getElementById('art-label');

const HF_TOKEN = import.meta.env.VITE_HF_TOKEN;

// Application State
let messages = [];
let isArtMode = false;
let isGenerating = false;

// Mode Toggle Let
modeToggle.addEventListener('change', (e) => {
  isArtMode = e.target.checked;
  if (isArtMode) {
    artLabel.classList.add('active');
    chatLabel.classList.remove('active');
    userInput.placeholder = "Describe an image to generate...";
    addSystemMessage("Switched to Art Mode. Describe the image you want to create.");
  } else {
    chatLabel.classList.add('active');
    artLabel.classList.remove('active');
    userInput.placeholder = "Type a message...";
    addSystemMessage("Switched to Chat Mode. How can I help you?");
  }
});

function addSystemMessage(text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ai-message';
  msgDiv.innerHTML = `<div class="message-content" style="background: rgba(255,255,255,0.05); font-style: italic;">${text}</div>`;
  chatMessages.appendChild(msgDiv);
  scrollToBottom();
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isGenerating) return;

  const text = userInput.value.trim();
  if (!text) return;

  // Add User Message
  addUserMessage(text);
  userInput.value = '';
  
  setGeneratingStatus(true);
  
  try {
    if (isArtMode) {
      await generateImage(text);
    } else {
      await generateText(text);
    }
  } catch (error) {
    console.error(error);
    addErrorMessage(error.message);
  } finally {
    setGeneratingStatus(false);
  }
});

function addUserMessage(text) {
  messages.push({ role: "user", content: text });
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message user-message';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = text;
  
  msgDiv.appendChild(contentDiv);
  chatMessages.appendChild(msgDiv);
  scrollToBottom();
}

function addAiMessage(text) {
  messages.push({ role: "assistant", content: text });
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ai-message';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = text;
  
  msgDiv.appendChild(contentDiv);
  chatMessages.appendChild(msgDiv);
  scrollToBottom();
}

function addImageMessage(url, prompt) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ai-message';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = `<div>Generated: <i>${prompt}</i></div>`;
  
  const img = document.createElement('img');
  img.src = url;
  img.className = 'message-image';
  
  contentDiv.appendChild(img);
  msgDiv.appendChild(contentDiv);
  chatMessages.appendChild(msgDiv);
  scrollToBottom();
}

function addErrorMessage(errorText) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'error-message message ai-message';
  msgDiv.innerHTML = `<div class="message-content" style="border-color: var(--error-color)">Error: ${errorText}</div>`;
  chatMessages.appendChild(msgDiv);
  scrollToBottom();
}

const indicatorId = 'loading-indicator';

function setGeneratingStatus(status) {
  isGenerating = status;
  sendButton.disabled = status;
  
  if (status) {
    const indicator = document.createElement('div');
    indicator.id = indicatorId;
    indicator.className = 'indicator message ai-message';
    
    if (isArtMode) {
      indicator.innerHTML = `<div class="spinner"></div> Generating image...`;
    } else {
      indicator.innerHTML = `Typing <div class="dots"><span></span><span></span><span></span></div>`;
    }
    chatMessages.appendChild(indicator);
    scrollToBottom();
  } else {
    const el = document.getElementById(indicatorId);
    if (el) el.remove();
  }
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Model Integrations

// 1. Text Generation with Qwen 2.5 7B
async function generateText(prompt) {
  // Since we pass all messages to conversation history, limit it to last 6 for speed
  const history = messages.slice(-6);
  
  const response = await fetch(
    "https://router.huggingface.co/v1/chat/completions",
    {
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        messages: history,
        model: "Qwen/Qwen2.5-7B-Instruct:together",
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP Error ${response.status}`);
  }

  const result = await response.json();
  if (result.choices && result.choices.length > 0) {
    const replyText = result.choices[0].message.content;
    addAiMessage(replyText);
  } else {
    throw new Error("No response generated.");
  }
}

// 2. Image Generation with FLUX.1
async function generateImage(prompt) {
  const response = await fetch(
    "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
    {
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({ inputs: prompt }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // Model might be loading, or token error
    if (errorData.error && errorData.error.includes("loading")) {
      const waitTime = errorData.estimated_time || 10;
      throw new Error(`Model is loading. Please try again in about ${Math.ceil(waitTime)} seconds.`);
    }
    throw new Error(errorData.error || `HTTP Error ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  addImageMessage(url, prompt);
}

// Initialization
chatLabel.classList.add('active');
