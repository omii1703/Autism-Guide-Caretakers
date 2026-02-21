"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquarePlus,
  Settings,
  HelpCircle,
  Send,
  User,
  Sparkles,
  Mic,
  Paperclip,
  Sun,
  Moon,
} from "lucide-react";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function ChatPage() {
  const defaultMessage = {
    role: "assistant",
    content:
      "Hello! I’m here to help caregivers. Ask me anything about autism care.",
  };

  const [messages, setMessages] = useState<any[]>([defaultMessage]);
  const [input, setInput] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>("");

  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- Theme persistence ---------- */
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved) setDarkMode(saved === "dark");
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  /* ---------- Load Saved Chats ---------- */
  useEffect(() => {
    const savedChats = localStorage.getItem("chatHistory");
    if (savedChats) {
      const parsed = JSON.parse(savedChats);
      setChatHistory(parsed);

      if (parsed.length > 0) {
        setCurrentChatId(parsed[0].id);
        setMessages(parsed[0].messages);
      }
    }
  }, []);

  /* ---------- Save Chat ---------- */
  useEffect(() => {
    if (!currentChatId) return;

    const updatedHistory = chatHistory.map((chat) =>
      chat.id === currentChatId ? { ...chat, messages } : chat
    );

    setChatHistory(updatedHistory);
    localStorage.setItem("chatHistory", JSON.stringify(updatedHistory));
  }, [messages]);

  /* ---------- Scroll ---------- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------- Speech To Text ---------- */
  const startListening = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      sendMessage(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  /* ---------- Text To Speech ---------- */
  const speakText = (text: string) => {
    if (typeof window === "undefined") return;

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-US";
    window.speechSynthesis.speak(speech);
  };

  /* ---------- File Upload ---------- */
  const handleFileUpload = async (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: `📎 Uploaded: ${file.name}` },
    ]);

    try {
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer || "File processed." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ File upload failed." },
      ]);
    }
  };

  /* ---------- Send Message ---------- */
  async function sendMessage(customInput?: string) {
    const question = customInput ?? input;
    if (!question.trim()) return;

    const isSpeechInput = !!customInput;

    const updatedMessages = [
      ...messages,
      { role: "user", content: question },
    ];

    setMessages(updatedMessages);
    setInput("");

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      const cleanAnswer = data.answer.replace(/\*/g, "");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanAnswer },
      ]);

      if (isSpeechInput) speakText(cleanAnswer);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Unable to connect to server." },
      ]);
    }
  }

  /* ---------- New Chat ---------- */
  const createNewChat = () => {
    const newChat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [defaultMessage],
    };

    const updated = [newChat, ...chatHistory];
    setChatHistory(updated);
    setCurrentChatId(newChat.id);
    setMessages(newChat.messages);
    localStorage.setItem("chatHistory", JSON.stringify(updated));
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
        {/* Sidebar */}
        <aside className="hidden md:flex w-[280px] flex-col p-4 bg-[var(--panel)] border-r border-[var(--panel-border)]">
          <button
            onClick={createNewChat}
            className="flex items-center gap-3 mb-8 rounded-2xl px-4 py-4 text-sm font-medium bg-[var(--input)] border border-[var(--input-border)] hover:opacity-90"
          >
            <MessageSquarePlus size={20} />
            New chat
          </button>

          <div className="flex-1">
            <p className="px-3 text-xs font-bold text-[var(--muted)] uppercase tracking-widest mb-4">
              Recent
            </p>

            {chatHistory.map((chat) => (
              <div
                key={chat.id}
                onClick={() => {
                  setCurrentChatId(chat.id);
                  setMessages(chat.messages);
                }}
                className="px-4 py-2 mb-2 rounded-full bg-[var(--input)] border border-[var(--input-border)] text-sm font-medium cursor-pointer hover:opacity-80"
              >
                {chat.title}
              </div>
            ))}
          </div>

          <div className="mt-auto space-y-1 border-t border-[var(--panel-border)] pt-4">
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--input)]">
              <HelpCircle size={18} /> Help
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--input)]">
              <Settings size={18} /> Settings
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col relative">
          <header className="p-4 flex justify-between items-center bg-[var(--background)] border-b border-[var(--panel-border)]">
            <h1 className="text-xl font-semibold text-[var(--accent)]">
              Autism Care AI
            </h1>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-3 rounded-full bg-[var(--input)] border border-[var(--input-border)] hover:opacity-80"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[800px] mx-auto px-6 py-10 space-y-10">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-6 ${
                    m.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--input)] border border-[var(--input-border)]">
                    {m.role === "user" ? (
                      <User size={20} />
                    ) : (
                      <Sparkles
                        size={20}
                        className="text-[var(--accent)]"
                      />
                    )}
                  </div>

                  <div
                    className={`max-w-[80%] p-4 rounded-2xl border border-[var(--input-border)] ${
                      m.role === "user"
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--panel)]"
                    }`}
                  >
                    <p className="text-[15px] leading-relaxed">
                      {m.content}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} className="h-32" />
            </div>
          </div>

          {/* Input */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--background)] to-transparent pt-8 pb-6">
            <div className="max-w-[800px] mx-auto px-4">
              <div className="flex items-center gap-2 rounded-[32px] bg-[var(--panel)] border border-[var(--input-border)] px-5 py-3 shadow-lg">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Ask a question..."
                  className="flex-1 bg-transparent outline-none text-base"
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,.pdf"
                  hidden
                  onChange={handleFileUpload}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-full hover:bg-[var(--input)]"
                >
                  <Paperclip size={20} />
                </button>

                <button
                  onClick={startListening}
                  className={`p-2 rounded-full ${
                    isListening
                      ? "bg-red-500 text-white animate-pulse"
                      : "hover:bg-[var(--input)]"
                  }`}
                >
                  <Mic size={20} />
                </button>

                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  className={`p-2.5 rounded-full ${
                    input.trim()
                      ? "bg-[var(--accent)] text-white"
                      : "opacity-40"
                  }`}
                >
                  <Send size={20} />
                </button>
              </div>

              <p className="mt-3 text-center text-xs text-[var(--muted)]">
                Caregiver AI may generate inaccurate information.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}