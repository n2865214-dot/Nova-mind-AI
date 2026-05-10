import { Link } from "wouter";
import { Sparkles, MessageSquare, Image as ImageIcon, Mic, Code, Music, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: MessageSquare, label: "Smart Chat", desc: "Streaming AI conversation with full history" },
  { icon: ImageIcon, label: "Image Generator", desc: "Text-to-image in multiple styles and sizes" },
  { icon: Mic, label: "Voice Chat", desc: "Real-time speech-to-speech AI conversation" },
  { icon: Code, label: "Code Assistant", desc: "Generate, debug, and explain code" },
  { icon: Music, label: "Song Generator", desc: "Write lyrics by mood, genre, and language" },
  { icon: FileText, label: "Text Humanizer", desc: "Turn AI text into natural human writing" },
];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} className="w-8 h-8 rounded-lg" alt="NovaMind AI" />
          <span className="font-bold text-xl bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
            NovaMind AI
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
          <Sparkles className="w-4 h-4" />
          Powered by GPT-5.4
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-3xl">
          Your{" "}
          <span className="bg-gradient-to-r from-primary via-violet-400 to-pink-500 bg-clip-text text-transparent">
            AI creative
          </span>{" "}
          studio
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mb-10">
          Chat, generate images, write code, compose songs, transcribe YouTube videos, and convert voice — all in one place.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-20">
          <Link href="/sign-up">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 text-base font-semibold rounded-xl">
              Start for free
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="px-8 py-6 text-base rounded-xl">
              Sign in
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl w-full">
          {features.map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border bg-card text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-sm">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} NovaMind AI — Built on GPT-5.4, GPT-Image-1 &amp; GPT-Audio
      </footer>
    </div>
  );
}
