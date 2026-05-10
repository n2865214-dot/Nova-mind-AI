import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useHumanizeText } from "@workspace/api-client-react";
import { Wand2, ArrowRight } from "lucide-react";

export default function TextHumanizerPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  
  const humanize = useHumanizeText();

  const handleConvert = () => {
    if (!text.trim()) return;
    humanize.mutate({ data: { text } }, {
      onSuccess: (res) => setResult(res.humanized)
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Text Humanizer</h1>
        <p className="text-muted-foreground">Make AI-generated text sound natural and engaging.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
        <div className="space-y-4">
          <Label className="text-lg">Original Text</Label>
          <Textarea 
            placeholder="Paste your AI text here..." 
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-[400px] resize-none bg-card border-border/60 shadow-sm text-base leading-relaxed p-6 rounded-2xl"
          />
        </div>

        <div className="flex justify-center py-4 lg:py-0">
          <Button 
            size="icon" 
            className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shrink-0 lg:rotate-0 rotate-90"
            onClick={handleConvert}
            disabled={!text.trim() || humanize.isPending}
          >
            {humanize.isPending ? <span className="animate-spin block w-6 h-6 border-4 border-white/30 border-t-white rounded-full"/> : <Wand2 className="w-8 h-8" />}
          </Button>
        </div>

        <div className="space-y-4">
          <Label className="text-lg">Humanized Output</Label>
          <div className="h-[400px] bg-card border border-border/60 shadow-sm rounded-2xl p-6 overflow-y-auto relative">
            {result ? (
              <div className="text-base leading-relaxed whitespace-pre-wrap">{result}</div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                Output will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
