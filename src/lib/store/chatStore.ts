import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useWorkspaceStore } from "./workspaceStore";
import { useAuthStore } from "./authStore";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: { title: string; url: string; snippet?: string }[];
  attachments?: { id: string; name: string; type: string }[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  workspaceId: string;
  folderId: string | null;
  modelName: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>; // Key: conversationId
  activeConversationId: string | null;
  selectedModel: string;
  tokenContextSize: number; // custom token memory limit (sliding window)
  isStreaming: boolean;
  
  // Actions
  setSelectedModel: (model: string) => void;
  setTokenContextSize: (size: number) => void;
  setActiveConversation: (id: string | null) => void;
  createConversation: (folderId?: string | null) => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  togglePinConversation: (id: string) => void;
  addMessage: (conversationId: string, role: "user" | "assistant" | "system", content: string, sources?: Message["sources"], attachments?: Message["attachments"]) => Message;
  clearConversation: (id: string) => void;
  simulateStreamingResponse: (conversationId: string, userPrompt: string, customSystemPrompt?: string, filesContext?: string) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      activeConversationId: null,
      selectedModel: "gemini-2.5-flash",
      tokenContextSize: 4096,
      isStreaming: false,

      setSelectedModel: (model) => set({ selectedModel: model }),
      
      setTokenContextSize: (size) => set({ tokenContextSize: size }),
      
      setActiveConversation: (id) => set({ activeConversationId: id }),

      createConversation: (folderId = null) => {
        const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
        const newConv: Conversation = {
          id: `chat-${Math.random().toString(36).substr(2, 9)}`,
          title: "New Chat",
          workspaceId,
          folderId,
          modelName: get().selectedModel,
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          conversations: [newConv, ...state.conversations],
          activeConversationId: newConv.id,
          messages: {
            ...state.messages,
            [newConv.id]: [],
          },
        }));

        return newConv.id;
      },

      deleteConversation: (id) => {
        set((state) => {
          const filtered = state.conversations.filter((c) => c.id !== id);
          const activeId = state.activeConversationId === id ? (filtered[0]?.id || null) : state.activeConversationId;
          const updatedMessages = { ...state.messages };
          delete updatedMessages[id];
          return {
            conversations: filtered,
            activeConversationId: activeId,
            messages: updatedMessages,
          };
        });
      },

      renameConversation: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) => (c.id === id ? { ...c, title, updatedAt: new Date().toISOString() } : c)),
        }));
      },

      togglePinConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c)),
        }));
      },

      addMessage: (conversationId, role, content, sources, attachments) => {
        const newMessage: Message = {
          id: `msg-${Math.random().toString(36).substr(2, 9)}`,
          role,
          content,
          sources,
          attachments,
          createdAt: new Date().toISOString(),
        };

        set((state) => {
          const convMsgs = state.messages[conversationId] || [];
          return {
            messages: {
              ...state.messages,
              [conversationId]: [...convMsgs, newMessage],
            },
            conversations: state.conversations.map((c) =>
              c.id === conversationId ? { ...c, updatedAt: new Date().toISOString() } : c
            ),
          };
        });

        return newMessage;
      },

      clearConversation: (id) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [id]: [],
          },
        }));
      },

      simulateStreamingResponse: async (conversationId, userPrompt, customSystemPrompt = "", filesContext = "") => {
        set({ isStreaming: true });
        
        // Add user message
        // Determine attachments from active file selection (handled by caller, but we just save it)
        const chatMessages = get().messages[conversationId] || [];
        
        // Auto rename conversation if it's the first prompt
        if (chatMessages.length === 1 && get().conversations.find(c => c.id === conversationId)?.title === "New Chat") {
          const title = userPrompt.length > 25 ? userPrompt.substring(0, 25) + "..." : userPrompt;
          get().renameConversation(conversationId, title);
        }

        // Initialize empty assistant message for streaming
        const assistantMsgId = `msg-${Math.random().toString(36).substr(2, 9)}`;
        const initialAssistantMsg: Message = {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: [...(state.messages[conversationId] || []), initialAssistantMsg],
          },
        }));

        const modelName = get().selectedModel;
        let responseTemplate = "";

        try {
          const activeMessages = (get().messages[conversationId] || [])
            .filter((message) => message.role !== "system")
            .slice(-10)
            .map((message) => ({ role: message.role, content: message.content }));

          const response = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelName,
              messages: [
                ...(customSystemPrompt ? [{ role: "system", content: customSystemPrompt }] : []),
                ...activeMessages,
              ],
              filesContext,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (typeof data.content === "string" && data.content.trim()) {
              responseTemplate = data.content;
            }
          }
        } catch {
          // Keep the local fallback below available for offline development.
        }

        if (!responseTemplate) {
          responseTemplate = `I'm responding as **NeuroFlow AI** using local demo mode. Add an API key in **.env.local** to enable live model responses.

Here is what you requested:
`;

          if (userPrompt.toLowerCase().includes("code") || userPrompt.toLowerCase().includes("javascript") || userPrompt.toLowerCase().includes("python")) {
            responseTemplate += `\nHere is a code implementation snippet that solves your request:

\`\`\`typescript
interface UserProfile {
  id: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: Date;
}

export function formatUserProfile(user: UserProfile): string {
  return \`[\${user.role.toUpperCase()}] \${user.name} (ID: \${user.id})\`;
}

// Example usage
const user: UserProfile = {
  id: 'usr_flow_99',
  name: '${useAuthStore.getState().user?.fullName || "Alex Rivera"}',
  role: 'admin',
  createdAt: new Date()
};

console.log(formatUserProfile(user));
\`\`\`

Let me know if you would like me to adjust this or integrate it into a database model!`;
          } else if (userPrompt.toLowerCase().includes("website") || userPrompt.toLowerCase().includes("html") || userPrompt.toLowerCase().includes("landing")) {
            responseTemplate += `\nI can write a fully working landing page react component for you. Here is the structure:

\`\`\`jsx
import React from 'react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      <header className="px-6 py-4 flex justify-between items-center border-b border-slate-800">
        <span className="font-bold text-xl text-purple-400">FlowLanding</span>
        <button className="bg-purple-600 px-4 py-1.5 rounded text-sm">Get Started</button>
      </header>
      <main className="max-w-4xl mx-auto py-20 text-center flex flex-col items-center gap-6">
        <h1 className="text-5xl font-extrabold">Instant SaaS Templates</h1>
        <p className="text-slate-400 max-w-md">Generated dynamically using modern Next.js structures.</p>
      </main>
    </div>
  );
}
\`\`\`

You can export this code or copy it directly!`;
          } else if (filesContext) {
            responseTemplate += `\nBased on the uploaded document text context you attached:
> "${filesContext.substring(0, 150)}..."

I have analyzed the content. It contains references to professional credentials, project portfolios, and development capabilities. How can I assist you with analyzing this file further?`;
          } else {
            responseTemplate += `\n* NeuroFlow Workspace provides a fast sandbox to test ideas.
* Your current token memory buffer is set to **${get().tokenContextSize} tokens**.
* This model supports streaming directly to your client workspace.

How else can I assist you in your workspace folders today? You can write Python utilities, design slide outlines, or perform Perplexity-like research logs.`;
          }
        }

        // Simulate token streaming interval
        const chunks = responseTemplate.split(" ");
        let currentText = "";
        
        for (let i = 0; i < chunks.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 40 + 20));
          currentText += chunks[i] + " ";
          
          set((state) => {
            const currentMsgs = state.messages[conversationId] || [];
            return {
              messages: {
                ...state.messages,
                [conversationId]: currentMsgs.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: currentText.trim() } : m
                ),
              },
            };
          });
        }

        set({ isStreaming: false });
      },
    }),
    {
      name: "neuroflow-chat-storage",
    }
  )
);
