"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { Composer } from "./composer";
import { useSessionTree, useSendMessage } from "@/hooks/use-sessions";
import { useUIStore } from "@/lib/ui-store";
import {
  siblingsOf,
  pathToLeaf,
  subtreeLeaf,
  defaultLeaf,
} from "@/lib/tree-utils";
import type { MessageNode } from "@/lib/types";

interface ChatThreadProps {
  sessionId: string;
}

export function ChatThread({ sessionId }: ChatThreadProps) {
  const { data: tree, isLoading } = useSessionTree(sessionId);
  const send = useSendMessage(sessionId);
  const activeLeaves = useUIStore((s) => s.activeLeaves);
  const setActiveLeaf = useUIStore((s) => s.setActiveLeaf);

  // optimistic pending state during a send/edit/regenerate
  const [pending, setPending] = useState<{
    userContent: string | null;
    assistant: boolean;
  }>({ userContent: null, assistant: false });

  const bottomRef = useRef<HTMLDivElement>(null);

  const nodes = tree?.messages ?? [];

  // active leaf for this session (fallback to computed default)
  const activeLeafId =
    activeLeaves[sessionId] ?? tree?.activeLeafId ?? defaultLeaf(nodes);

  // keep activeLeafId valid once tree loads
  useEffect(() => {
    if (tree && !activeLeaves[sessionId] && tree.activeLeafId) {
      setActiveLeaf(sessionId, tree.activeLeafId);
    }
  }, [tree, sessionId, activeLeaves, setActiveLeaf]);

  const visiblePath = useMemo<MessageNode[]>(() => {
    if (!activeLeafId || nodes.length === 0) return [];
    return pathToLeaf(nodes, activeLeafId);
  }, [nodes, activeLeafId]);

  // auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visiblePath.length, pending.userContent, pending.assistant]);

  const handleSend = (content: string) => {
    setPending({ userContent: content, assistant: true });
    send.mutate(
      { sessionId, content },
      {
        onSettled: () => setPending({ userContent: null, assistant: false }),
      },
    );
  };

  const handleEdit = (messageId: string, newContent: string) => {
    setPending({ userContent: newContent, assistant: true });
    send.mutate(
      { sessionId, content: newContent, editedMessageId: messageId },
      {
        onSettled: () => setPending({ userContent: null, assistant: false }),
      },
    );
  };

  const handleRegenerate = (assistantMessageId: string) => {
    setPending({ userContent: null, assistant: true });
    send.mutate(
      { sessionId, content: "", regenerateAssistantId: assistantMessageId },
      {
        onSettled: () => setPending({ userContent: null, assistant: false }),
      },
    );
  };

  const switchBranch = (fromMessageId: string, direction: -1 | 1) => {
    const sibs = siblingsOf(nodes, fromMessageId);
    const idx = sibs.findIndex((s) => s.id === fromMessageId);
    if (idx === -1) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= sibs.length) return;
    const nextLeaf = subtreeLeaf(nodes, sibs[nextIdx].id);
    setActiveLeaf(sessionId, nextLeaf);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Sparkles className="h-5 w-5 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (nodes.length === 0 && !pending.assistant) {
    return (
      <div className="flex flex-1 flex-col">
        <EmptyThread />
        <div className="border-t border-border/60 p-3 sm:p-4">
          <Composer onSend={handleSend} disabled={send.isPending} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {visiblePath.map((node, i) => {
            const sibs = siblingsOf(nodes, node.id);
            const idx = sibs.findIndex((s) => s.id === node.id);
            const isLast = i === visiblePath.length - 1;
            return (
              <MessageBubble
                key={node.id}
                node={node}
                siblingIndex={idx === -1 ? 0 : idx}
                siblingTotal={sibs.length}
                isLastOnPath={isLast}
                onPrevBranch={() => switchBranch(node.id, -1)}
                onNextBranch={() => switchBranch(node.id, 1)}
                onRegenerate={
                  isLast ? () => handleRegenerate(node.id) : undefined
                }
                onEdit={
                  node.role === "user"
                    ? (c) => handleEdit(node.id, c)
                    : undefined
                }
                sending={send.isPending}
              />
            );
          })}

          {/* optimistic pending bubbles */}
          {pending.userContent && (
            <MessageBubble
              node={{
                id: "__pending_user__",
                sessionId,
                role: "user",
                content: pending.userContent,
                parentMessageId: null,
                childrenMessageIds: [],
                siblingIndex: 0,
                model: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }}
              siblingIndex={0}
              siblingTotal={1}
              isLastOnPath={false}
              onPrevBranch={() => {}}
              onNextBranch={() => {}}
            />
          )}
          {pending.assistant && (
            <MessageBubble
              node={{
                id: "__pending_assistant__",
                sessionId,
                role: "assistant",
                content: "",
                parentMessageId: null,
                childrenMessageIds: [],
                siblingIndex: 0,
                model: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }}
              siblingIndex={0}
              siblingTotal={1}
              isLastOnPath
              onPrevBranch={() => {}}
              onNextBranch={() => {}}
              isTyping
            />
          )}
          <div ref={bottomRef} className="h-1" />
        </div>
      </div>

      <div className="border-t border-border/60 p-3 sm:p-4">
        <div className="mx-auto max-w-3xl">
          <Composer onSend={handleSend} disabled={send.isPending} />
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            Shegaai can make mistakes. Branch with edit / regenerate to explore
            answers.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyThread() {
  const suggestions = [
    "Explain branching chat threads like I’m five",
    "Draft a polite follow-up email to a recruiter",
    "Give me 3 resume bullet points for a backend engineer",
    "Summarize the pros and cons of SQLite vs Postgres",
  ];
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <Sparkles className="h-7 w-7" />
      </div>
      <h2 className="text-xl font-semibold">How can I help you today?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Start a conversation. Edit a prompt or regenerate a reply to branch the
        thread.
      </p>
      <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <div
            key={s}
            className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
