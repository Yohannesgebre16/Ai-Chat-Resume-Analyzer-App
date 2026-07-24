"use client";

import { useState } from "react";
import {
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Check,
  X,
  Sun,
  Moon,
  LogOut,
  FileText,
  Sparkles,
  PanelLeftClose,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { useUIStore } from "@/lib/ui-store";
import {
  useSessions,
  useCreateSession,
  useDeleteSession,
  useRenameSession,
} from "@/hooks/use-sessions";
import type { ChatSessionSummary } from "@/lib/types";

function groupByDate(sessions: ChatSessionSummary[]) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const groups: { label: string; items: ChatSessionSummary[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 Days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const s of sessions) {
    const t = new Date(s.updatedAt).getTime();
    if (t >= startOfToday) groups[0].items.push(s);
    else if (t >= startOfYesterday) groups[1].items.push(s);
    else if (t >= startOf7Days) groups[2].items.push(s);
    else groups[3].items.push(s);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function ChatSidebar() {
  const { data: sessions, isLoading } = useSessions();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const renameSession = useRenameSession();

  const activeSessionId = useUIStore((s) => s.activeSessionId);
  const setActiveSession = useUIStore((s) => s.setActiveSession);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);

  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const groups = groupByDate(sessions ?? []);

  const handleNew = () => {
    createSession.mutate(undefined, {
      onSuccess: (s) => {
        setActiveSession(s.id);
        setTab("chat");
      },
    });
  };

  const startRename = (s: ChatSessionSummary) => {
    setEditingId(s.id);
    setDraft(s.title);
  };
  const commitRename = (id: string) => {
    const t = draft.trim();
    if (t) renameSession.mutate({ id, title: t });
    setEditingId(null);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete === activeSessionId) setActiveSession(null);
    deleteSession.mutate(confirmDelete);
    setConfirmDelete(null);
  };

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      {/* brand + collapse */}
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">Shegaai Chat</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* tabs */}
      <div className="px-3 pb-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs">
          <button
            onClick={() => setTab("chat")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors",
              tab === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Chat
          </button>
          <button
            onClick={() => setTab("resume")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors",
              tab === "resume"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            <FileText className="h-3.5 w-3.5" /> Resume
          </button>
        </div>
      </div>

      {/* new chat */}
      <div className="px-3 pb-2">
        <Button
          onClick={handleNew}
          disabled={createSession.isPending}
          className="w-full justify-start gap-2"
          variant={tab === "chat" && activeSessionId ? "outline" : "default"}
        >
          <Plus className="h-4 w-4" /> New chat
        </Button>
      </div>

      {/* sessions list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
        {isLoading ? (
          <div className="space-y-2 px-1 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            No conversations yet.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {g.label}
              </p>
              <div className="space-y-0.5">
                {g.items.map((s) => {
                  const active = s.id === activeSessionId && tab === "chat";
                  const isEditing = editingId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/60",
                      )}
                    >
                      {isEditing ? (
                        <div className="flex w-full items-center gap-1">
                          <Input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(s.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                            className="h-7 text-xs"
                          />
                          <button
                            onClick={() => commitRename(s.id)}
                            className="rounded p-1 hover:bg-muted"
                            aria-label="Save"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded p-1 hover:bg-muted"
                            aria-label="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setActiveSession(s.id);
                              setTab("chat");
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                            <span className="truncate">{s.title}</span>
                          </button>
                          <div className="flex flex-shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => startRename(s)}
                              className="rounded p-1 hover:bg-muted"
                              aria-label="Rename"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(s.id)}
                              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* footer: theme + user */}
      <div className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 text-xs"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 justify-start gap-2 text-xs"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {(user?.name || "U").slice(0, 1).toUpperCase()}
                </div>
                <span className="truncate">{user?.name || "User"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="truncate">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the thread and all of its branched
              messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
