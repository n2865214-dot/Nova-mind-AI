import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Menu, Plus, MessageSquare, Image as ImageIcon, FileText, Youtube, Code, Music, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import NotFound from "@/pages/not-found";
import ChatPage from "./pages/chat";
import ImageGeneratorPage from "./pages/image-generator";
import TextHumanizerPage from "./pages/text-humanizer";
import YoutubeTranscriptPage from "./pages/youtube-transcript";
import CodeAssistantPage from "./pages/code-assistant";
import SongGeneratorPage from "./pages/song-generator";

const queryClient = new QueryClient();

function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Chat", icon: MessageSquare },
    { href: "/image-generator", label: "Image Generator", icon: ImageIcon },
    { href: "/text-humanizer", label: "Text Humanizer", icon: FileText },
    { href: "/youtube-transcript", label: "YouTube Transcript", icon: Youtube },
    { href: "/code-assistant", label: "Code Assistant", icon: Code },
    { href: "/song-generator", label: "Song Generator", icon: Music },
  ];

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden text-foreground">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-sidebar shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">NovaMind AI</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === item.href ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}>
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="md:hidden p-4 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="w-5 h-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span className="font-bold text-lg">NovaMind AI</span>
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}><X className="w-4 h-4"/></Button>
              </div>
              <div className="p-4 space-y-2">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setIsSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-2 rounded-md ${location === item.href ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}>
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-bold text-lg bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">NovaMind AI</span>
          <div className="w-9" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={ChatPage} />
        <Route path="/image-generator" component={ImageGeneratorPage} />
        <Route path="/text-humanizer" component={TextHumanizerPage} />
        <Route path="/youtube-transcript" component={YoutubeTranscriptPage} />
        <Route path="/code-assistant" component={CodeAssistantPage} />
        <Route path="/song-generator" component={SongGeneratorPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
