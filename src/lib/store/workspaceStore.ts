import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "./authStore";

export interface WorkspaceFile {
  id: string;
  name: string;
  type: "pdf" | "docx" | "xlsx" | "pptx" | "txt" | "md" | "website" | "presentation" | "report";
  size?: string;
  folderId?: string | null;
  createdAt: string;
  content?: string; // extracted text content / source code / slide layouts
}

export interface Folder {
  id: string;
  name: string;
  workspaceId: string;
  parentId?: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: "personal" | "team";
  ownerId: string;
  members: string[]; // user IDs
  createdAt: string;
}

interface WorkspaceState {
  workspaces: Workspace[];
  folders: Folder[];
  files: WorkspaceFile[];
  activeWorkspaceId: string;
  activeFolderId: string | null;
  
  // Actions
  setActiveWorkspace: (id: string) => void;
  setActiveFolder: (id: string | null) => void;
  createWorkspace: (name: string, type: "personal" | "team") => void;
  deleteWorkspace: (id: string) => void;
  createFolder: (name: string) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  addFileToWorkspace: (file: Omit<WorkspaceFile, "id" | "createdAt">) => WorkspaceFile;
  deleteFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  initializeForUser: (userId: string) => void;
  resetStore: () => void;
}

const defaultWorkspaces: Workspace[] = [];
const defaultFolders: Folder[] = [];
const defaultFiles: WorkspaceFile[] = [];

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: defaultWorkspaces,
      folders: defaultFolders,
      files: defaultFiles,
      activeWorkspaceId: "personal-ws",
      activeFolderId: null,

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id, activeFolderId: null }),
      
      setActiveFolder: (id) => set({ activeFolderId: id }),

      createWorkspace: (name, type) => {
        const userId = useAuthStore.getState().user?.id || "guest";
        const newWs: Workspace = {
          id: `ws-${Math.random().toString(36).substr(2, 9)}`,
          name,
          type,
          ownerId: userId,
          members: [userId],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          workspaces: [...state.workspaces, newWs],
          activeWorkspaceId: newWs.id,
          activeFolderId: null,
        }));
      },

      deleteWorkspace: (id) => {
        // Prevent deleting last workspace
        const workspaces = get().workspaces;
        if (workspaces.length <= 1) return;
        
        set((state) => {
          const filtered = state.workspaces.filter((w) => w.id !== id);
          const activeId = state.activeWorkspaceId === id ? filtered[0].id : state.activeWorkspaceId;
          return {
            workspaces: filtered,
            activeWorkspaceId: activeId,
            activeFolderId: null,
          };
        });
      },

      createFolder: (name) => {
        const newFolder: Folder = {
          id: `folder-${Math.random().toString(36).substr(2, 9)}`,
          name,
          workspaceId: get().activeWorkspaceId,
          parentId: get().activeFolderId,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          folders: [...state.folders, newFolder],
          activeFolderId: newFolder.id,
        }));
      },

      renameFolder: (id, name) => {
        set((state) => ({
          folders: state.folders.map((f) => (f.id === id ? { ...f, name } : f)),
        }));
      },

      deleteFolder: (id) => {
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
          files: state.files.map((f) => (f.folderId === id ? { ...f, folderId: null } : f)),
          activeFolderId: state.activeFolderId === id ? null : state.activeFolderId,
        }));
      },

      addFileToWorkspace: (fileData) => {
        const newFile: WorkspaceFile = {
          ...fileData,
          id: `file-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          files: [...state.files, newFile],
        }));
        return newFile;
      },

      deleteFile: (id) => {
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
        }));
      },

      updateFileContent: (id, content) => {
        set((state) => ({
          files: state.files.map((f) => (f.id === id ? { ...f, content } : f)),
        }));
      },

      initializeForUser: (userId) => {
        const personalWsId = `ws-${Math.random().toString(36).substring(2, 11)}`;
        const welcomeFileId = `file-${Math.random().toString(36).substring(2, 11)}`;
        set({
          workspaces: [
            {
              id: personalWsId,
              name: "Personal Workspace",
              type: "personal",
              ownerId: userId,
              members: [userId],
              createdAt: new Date().toISOString(),
            }
          ],
          folders: [],
          files: [
            {
              id: welcomeFileId,
              name: "Welcome_to_Neuroflow.md",
              type: "md",
              size: "1 KB",
              folderId: null,
              createdAt: new Date().toISOString(),
              content: `# Welcome to Neuroflow AI!\n\nThis is your private workspace. You can start creating web projects, presentations, and documents using the quick actions below.`
            }
          ],
          activeWorkspaceId: personalWsId,
          activeFolderId: null,
        });
      },

      resetStore: () => {
        set({
          workspaces: [],
          folders: [],
          files: [],
          activeWorkspaceId: "",
          activeFolderId: null,
        });
      },
    }),
    {
      name: "neuroflow-workspace-storage",
    }
  )
);

// Auto-sync workspace files to server database on state changes
useWorkspaceStore.subscribe((state) => {
  const user = useAuthStore.getState().user;
  if (user && user.id) {
    fetch("/api/workspace/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaces: state.workspaces,
        folders: state.folders,
        files: state.files,
        activeWorkspaceId: state.activeWorkspaceId
      })
    }).catch(err => console.error("Workspace sync failed:", err));
  }
});
