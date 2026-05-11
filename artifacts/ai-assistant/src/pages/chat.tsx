import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Mic, MicOff, Send, Trash2, FileUp, Image as ImageIcon,
  Camera, Download, Copy, Check, Loader2, Music, Code2, Youtube,
  FileText, Cloud, Volume2, VolumeX,
} from "lucide-react";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey,
} from "@workspace/api-client-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Markdown renderer ────────────────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-2 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 text-xs text-zinc-400">
        <span className="font-mono">{language || "code"}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          {copied ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
        </button>
      </div>
      <pre className="p-4 text-xs text-zinc-200 font-mono overflow-x-auto whitespace-pre leading-relaxed">{code}</pre>
    </div>
  );
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
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      elements.push(<CodeBlock key={i} code={codeLines.join("\n")} language={lang} />);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="font-bold text-sm mt-3 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="font-bold text-base mt-4 mb-1.5">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(<li key={i} className="ml-4 list-disc leading-relaxed">{renderInline(line.slice(2))}</li>);
    } else if (/^\d+\. /.test(line)) {
      elements.push(<li key={i} className="ml-4 list-decimal leading-relaxed">{renderInline(line.replace(/^\d+\. /, ""))}</li>);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(<p key={i} className="leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }
  return <div className="space-y-0.5 text-sm">{elements}</div>;
}

// ─── Tool result cards ────────────────────────────────────────────────────────

function ToolResultCard({ toolResult }: { toolResult: ToolResult }) {
  const [copied, setCopied] = useState(false);
  const { tool, data } = toolResult;

  if (tool === "generate_image" && data?.b64_json) {
    const src = `data:image/png;base64,${data.b64_json}`;
    return (
      <div className="mt-3 rounded-2xl overflow-hidden border border-border max-w-sm shadow-xl">
        <img src={src} alt={data.prompt} className="w-full object-contain" />
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border">
          <span className="text-xs text-muted-foreground truncate capitalize">{data.style} · {data.prompt?.slice(0, 36)}…</span>
          <a href={src} download="novamind-image.png">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 shrink-0">
              <Download className="w-3 h-3" />Save
            </Button>
          </a>
        </div>
      </div>
    );
  }

  if (tool === "generate_code" && data?.result) {
    return (
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Code2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">{data.language} · {data.mode}</span>
        </div>
        <CodeBlock code={data.result} language={data.language?.toLowerCase()} />
      </div>
    );
  }

  if (tool === "generate_song" && data?.lyrics) {
    return (
      <div className="mt-3 rounded-2xl border border-border bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 max-w-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Music className="w-4 h-4 text-fuchsia-400" />
          <span className="font-bold text-sm flex-1 truncate">{data.title}</span>
          <Badge variant="secondary" className="text-[10px] shrink-0">{data.mood}</Badge>
        </div>
        <div className="px-5 py-4 text-sm whitespace-pre-wrap leading-loose max-h-60 overflow-y-auto">
          {data.lyrics}
        </div>
        <div className="px-4 py-2 flex justify-end border-t border-border">
          <button
            onClick={() => { navigator.clipboard.writeText(data.lyrics); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {copied ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy Lyrics</>}
          </button>
        </div>
      </div>
    );
  }

  if (tool === "get_youtube_transcript" && data?.transcript) {
    return (
      <div className="mt-3 rounded-2xl border border-border max-w-md overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-red-500/5">
          <Youtube className="w-4 h-4 text-red-500" />
          <span className="text-xs font-semibold">
            {data.realTranscript ? "Real transcript" : "Generated transcript"} · {data.videoId}
          </span>
        </div>
        {data.summary && (
          <div className="px-4 py-3 bg-primary/5 border-b border-border">
            <p className="text-xs font-semibold text-primary mb-1">AI Summary</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{data.summary}</p>
          </div>
        )}
        <div className="px-4 py-3 text-xs text-muted-foreground max-h-44 overflow-y-auto whitespace-pre-wrap leading-relaxed font-mono">
          {data.transcript}
        </div>
        <div className="px-4 py-2 border-t border-border flex justify-end">
          <button
            onClick={() => { navigator.clipboard.writeText(data.transcript); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {copied ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
          </button>
        </div>
      </div>
    );
  }

  if (tool === "humanize_text" && data?.humanized) {
    return (
      <div className="mt-3 rounded-2xl border border-border max-w-md overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5">
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Humanized Output</span>
        </div>
        <div className="px-4 py-3 text-sm leading-relaxed max-h-48 overflow-y-auto">{data.humanized}</div>
        <div className="px-4 py-2 border-t border-border flex justify-end">
          <button
            onClick={() => { navigator.clipboard.writeText(data.humanized); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {copied ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
          </button>
        </div>
      </div>
    );
  }

  if (tool === "get_weather" && data?.temperature !== undefined) {
    const WX_ICONS: Record<string, string> = {
      "Clear sky": "☀️", "Mainly clear": "🌤️", "Partly cloudy": "⛅",
      "Overcast": "☁️", "Foggy": "🌫️", "Light drizzle": "🌦️", "Drizzle": "🌦️",
      "Light rain": "🌧️", "Moderate rain": "🌧️", "Heavy rain": "⛈️",
      "Light snow": "🌨️", "Moderate snow": "❄️", "Heavy snow": "❄️",
      "Light showers": "🌦️", "Showers": "🌧️", "Thunderstorm": "⛈️",
    };
    const icon = WX_ICONS[data.description] ?? "🌡️";
    return (
      <div className="mt-3 rounded-2xl border border-border max-w-xs overflow-hidden shadow-lg">
        <div className="bg-gradient-to-br from-blue-500/15 to-indigo-600/15 px-6 py-5 text-center">
          <div className="text-4xl mb-2">{icon}</div>
          <div className="text-3xl font-bold">{data.temperature}{data.unit}</div>
          <div className="text-sm text-muted-foreground mt-1">{data.description}</div>
          <div className="text-xs text-muted-foreground/60 mt-0.5 truncate px-2">{data.location}</div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border bg-muted/10">
          {[
            { label: "Feels like", value: `${data.feelsLike}°` },
            { label: "Humidity", value: `${data.humidity}%` },
            { label: "Wind", value: `${data.windSpeed} mph` },
          ].map((item) => (
            <div key={item.label} className="px-2 py-2.5 text-center">
              <div className="text-[10px] text-muted-foreground">{item.label}</div>
              <div className="text-xs font-semibold mt-0.5">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function ToolLoadingCard({ tool }: { tool: string }) {
  const labels: Record<string, { label: string; icon: React.ReactNode }> = {
    generate_image: { label: "Generating image…", icon: <ImageIcon className="w-3.5 h-3.5" /> },
    generate_code: { label: "Writing code…", icon: <Code2 className="w-3.5 h-3.5" /> },
    generate_song: { label: "Composing lyrics…", icon: <Music className="w-3.5 h-3.5" /> },
    get_youtube_transcript: { label: "Fetching transcript…", icon: <Youtube className="w-3.5 h-3.5" /> },
    humanize_text: { label: "Humanizing text…", icon: <FileText className="w-3.5 h-3.5" /> },
    get_weather: { label: "Getting weather…", icon: <Cloud className="w-3.5 h-3.5" /> },
  };
  const { label, icon } = labels[tool] ?? { label: "Processing…", icon: <Loader2 className="w-3.5 h-3.5" /> };
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs w-fit">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      {icon}
      {label}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingTool, setPendingTool] = useState<string | null>(null);
  const [streamingToolResult, setStreamingToolResult] = useState<ToolResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceInterimText, setVoiceInterimText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  const streamingTextRef = useRef("");
  const pendingToolResultRef = useRef<ToolResult | null>(null);
  const skipSyncRef = useRef(false);
  const activeConvIdRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const { data: conversations = [] } = useListOpenaiConversations();
  const createConversation = useCreateOpenaiConversation();
  const deleteConversation = useDeleteOpenaiConversation();

  useEffect(() => { activeConvIdRef.current = activeConversationId; }, [activeConversationId]);

  // Auto-select first conversation
  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId((conversations as any[])[0].id);
    }
  }, [conversations, activeConversationId]);

  // Load messages when conversation changes
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
        if (!skipSyncRef.current) setLocalMessages(msgs.map((m) => ({ ...m })));
      })
      .catch(() => {});
  }, [activeConversationId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingText, pendingTool]);

  // Auto-create conversation
  const autoCreateConversation = useCallback(async (): Promise<number | null> => {
    return new Promise((resolve) => {
      createConversation.mutate(
        { data: { title: "New Chat" } },
        {
          onSuccess: (conv: any) => {
            setActiveConversationId(conv.id);
            queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
            resolve(conv.id);
          },
          onError: () => resolve(null),
        }
      );
    });
  }, [createConversation, queryClient]);

  // Process SSE stream
  const processSse = useCallback(
    async (response: Response, onText?: (text: string) => void) => {
      if (!response.body) return;
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
              streamingTextRef.current += data.content;
              setStreamingText(streamingTextRef.current);
              onText?.(streamingTextRef.current);
            } else if (data.done) {
              const finalText = streamingTextRef.current;
              const toolResult = pendingToolResultRef.current ?? undefined;

              skipSyncRef.current = true;
              setLocalMessages((prev) => [
                ...prev,
                { id: Date.now() + 1, role: "assistant", content: finalText, createdAt: new Date().toISOString(), toolResult },
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

  // Core send function
  const sendMessage = useCallback(
    async (text: string, shouldSpeak = false) => {
      if (!text.trim() || isStreaming) return;

      let convId = activeConvIdRef.current;
      if (!convId) {
        convId = await autoCreateConversation();
        if (!convId) return;
      }

      setIsStreaming(true);
      streamingTextRef.current = "";
      setStreamingText("");
      setPendingTool(null);
      setStreamingToolResult(null);
      pendingToolResultRef.current = null;

      setLocalMessages((prev) => [
        ...prev,
        { id: Date.now(), role: "user", content: text, createdAt: new Date().toISOString() },
      ]);

      try {
        const response = await fetch(`/api/openai/conversations/${convId}/messages`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });

        if (!response.ok) { setIsStreaming(false); return; }

        let fullResponseText = "";
        await processSse(response, (t) => { fullResponseText = t; });

        if (shouldSpeak && fullResponseText) {
          speakText(fullResponseText);
        }
      } catch {
        setIsStreaming(false);
      }
    },
    [isStreaming, autoCreateConversation, processSse]
  );

  // TTS - browser-native SpeechSynthesis
  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    // Clean markdown for clean audio
    const clean = text.replace(/```[\s\S]*?```/g, "code block").replace(/[*#`_~\[\]]/g, "").replace(/\n+/g, " ").slice(0, 800).trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    // Pick a good voice when available
    const loadAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const pick = voices.find((v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Neural") || v.name.includes("Samantha"))
      ) || voices.find((v) => v.lang.startsWith("en"));
      if (pick) utterance.voice = pick;
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      loadAndSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = loadAndSpeak;
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // Voice input — Web Speech API (like Siri/Gemini)
  const toggleVoice = async () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setVoiceInterimText("");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input requires Google Chrome or Microsoft Edge. Please switch browsers.");
      return;
    }

    // Auto-create conversation if needed
    if (!activeConvIdRef.current) {
      const id = await autoCreateConversation();
      if (!id) return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { setIsRecording(true); setVoiceInterimText(""); };
    recognition.onend = () => { setIsRecording(false); setVoiceInterimText(""); };
    recognition.onerror = (e: any) => {
      setIsRecording(false);
      setVoiceInterimText("");
      if (e.error === "not-allowed") alert("Microphone permission denied. Please allow mic access in your browser settings.");
    };

    recognition.onresult = async (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim();

      if (result.isFinal) {
        setVoiceInterimText("");
        recognition.stop();
        if (transcript) {
          await sendMessage(transcript, true); // speak the response back
        }
      } else {
        setVoiceInterimText(transcript);
      }
    };

    recognition.start();
  };

  // Handle text send
  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const text = input.trim();
    setInput("");
    await sendMessage(text, false);
  };

  // Delete conversation
  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
          if (activeConversationId === id) { setActiveConversationId(null); setLocalMessages([]); }
        },
      }
    );
  };

  // File analysis
  const handleFile = async (file: File) => {
    let convId = activeConvIdRef.current;
    if (!convId) {
      convId = await autoCreateConversation();
      if (!convId) return;
    }

    setLocalMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: `📎 ${file.name}`, createdAt: new Date().toISOString() },
    ]);
    setIsStreaming(true);

    try {
      const ab = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      const resp = await fetch("/api/tools/analyze-file", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: b64, filename: file.name, mimeType: file.type }),
      });
      const result = await resp.json();
      const analysis = result.analysis ?? "Could not analyze the file.";
      skipSyncRef.current = true;
      setLocalMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", content: analysis, createdAt: new Date().toISOString() },
      ]);
      setIsStreaming(false);
      setTimeout(() => { skipSyncRef.current = false; }, 5000);
    } catch {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.md,.csv,.json,.xml,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      <input ref={cameraInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

      {/* Conversation sidebar */}
      <div className="hidden lg:flex w-56 flex-col border-r border-border bg-sidebar/40 backdrop-blur-xl shrink-0 p-3 gap-3">
        <Button
          onClick={() => autoCreateConversation()}
          disabled={createConversation.isPending}
          className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/20 border-none shadow-none h-9 text-sm"
          variant="ghost"
        >
          <Plus className="w-4 h-4" /> New Chat
        </Button>
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-0.5">
            {(conversations as any[]).map((conv: any) => (
              <div
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-all ${
                  activeConversationId === conv.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <span className="truncate">{conv.title || "Chat"}</span>
                <Button
                  variant="ghost" size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0"
                  onClick={(e) => handleDelete(conv.id, e)}
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
        {/* Header bar */}
        <div className="h-13 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background/80 backdrop-blur-md py-2">
          <div className="flex items-center gap-2">
            {isSpeaking && (
              <Badge variant="secondary" className="text-xs gap-1.5 animate-pulse cursor-pointer" onClick={stopSpeaking}>
                <Volume2 className="w-3 h-3" /> Speaking… (tap to stop)
              </Badge>
            )}
            {isRecording && voiceInterimText && (
              <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">"{voiceInterimText}"</span>
            )}
          </div>
          <Button
            onClick={toggleVoice}
            disabled={isStreaming && !isRecording}
            title={isRecording ? "Stop recording" : "Voice assistant (Chrome/Edge)"}
            className={`rounded-full w-10 h-10 transition-all ${
              isRecording
                ? "bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse"
                : "bg-gradient-to-tr from-violet-500/15 to-pink-500/15 text-pink-400 border border-pink-500/20 hover:from-violet-500/25 hover:to-pink-500/25"
            }`}
            size="icon"
          >
            {isRecording ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4 h-4" />}
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 md:px-8 py-6">
          <div className="max-w-3xl mx-auto space-y-5 pb-44">
            {!activeConversationId && !createConversation.isPending && (
              <div className="flex flex-col items-center justify-center text-center py-20 space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-pink-500/20 flex items-center justify-center border border-primary/20">
                  <Mic className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold mb-2">Talk to NovaMind AI</p>
                  <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                    Ask anything — chat, generate images, write code, compose songs, get weather, or transcribe YouTube videos.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-md text-xs">
                  {[
                    "🌤️ What's the weather in Tokyo?",
                    "🎨 Draw a neon dragon",
                    "💻 Write a Python web scraper",
                    "🎵 Write a sad jazz song",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s.replace(/^[^ ]+ /, ""))}
                      className="px-3 py-1.5 rounded-full border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {localMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] ${msg.role === "assistant" ? "w-full" : ""}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground text-sm rounded-br-sm"
                          : "bg-muted/40 text-foreground border border-border/40 rounded-bl-sm"
                      }`}
                    >
                      {msg.role === "user"
                        ? <span className="leading-relaxed">{msg.content}</span>
                        : <SimpleMarkdown content={msg.content || " "} />
                      }
                    </div>
                    {msg.toolResult && <ToolResultCard toolResult={msg.toolResult} />}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Live streaming state */}
            {(isStreaming || pendingTool) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="max-w-[85%] w-full space-y-3">
                  {pendingTool && <ToolLoadingCard tool={pendingTool} />}
                  {streamingToolResult && !pendingTool && <ToolResultCard toolResult={streamingToolResult} />}
                  {streamingText ? (
                    <div className="rounded-2xl px-4 py-3 bg-muted/40 border border-border/40 rounded-bl-sm">
                      <SimpleMarkdown content={streamingText} />
                      <span className="inline-block w-2 h-3.5 bg-primary rounded-sm animate-pulse ml-1 align-middle" />
                    </div>
                  ) : !pendingTool && isStreaming ? (
                    <div className="rounded-2xl px-4 py-3 bg-muted/40 border border-border/40 rounded-bl-sm">
                      <div className="flex gap-1.5">
                        {[0, 0.15, 0.3].map((d) => (
                          <span key={d} className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: `${d}s` }} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  {voiceInterimText ? `"${voiceInterimText}"` : "Listening… speak now"}
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-10">
          <div className="max-w-3xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/25 to-pink-500/25 rounded-3xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
              <div className="relative bg-card border border-border/60 shadow-2xl rounded-3xl flex items-end p-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0 rounded-full w-9 h-9 mb-1 ml-1 text-muted-foreground hover:text-foreground hover:bg-accent">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 p-1.5 rounded-xl">
                    <DropdownMenuItem className="gap-3 py-2.5 rounded-lg cursor-pointer text-sm" onClick={() => fileInputRef.current?.click()}>
                      <FileUp className="w-4 h-4" /> Upload Document
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-3 py-2.5 rounded-lg cursor-pointer text-sm" onClick={() => imageInputRef.current?.click()}>
                      <ImageIcon className="w-4 h-4" /> Upload Image
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-3 py-2.5 rounded-lg cursor-pointer text-sm" onClick={() => cameraInputRef.current?.click()}>
                      <Camera className="w-4 h-4" /> Take Photo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={
                    isRecording
                      ? "Listening…"
                      : "Ask anything, or try: 'weather in Paris', 'generate a dragon image', 'write Python code'…"
                  }
                  className="flex-1 bg-transparent border-0 focus:ring-0 resize-none py-2.5 px-2 max-h-[180px] min-h-[44px] text-sm placeholder:text-muted-foreground/40 outline-none leading-relaxed"
                  disabled={isStreaming || isRecording}
                  rows={1}
                />

                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming || isRecording}
                  className="shrink-0 rounded-full w-9 h-9 mb-1 mr-1 bg-primary hover:bg-primary/90 shadow-md transition-all active:scale-95 disabled:opacity-25"
                  size="icon"
                >
                  {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                </Button>
              </div>
            </div>
            <p className="text-center mt-2 text-[10px] text-muted-foreground/35">
              NovaMind AI can make mistakes · Voice requires Chrome or Edge
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
