import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Mic, MicOff, Send, Trash2, FileUp, Image as ImageIcon,
  Camera, Download, Copy, Check, Loader2, Music, Code2, Youtube, FileText,
} from "lucide-react";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey,
} from "@workspace/api-client-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

interface ToolResult {
  tool: string;
  data: any;
}

interface DisplayMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  toolResult?: ToolResult;
}

class PCMAudioPlayer {
  private ctx: AudioContext;
  private nextStart = 0;

  constructor() {
    this.ctx = new AudioContext({ sampleRate: 24000 });
  }

  async scheduleChunk(b64: string) {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
    const buf = this.ctx.createBuffer(1, float32.length, 24000);
    buf.copyToChannel(float32, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const when = Math.max(this.ctx.currentTime + 0.02, this.nextStart);
    src.start(when);
    this.nextStart = when + buf.duration;
  }

  close() {
    this.ctx.close().catch(() => {});
  }
}

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <CodeBlock key={i} code={codeLines.join("\n")} language={lang} />
      );
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="font-bold text-base mt-3 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="font-bold text-xl mt-4 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(<li key={i} className="ml-4 list-disc">{renderInline(line.slice(2))}</li>);
    } else if (/^\d+\. /.test(line)) {
      elements.push(<li key={i} className="ml-4 list-decimal">{renderInline(line.replace(/^\d+\. /, ""))}</li>);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }

  return <div className="space-y-1 text-sm">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="bg-zinc-800 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    return <span key={i}>{part}</span>;
  });
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-2 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 text-xs text-zinc-400">
        <span className="font-mono">{language || "code"}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-white transition-colors">
          {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
        </button>
      </div>
      <pre className="p-4 text-xs text-zinc-200 font-mono overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

function ToolResultCard({ toolResult }: { toolResult: ToolResult }) {
  const [copied, setCopied] = useState(false);
  const { tool, data } = toolResult;

  if (tool === "generate_image" && data?.b64_json) {
    const src = `data:image/png;base64,${data.b64_json}`;
    return (
      <div className="mt-3 rounded-2xl overflow-hidden border border-border max-w-md">
        <img src={src} alt={data.prompt} className="w-full object-contain" />
        <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-t border-border">
          <span className="text-xs text-muted-foreground truncate">{data.style} · {data.prompt?.slice(0, 40)}…</span>
          <a href={src} download="novamind-image.png">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
              <Download className="w-3 h-3" /> Save
            </Button>
          </a>
        </div>
      </div>
    );
  }

  if (tool === "generate_code" && data?.result) {
    return (
      <div className="mt-3 max-w-full">
        <div className="flex items-center gap-2 mb-2">
          <Code2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary">{data.language} · {data.mode}</span>
        </div>
        <CodeBlock code={data.result} language={data.language} />
      </div>
    );
  }

  if (tool === "generate_song" && data?.lyrics) {
    return (
      <div className="mt-3 rounded-2xl border border-border bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 max-w-md">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <Music className="w-4 h-4 text-fuchsia-400" />
          <span className="font-bold text-sm">{data.title}</span>
          <Badge variant="secondary" className="text-xs ml-auto">{data.mood} {data.genre}</Badge>
        </div>
        <div className="px-5 py-4 text-sm whitespace-pre-wrap leading-loose max-h-64 overflow-y-auto text-foreground/90">
          {data.lyrics}
        </div>
        <div className="px-5 py-2 flex justify-end border-t border-border">
          <button
            onClick={() => { navigator.clipboard.writeText(data.lyrics); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy Lyrics</>}
          </button>
        </div>
      </div>
    );
  }

  if (tool === "get_youtube_transcript" && data?.transcript) {
    return (
      <div className="mt-3 rounded-2xl border border-border max-w-lg">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-red-500/5">
          <Youtube className="w-4 h-4 text-red-500" />
          <span className="text-xs font-semibold">Video {data.videoId}</span>
        </div>
        {data.summary && (
          <div className="px-4 py-3 bg-primary/5 border-b border-border text-sm">
            <p className="text-xs font-semibold text-primary mb-1">AI Summary</p>
            <p className="text-foreground/80 leading-relaxed">{data.summary}</p>
          </div>
        )}
        <div className="px-4 py-3 text-xs text-muted-foreground max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {data.transcript}
        </div>
        <div className="px-4 py-2 border-t border-border flex justify-end">
          <button
            onClick={() => { navigator.clipboard.writeText(data.transcript); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy Transcript</>}
          </button>
        </div>
      </div>
    );
  }

  if (tool === "humanize_text" && data?.humanized) {
    return (
      <div className="mt-3 rounded-2xl border border-border max-w-lg">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary">Humanized Text</span>
        </div>
        <div className="px-4 py-3 text-sm leading-relaxed text-foreground/90 max-h-48 overflow-y-auto">
          {data.humanized}
        </div>
        <div className="px-4 py-2 border-t border-border flex justify-end">
          <button
            onClick={() => { navigator.clipboard.writeText(data.humanized); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy Text</>}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function ToolLoadingIndicator({ tool }: { tool: string }) {
  const labels: Record<string, string> = {
    generate_image: "Generating image…",
    generate_code: "Writing code…",
    generate_song: "Composing lyrics…",
    get_youtube_transcript: "Extracting transcript…",
    humanize_text: "Humanizing text…",
  };
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs w-fit">
      <Loader2 className="w-3 h-3 animate-spin" />
      {labels[tool] ?? "Processing…"}
    </div>
  );
}

export default function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingTool, setPendingTool] = useState<string | null>(null);
  const [streamingToolResult, setStreamingToolResult] = useState<ToolResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const streamingTextRef = useRef("");
  const pendingToolResultRef = useRef<ToolResult | null>(null);
  const skipSyncRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { data: conversations = [] } = useListOpenaiConversations();
  const createConversation = useCreateOpenaiConversation();
  const deleteConversation = useDeleteOpenaiConversation();

  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || skipSyncRef.current) return;
    setLocalMessages([]);
    streamingTextRef.current = "";
    setStreamingText("");
    setPendingTool(null);
    setStreamingToolResult(null);
    pendingToolResultRef.current = null;

    fetch(`/api/openai/conversations/${activeConversationId}/messages`, { credentials: "include" })
      .then((r) => r.json())
      .then((msgs: any[]) => {
        if (!skipSyncRef.current) {
          setLocalMessages(msgs.map((m) => ({ ...m, toolResult: undefined })));
        }
      })
      .catch(() => {});
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingText, pendingTool]);

  const appendStreaming = (chunk: string) => {
    streamingTextRef.current += chunk;
    setStreamingText(streamingTextRef.current);
  };

  const handleNewConversation = () => {
    createConversation.mutate(
      { data: { title: "New Conversation" } },
      {
        onSuccess: (newConv) => {
          queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
          setActiveConversationId(newConv.id);
          skipSyncRef.current = false;
        },
      }
    );
  };

  const handleDeleteConversation = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
          if (activeConversationId === id) {
            setActiveConversationId(null);
            setLocalMessages([]);
          }
        },
      }
    );
  };

  const processSseStream = useCallback(
    async (response: Response) => {
      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "tool_call") {
              setPendingTool(data.tool);
              streamingTextRef.current = "";
              setStreamingText("");
            } else if (data.type === "tool_result") {
              pendingToolResultRef.current = { tool: data.tool, data: data.data };
              setStreamingToolResult({ tool: data.tool, data: data.data });
              setPendingTool(null);
            } else if (data.content) {
              appendStreaming(data.content);
            } else if (data.done) {
              const finalText = streamingTextRef.current;
              const toolResult = pendingToolResultRef.current ?? undefined;

              skipSyncRef.current = true;
              setLocalMessages((prev) => [
                ...prev,
                {
                  id: Date.now() + 1,
                  role: "assistant",
                  content: finalText,
                  createdAt: new Date().toISOString(),
                  toolResult,
                },
              ]);

              streamingTextRef.current = "";
              setStreamingText("");
              setPendingTool(null);
              setStreamingToolResult(null);
              pendingToolResultRef.current = null;
              setIsStreaming(false);

              queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
              setTimeout(() => { skipSyncRef.current = false; }, 5000);
            }
          } catch {}
        }
      }
    },
    [queryClient]
  );

  const handleSend = async () => {
    if (!input.trim() || !activeConversationId || isStreaming) return;
    const userMessage = input.trim();
    setInput("");
    setIsStreaming(true);
    streamingTextRef.current = "";
    setStreamingText("");
    setPendingTool(null);
    setStreamingToolResult(null);
    pendingToolResultRef.current = null;

    setLocalMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "user",
        content: userMessage,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch(`/api/openai/conversations/${activeConversationId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage }),
      });
      if (!response.ok) {
        setIsStreaming(false);
        return;
      }
      await processSseStream(response);
    } catch {
      setIsStreaming(false);
    }
  };

  const startRecording = async () => {
    if (!activeConversationId) {
      alert("Please create or select a conversation first.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        await sendVoiceMessage(blob, mimeType);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      alert("Microphone access denied. Please allow microphone access to use voice.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const sendVoiceMessage = async (audioBlob: Blob, mimeType: string) => {
    if (!activeConversationId) return;
    setIsStreaming(true);
    setIsPlayingAudio(false);
    streamingTextRef.current = "";
    setStreamingText("");
    pendingToolResultRef.current = null;

    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const audioPlayer = new PCMAudioPlayer();

    try {
      const response = await fetch(`/api/openai/conversations/${activeConversationId}/voice-messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64 }),
      });

      if (!response.ok || !response.body) { setIsStreaming(false); return; }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let userTranscript = "";
      let gotAudio = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "user_transcript") {
              userTranscript = data.data;
              setLocalMessages((prev) => [
                ...prev,
                { id: Date.now(), role: "user", content: `🎤 ${userTranscript}`, createdAt: new Date().toISOString() },
              ]);
            } else if (data.type === "transcript") {
              appendStreaming(data.data);
            } else if (data.type === "audio") {
              if (!gotAudio) { setIsPlayingAudio(true); gotAudio = true; }
              audioPlayer.scheduleChunk(data.data).catch(() => {});
            } else if (data.done) {
              const finalText = streamingTextRef.current;
              skipSyncRef.current = true;
              setLocalMessages((prev) => [
                ...prev,
                { id: Date.now() + 1, role: "assistant", content: `🔊 ${finalText}`, createdAt: new Date().toISOString() },
              ]);
              streamingTextRef.current = "";
              setStreamingText("");
              setIsStreaming(false);
              setIsPlayingAudio(false);
              queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
              setTimeout(() => { skipSyncRef.current = false; audioPlayer.close(); }, 5000);
            }
          } catch {}
        }
      }
    } catch {
      setIsStreaming(false);
      setIsPlayingAudio(false);
      audioPlayer.close();
    }
  };

  const handleFileSelected = async (file: File, type: "document" | "image") => {
    if (!activeConversationId) {
      alert("Please create or select a conversation first.");
      return;
    }
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    setLocalMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: `📎 Uploaded: ${file.name}`, createdAt: new Date().toISOString() },
    ]);
    setIsStreaming(true);
    streamingTextRef.current = "";
    setStreamingText("");

    try {
      const response = await fetch("/api/tools/analyze-file", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, filename: file.name, mimeType: file.type }),
      });
      const result = await response.json();
      const analysis = result.analysis ?? "Could not analyze the file.";

      skipSyncRef.current = true;
      setLocalMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", content: analysis, createdAt: new Date().toISOString() },
      ]);
      streamingTextRef.current = "";
      setStreamingText("");
      setIsStreaming(false);
      setTimeout(() => { skipSyncRef.current = false; }, 5000);
    } catch {
      setIsStreaming(false);
    }
  };

  const allDisplayMessages = localMessages;

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.pdf,.md,.csv,.json,.xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f, "document"); e.target.value = ""; }} />
      <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f, "image"); e.target.value = ""; }} />
      <input ref={cameraInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f, "image"); e.target.value = ""; }} />

      {/* Conversation sidebar */}
      <div className="hidden lg:flex w-64 flex-col border-r border-border bg-sidebar/50 backdrop-blur-xl shrink-0 p-4 gap-4">
        <Button
          onClick={handleNewConversation}
          disabled={createConversation.isPending}
          className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/20 border-none shadow-none"
        >
          <Plus className="w-4 h-4" /> New Chat
        </Button>
        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-1">
            {conversations.map((conv: any) => (
              <div
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-all ${
                  activeConversationId === conv.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <span className="truncate pr-2">{conv.title || "Conversation"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0"
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2">
            {isPlayingAudio && (
              <Badge variant="secondary" className="text-xs gap-1 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Playing audio…
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isStreaming && !isRecording}
            className={`rounded-full w-11 h-11 transition-all ${
              isRecording
                ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                : "bg-gradient-to-tr from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 text-pink-500 border border-pink-500/20"
            }`}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-6 md:px-8 lg:px-12">
          <div className="max-w-3xl mx-auto space-y-6 pb-40">
            {!activeConversationId && (
              <div className="text-center text-muted-foreground py-24 space-y-4">
                <p className="text-xl font-semibold">Welcome to NovaMind AI</p>
                <p className="text-sm">Create a new conversation or select one to start chatting.</p>
                <p className="text-xs text-muted-foreground/60">Try: "Generate an image of a sunset" or "Write me a Python function that sorts a list"</p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {allDisplayMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[88%] ${msg.role === "user" ? "" : "w-full"}`}>
                    <div
                      className={`rounded-2xl px-5 py-3.5 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground text-sm"
                          : "bg-muted/40 text-foreground border border-border/40"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <span className="leading-relaxed">{msg.content}</span>
                      ) : (
                        <SimpleMarkdown content={msg.content || " "} />
                      )}
                    </div>
                    {msg.toolResult && <ToolResultCard toolResult={msg.toolResult} />}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Live streaming bubble */}
            {(isStreaming || pendingTool) && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="max-w-[88%] w-full space-y-3">
                  {pendingTool && <ToolLoadingIndicator tool={pendingTool} />}
                  {streamingToolResult && !pendingTool && <ToolResultCard toolResult={streamingToolResult} />}
                  {streamingText && (
                    <div className="rounded-2xl px-5 py-3.5 bg-muted/40 text-foreground border border-border/40">
                      <SimpleMarkdown content={streamingText} />
                      <span className="inline-block w-2 h-3.5 bg-primary animate-pulse rounded-sm ml-1 align-middle" />
                    </div>
                  )}
                  {!pendingTool && !streamingText && isStreaming && (
                    <div className="rounded-2xl px-5 py-3.5 bg-muted/40 border border-border/40">
                      <div className="flex gap-1">
                        {[0, 0.15, 0.3].map((d) => (
                          <span key={d} className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${d}s` }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {isRecording && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  Recording… click the mic to stop
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-8">
          <div className="max-w-3xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-pink-500/30 rounded-3xl blur opacity-20 group-focus-within:opacity-70 transition duration-500" />
              <div className="relative bg-card border border-border/60 shadow-2xl rounded-3xl flex items-end p-2 min-h-[76px]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 rounded-full w-10 h-10 mb-1 ml-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52 p-2 rounded-xl">
                    <DropdownMenuItem className="gap-3 py-3 rounded-lg cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <FileUp className="w-4 h-4" /> Upload Document
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-3 py-3 rounded-lg cursor-pointer" onClick={() => imageInputRef.current?.click()}>
                      <ImageIcon className="w-4 h-4" /> Upload Image
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-3 py-3 rounded-lg cursor-pointer" onClick={() => cameraInputRef.current?.click()}>
                      <Camera className="w-4 h-4" /> Take Photo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    activeConversationId
                      ? "Ask anything… or try 'Generate an image of a dragon' or 'Write a Python function'"
                      : "Create a conversation to start…"
                  }
                  className="flex-1 bg-transparent border-0 focus:ring-0 resize-none py-3 px-3 max-h-[200px] min-h-[52px] text-sm placeholder:text-muted-foreground/50 outline-none leading-relaxed"
                  disabled={!activeConversationId || isStreaming}
                  rows={1}
                />

                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || !activeConversationId || isStreaming}
                  className="shrink-0 rounded-full w-10 h-10 mb-1 mr-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-95 disabled:opacity-30"
                  size="icon"
                >
                  {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                </Button>
              </div>
            </div>
            <p className="text-center mt-2.5 text-[11px] text-muted-foreground/40">
              NovaMind AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
