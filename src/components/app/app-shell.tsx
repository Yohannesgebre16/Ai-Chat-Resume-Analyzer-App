"use client";

import { useEffect, useState } from "react";
import { PanelLeft, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChatSidebar } from "./chat-sidebar";
import { ChatThread } from "./chat-thread";
import { ResumePanel } from "./resume-panel";
import { useUIStore } from "@/lib/ui-store";
import { useSessions, useCreateSession } from "@/hooks/use-sessions";

const LG = 1024;

export function AppShell() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  const activeSessionId = useUIStore((s) => s.activeSessionId);
  const setActiveSession = useUIStore((s) => s.setActiveSession);

  const { data: sessions } = useSessions();
  const createSession = useCreateSession();

  const [isLg, setIsLg] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${LG}px)`);
    const handler = () => {
      const lg = mq.matches;
      setIsLg(lg);
      setSidebarOpen(lg);
      if (lg) setMobileNavOpen(false);
    };
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [setSidebarOpen, setMobileNavOpen]);

  const activeSession = sessions?.find((s) => s.id === activeSessionId);
  const showChat = tab === "chat" && activeSessionId;
  const showResume = tab === "resume";

  const handleNew = () => {
    createSession.mutate(undefined, {
      onSuccess: (s) => {
        setActiveSession(s.id);
        setTab("chat");
      },
    });
  };

  const onToggleNav = () => {
    if (isLg) toggleSidebar();
    else setMobileNavOpen(true);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* desktop sidebar */}
      <div
        className={
          "hidden lg:flex flex-shrink-0 overflow-hidden border-r border-border/60 transition-[width] duration-200 " +
          (sidebarOpen ? "w-72" : "w-0")
        }
      >
        {sidebarOpen && <ChatSidebar />}
      </div>

      {/* mobile sidebar (sheet) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          <ChatSidebar />
        </SheetContent>
      </Sheet>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-border/60 px-2 sm:px-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleNav}
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            {tab === "chat" && activeSession ? (
              <>
                <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">
                  {activeSession.title}
                </span>
              </>
            ) : tab === "resume" ? (
              <span className="text-sm font-medium">Resume Analyzer</span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-emerald-500" /> Shega ai
              </span>
            )}
          </div>
        </header>

        {/* content */}
        <main className="flex min-h-0 flex-1 flex-col">
          {showChat && activeSessionId ? (
            <ChatThread sessionId={activeSessionId} />
          ) : showResume ? (
            <ResumePanel />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-semibold">
                Start a new conversation
              </h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create a chat to ask anything. Edit prompts or regenerate
                replies to branch the thread and explore different answers.
              </p>
              <Button
                className="mt-5"
                onClick={handleNew}
                disabled={createSession.isPending}
              >
                New chat
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
