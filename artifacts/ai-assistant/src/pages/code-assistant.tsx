import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGenerateCode } from "@workspace/api-client-react";
import { Code2, Play, Terminal } from "lucide-react";

export default function CodeAssistantPage() {
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [mode, setMode] = useState<any>("generate");
  const [result, setResult] = useState<string | null>(null);
  
  const generateCode = useGenerateCode();

  const handleRun = () => {
    if (!prompt.trim() && mode === 'generate') return;
    if (!code.trim() && mode !== 'generate') return;

    generateCode.mutate({ data: { prompt, language, mode, code } }, {
      onSuccess: (res) => setResult(res.result)
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 h-full flex flex-col gap-6">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Code Assistant</h1>
          <p className="text-muted-foreground mt-1">Generate, debug, and understand code instantly.</p>
        </div>
        <div className="flex gap-3 bg-muted/50 p-1.5 rounded-xl border border-border">
          <Button variant={mode === 'generate' ? 'default' : 'ghost'} className="rounded-lg" onClick={() => setMode('generate')}>Generate</Button>
          <Button variant={mode === 'debug' ? 'default' : 'ghost'} className="rounded-lg" onClick={() => setMode('debug')}>Debug</Button>
          <Button variant={mode === 'explain' ? 'default' : 'ghost'} className="rounded-lg" onClick={() => setMode('explain')}>Explain</Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TypeScript">TypeScript</SelectItem>
                  <SelectItem value="JavaScript">JavaScript</SelectItem>
                  <SelectItem value="Python">Python</SelectItem>
                  <SelectItem value="Rust">Rust</SelectItem>
                  <SelectItem value="Go">Go</SelectItem>
                  <SelectItem value="Java">Java</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prompt / Instructions</Label>
            <Textarea 
              placeholder="What do you want to build or fix?" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="h-24 resize-none bg-card font-medium"
            />
          </div>

          {mode !== 'generate' && (
            <div className="space-y-2 flex-1 flex flex-col">
              <Label>Source Code</Label>
              <Textarea 
                placeholder="Paste code here..." 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 resize-none bg-[#1E1E1E] text-[#D4D4D4] font-mono text-sm border-zinc-800"
              />
            </div>
          )}

          <Button 
            className="w-full h-12 text-base shrink-0" 
            onClick={handleRun}
            disabled={generateCode.isPending}
          >
            {generateCode.isPending ? "Processing..." : <><Play className="w-4 h-4 mr-2"/> Execute</>}
          </Button>
        </div>

        <div className="flex flex-col border border-border rounded-2xl overflow-hidden bg-[#1E1E1E] shadow-xl">
          <div className="h-12 bg-[#2D2D2D] border-b border-zinc-800 flex items-center px-4 gap-2 text-zinc-400">
            <Terminal className="w-4 h-4" />
            <span className="text-sm font-medium">Output.txt</span>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            {result ? (
              <pre className="text-[#D4D4D4] font-mono text-sm whitespace-pre-wrap">{result}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-sm">
                // Output will be displayed here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
