import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGenerateOpenaiImage } from "@workspace/api-client-react";
import { Download, Sparkles, Image as ImageIcon } from "lucide-react";

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<any>("realistic");
  const [size, setSize] = useState<any>("1024x1024");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  const generateImage = useGenerateOpenaiImage();

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    
    generateImage.mutate({
      data: { prompt, style, size }
    }, {
      onSuccess: (res) => {
        setImageUrl(`data:image/png;base64,${res.b64_json}`);
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 min-h-full flex flex-col md:flex-row gap-10">
      <div className="w-full md:w-1/3 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Image Studio</h1>
          <p className="text-muted-foreground">Transform your ideas into stunning visuals.</p>
        </div>

        <div className="space-y-6 bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="space-y-2">
            <Label>Prompt</Label>
            <Textarea 
              placeholder="A futuristic city with flying cars at sunset..." 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="h-32 resize-none bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label>Style</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realistic">Realistic</SelectItem>
                <SelectItem value="anime">Anime</SelectItem>
                <SelectItem value="logo">Logo</SelectItem>
                <SelectItem value="artistic">Artistic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Size</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1024x1024">Square (1024x1024)</SelectItem>
                <SelectItem value="1536x1024">Landscape (1536x1024)</SelectItem>
                <SelectItem value="1024x1536">Portrait (1024x1536)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-pink-600 hover:opacity-90 transition-opacity"
            onClick={handleGenerate}
            disabled={!prompt.trim() || generateImage.isPending}
          >
            {generateImage.isPending ? "Generating..." : <><Sparkles className="w-5 h-5 mr-2" /> Generate Art</>}
          </Button>
        </div>
      </div>

      <div className="w-full md:w-2/3 flex flex-col">
        <div className="flex-1 bg-muted/30 border border-border rounded-3xl overflow-hidden flex items-center justify-center relative group min-h-[400px]">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt={prompt} className="w-full h-full object-contain p-4" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                <a href={imageUrl} download="novamind-art.png">
                  <Button size="lg" variant="secondary" className="rounded-full font-semibold px-8 h-14">
                    <Download className="w-5 h-5 mr-2" /> Download Full Res
                  </Button>
                </a>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground flex flex-col items-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <ImageIcon className="w-10 h-10 opacity-50" />
              </div>
              <p>Your masterpiece will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
