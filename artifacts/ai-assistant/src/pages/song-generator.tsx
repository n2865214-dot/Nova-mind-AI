import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGenerateSong } from "@workspace/api-client-react";
import { Music, Mic2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SongGeneratorPage() {
  const [mood, setMood] = useState("Energetic");
  const [genre, setGenre] = useState("Pop");
  const [language, setLanguage] = useState("English");
  const [theme, setTheme] = useState("");
  const [result, setResult] = useState<any>(null);
  
  const generateSong = useGenerateSong();

  const handleGenerate = () => {
    generateSong.mutate({ data: { mood, genre, language, theme } }, {
      onSuccess: (res) => setResult(res)
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 min-h-full flex flex-col md:flex-row gap-10">
      <div className="w-full md:w-1/3 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Lyric Studio</h1>
          <p className="text-muted-foreground">Compose original lyrics instantly.</p>
        </div>

        <div className="space-y-6 bg-card border border-border p-6 rounded-3xl shadow-sm">
          <div className="space-y-2">
            <Label>Theme or Topic (Optional)</Label>
            <Input 
              placeholder="e.g. falling in love in a cyberpunk city" 
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label>Mood</Label>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Happy", "Sad", "Energetic", "Calm", "Romantic", "Angry"].map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Genre</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Pop", "Rock", "Hip-Hop", "Jazz", "Classical", "Synthwave", "Country"].map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Language</Label>
            <Input 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-background"
            />
          </div>

          <Button 
            className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:opacity-90 shadow-lg"
            onClick={handleGenerate}
            disabled={generateSong.isPending}
          >
            {generateSong.isPending ? "Composing..." : <><Music className="w-5 h-5 mr-2" /> Compose Track</>}
          </Button>
        </div>
      </div>

      <div className="w-full md:w-2/3 flex flex-col">
        <div className="flex-1 bg-card border border-border rounded-3xl overflow-hidden flex flex-col min-h-[500px] shadow-xl relative">
          <div className="h-16 border-b border-border flex items-center px-6 bg-muted/20">
            <Mic2 className="w-5 h-5 text-fuchsia-500 mr-3" />
            <span className="font-semibold text-lg">{result ? result.title : "Untitled Track"}</span>
          </div>
          <ScrollArea className="flex-1 p-8">
            {result ? (
              <div className="whitespace-pre-wrap text-lg leading-loose font-medium text-foreground max-w-lg mx-auto">
                {result.lyrics}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Your lyrics will appear here.
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
