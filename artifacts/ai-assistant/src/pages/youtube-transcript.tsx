import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetYoutubeTranscript } from "@workspace/api-client-react";
import { Youtube, FileText, Copy, Check } from "lucide-react";

export default function YoutubeTranscriptPage() {
  const [url, setUrl] = useState("");
  const [summarize, setSummarize] = useState(true);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const getTranscript = useGetYoutubeTranscript();

  const handleFetch = () => {
    if (!url.trim()) return;
    getTranscript.mutate({ data: { url, summarize } }, {
      onSuccess: (res) => setResult(res)
    });
  };

  const handleCopy = () => {
    if (result?.transcript) {
      navigator.clipboard.writeText(result.transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Youtube className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">YouTube Transcript</h1>
        <p className="text-xl text-muted-foreground">Extract and summarize any video instantly.</p>
      </div>

      <div className="bg-card border border-border p-6 md:p-8 rounded-3xl shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Input 
              placeholder="Paste YouTube URL here..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-14 pl-6 text-lg rounded-2xl bg-background border-border/60"
            />
          </div>
          <Button 
            onClick={handleFetch}
            disabled={!url.trim() || getTranscript.isPending}
            className="h-14 px-8 text-lg font-semibold rounded-2xl bg-primary"
          >
            {getTranscript.isPending ? "Extracting..." : "Extract"}
          </Button>
        </div>
        
        <div className="flex items-center space-x-3 px-2">
          <Switch id="summarize" checked={summarize} onCheckedChange={setSummarize} />
          <Label htmlFor="summarize" className="text-base cursor-pointer">Generate AI Summary</Label>
        </div>
      </div>

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {result.title && <h2 className="text-2xl font-bold">{result.title}</h2>}
          
          {result.summary && (
            <div className="bg-primary/5 border border-primary/20 p-6 rounded-2xl space-y-3">
              <h3 className="font-semibold text-primary flex items-center gap-2"><SparklesIcon /> AI Summary</h3>
              <p className="text-foreground leading-relaxed">{result.summary}</p>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4"/> Full Transcript</h3>
              <Button variant="outline" size="sm" onClick={handleCopy} className="rounded-full">
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copied" : "Copy Text"}
              </Button>
            </div>
            <ScrollArea className="h-[400px] p-6">
              <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{result.transcript}</p>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}

function SparklesIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
}
