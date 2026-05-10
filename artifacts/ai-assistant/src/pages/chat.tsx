import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Mic, Send, MoreVertical, Trash2, FileUp, Image as ImageIcon, Video, Camera } from "lucide-react";
import { useListOpenaiConversations, useCreateOpenaiConversation, useDeleteOpenaiConversation, useListOpenaiMessages, getListOpenaiConversationsQueryKey, getListOpenaiMessagesQueryKey } from "@workspace/api-client-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

function SimpleMarkdown({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```|\*\*[\s\S]*?\*\*|\*[\s\S]*?\*|`[\s\S]*?`)/g);
  return (
    <div className="space-y-2 whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          return <pre key={i} className="bg-zinc-900 text-zinc-100 p-4 rounded-md overflow-x-auto text-sm font-mono my-2 border border-zinc-800">{part.slice(3, -3)}</pre>;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

export default function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  
  const queryClient = useQueryClient();
  const { data: conversations = [] } = useListOpenaiConversations();
  const { data: messages = [] } = useListOpenaiMessages(activeConversationId || 0, { query: { enabled: !!activeConversationId } });
  const createConversation = useCreateOpenaiConversation();
  const deleteConversation = useDeleteOpenaiConversation();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedContent]);

  const handleNewConversation = () => {
    createConversation.mutate({ data: { title: "New Conversation" } }, {
      onSuccess: (newConv) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setActiveConversationId(newConv.id);
      }
    });
  };

  const handleDeleteConversation = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        if (activeConversationId === id) setActiveConversationId(null);
      }
    });
  };

  const handleSend = async () => {
    if (!input.trim() || !activeConversationId) return;

    const userMessage = input;
    setInput("");
    setIsStreaming(true);
    setStreamedContent("");

    // Optimistic update for user message
    queryClient.setQueryData(getListOpenaiMessagesQueryKey(activeConversationId), (old: any) => [
      ...(old || []),
      { id: Date.now(), conversationId: activeConversationId, role: "user", content: userMessage, createdAt: new Date().toISOString() }
    ]);

    try {
      const response = await fetch(`/api/openai/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMessage })
      });

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(activeConversationId) });
              setIsStreaming(false);
            } else if (data.content) {
              assistantText += data.content;
              setStreamedContent(assistantText);
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      {/* Sidebar for conversations */}
      <div className="hidden lg:flex w-64 flex-col border-r border-border bg-sidebar/50 backdrop-blur-xl shrink-0 p-4 gap-4">
        <Button onClick={handleNewConversation} className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border-none shadow-none">
          <Plus className="w-4 h-4" /> New Conversation
        </Button>
        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-1">
            {conversations.map(conv => (
              <div 
                key={conv.id} 
                onClick={() => setActiveConversationId(conv.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-all ${activeConversationId === conv.id ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}`}
              >
                <span className="truncate pr-2">{conv.title || "Conversation"}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0" onClick={(e) => handleDeleteConversation(conv.id, e)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center justify-end px-4 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 text-pink-500 border border-pink-500/20">
            <Mic className="w-5 h-5" />
          </Button>
        </div>

        {/* Chat Thread */}
        <ScrollArea className="flex-1 px-4 py-6 md:px-8 lg:px-12">
          <div className="max-w-4xl mx-auto space-y-8 pb-32">
            {!activeConversationId && (
              <div className="text-center text-muted-foreground py-20">Select or create a conversation to start.</div>
            )}
            
            {messages.map((msg: any) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-foreground border border-border/50'}`}>
                  {msg.role === 'user' ? msg.content : <SimpleMarkdown content={msg.content} />}
                </div>
              </motion.div>
            ))}
            
            {isStreaming && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-5 py-3.5 bg-muted/50 text-foreground border border-border/50">
                  <SimpleMarkdown content={streamedContent} />
                  <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 align-middle" />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent">
          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-pink-500/30 rounded-3xl blur opacity-30 group-focus-within:opacity-100 transition duration-500"></div>
              <div className="relative bg-card border border-border/50 shadow-2xl rounded-3xl flex items-end p-2 min-h-[80px]">
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0 rounded-full w-10 h-10 mb-1 ml-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <Plus className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 p-2 rounded-xl">
                    <DropdownMenuItem className="gap-3 py-3 rounded-lg"><FileUp className="w-4 h-4"/> Upload Document</DropdownMenuItem>
                    <DropdownMenuItem className="gap-3 py-3 rounded-lg"><ImageIcon className="w-4 h-4"/> Upload Image</DropdownMenuItem>
                    <DropdownMenuItem className="gap-3 py-3 rounded-lg"><Video className="w-4 h-4"/> Upload Video</DropdownMenuItem>
                    <DropdownMenuItem className="gap-3 py-3 rounded-lg"><Camera className="w-4 h-4"/> Open Camera</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <textarea 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ask anything..."
                  className="flex-1 bg-transparent border-0 focus:ring-0 resize-none py-3 px-4 max-h-[200px] min-h-[60px] text-base placeholder:text-muted-foreground/60 outline-none"
                  disabled={!activeConversationId || isStreaming}
                />

                <Button 
                  onClick={handleSend}
                  disabled={!input.trim() || !activeConversationId || isStreaming}
                  className="shrink-0 rounded-full w-10 h-10 mb-1 mr-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-transform active:scale-95"
                  size="icon"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </Button>
              </div>
            </div>
            <div className="text-center mt-3 text-xs text-muted-foreground/50 font-medium">
              NovaMind AI can make mistakes. Verify important information.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
