"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Briefcase, Zap, Mail, FileText, Users,
  ArrowRight, Sparkles, Send, TerminalSquare,
  Activity, CheckCircle2, Github, ArrowUpRight,
  Shield, Clock, Cpu, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Intersection observer hook for scroll animations ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ── Animated section wrapper ─── */
function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Data ─── */
const features = [
  { icon: Send, title: "Application Tracker", desc: "Automated Gmail scanning detects confirmations, interviews, rejections, and offers. Full timeline per company with real-time status updates." },
  { icon: Zap, title: "Cold Email Engine", desc: "AI-generated templates with smart tag replacement. Send personalized outreach directly from your Gmail at scale — zero per-send AI cost." },
  { icon: FileText, title: "Resume Manager", desc: "Upload multiple versions of your resume. Automatic parsing extracts contact info, skills, and experience for template tag replacement." },
  { icon: Users, title: "Contact Database", desc: "Store recruiters and hiring managers with roles, companies, and emails. Import from scraped pages or add manually. Launch campaigns in one click." },
  { icon: Sparkles, title: "AI Text Extractor", desc: "Paste raw text from any job listing or webpage. AI instantly extracts structured contacts, job details, and company information." },
  { icon: Activity, title: "Background Automation", desc: "Celery-powered scheduled tasks run 24/7: inbox sync every 2 hours, automated job discovery, and scheduled cold mail dispatch." },
];

const workflow = [
  { step: "01", title: "Upload & Connect", desc: "Add your resumes and connect your Gmail account via OAuth and your API Keys. The system parses your documents, extracts key details, and configures your workspace automatically.", icon: FileText, color: "from-blue-500/20 to-blue-600/5" },
  { step: "02", title: "Create & Send", desc: "Build AI-powered email templates with dynamic tags like {name}, {company}, {role}. Tags auto-fill from your resume and contacts — no manual editing needed.", icon: Mail, color: "from-violet-500/20 to-violet-600/5" },
  { step: "03", title: "Track & Automate", desc: "Your inbox syncs automatically every 2 hours. Application statuses update in real-time. Every interaction is logged in a searchable, filterable timeline.", icon: TerminalSquare, color: "from-emerald-500/20 to-emerald-600/5" },
];

const capabilities = [
  { text: "Gmail inbox scanning every 2 hours", icon: Clock },
  { text: "AI-generated email templates", icon: Sparkles },
  { text: "Multi-resume smart tag replacement", icon: FileText },
  { text: "Automated contact extraction", icon: Users },
  { text: "Application timeline tracking", icon: Activity },
  { text: "One-click cold email campaigns", icon: Send },
  { text: "Configurable AI (Gemini / OpenAI)", icon: Cpu },
  { text: "Secure OAuth & SSO authentication", icon: Shield },
];

const techStack = [
  { name: "Next.js", desc: "Frontend" },
  { name: "React", desc: "UI" },
  { name: "FastAPI", desc: "Backend" },
  { name: "PostgreSQL", desc: "Database" },
  { name: "Redis", desc: "Cache" },
  { name: "Celery", desc: "Tasks" },
  { name: "Gemini", desc: "AI" },
  { name: "Gmail API", desc: "Email" },
  { name: "Clerk", desc: "Auth" },
  { name: "Docker", desc: "Deploy" },
];

/* ── Component ─── */
export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    if (token) router.push("/dashboard");
  }, [router]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Inline keyframes for animated gradient and glow */}
      <style jsx global>{`
                @keyframes gradient-shift {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-12px); }
                }
                @keyframes pulse-glow {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                }
                .animate-gradient { animation: gradient-shift 8s ease infinite; background-size: 200% 200%; }
                .animate-float { animation: float 6s ease-in-out infinite; }
                .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
            `}</style>

      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-2xl" />
        <div className="relative w-full px-6 sm:px-10 lg:px-16 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center">
              <Briefcase className="h-4 w-4 text-black" />
            </div>
            <span className="text-lg font-medium tracking-tight">JobHunt</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="https://github.com/Chai-B/JobHunt" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors duration-300 hidden sm:block">
              <Github className="h-5 w-5" />
            </a>
            <Link href="/login" className="text-zinc-400 hover:text-white text-sm transition-colors duration-300 hidden sm:block">
              Sign in
            </Link>
            <Link href="/login">
              <Button className="bg-white text-black hover:bg-zinc-200 h-9 px-5 text-sm rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-white/10">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 sm:px-10 lg:px-16">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Main glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-br from-blue-600/[0.07] via-violet-600/[0.05] to-transparent rounded-full blur-[120px] animate-pulse-glow" />
          {/* Secondary glow */}
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gradient-to-bl from-emerald-600/[0.04] to-transparent rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '80px 80px'
          }} />
          {/* Radial fade edges */}
          <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10 pt-16">
          {/* Badge */}
          <FadeIn>
            <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm text-sm text-zinc-400 mb-10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              AI-Powered Job Search Automation Platform
            </div>
          </FadeIn>

          {/* Headline */}
          <FadeIn delay={100}>
            <h1 className="text-[3.5rem] sm:text-[5rem] lg:text-[6.5rem] font-medium tracking-[-0.04em] leading-[0.95] mb-8">
              Your job search,
              <br />
              <span className="animate-gradient bg-gradient-to-r from-zinc-300 via-white to-zinc-400 bg-clip-text text-transparent">
                on autopilot .
              </span>
            </h1>
          </FadeIn>

          {/* Subtext */}
          <FadeIn delay={200}>
            <p className="text-xl sm:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-14 font-light">
              Track applications, send cold emails, and scan your inbox for updates — all from a single command center.
            </p>
          </FadeIn>

          {/* CTAs */}
          <FadeIn delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login">
                <Button className="bg-white text-black hover:bg-zinc-100 h-14 px-10 text-base rounded-2xl font-medium group shadow-2xl shadow-white/[0.1] transition-all duration-300 hover:shadow-white/[0.2] hover:scale-[1.02]">
                  Start automating
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="ghost" className="h-14 px-10 text-base rounded-2xl text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all duration-300">
                  Explore features
                </Button>
              </a>
            </div>
          </FadeIn>

          {/* Scroll indicator */}
          <div className="mt-20 animate-float">
            <div className="w-6 h-10 rounded-full border-2 border-zinc-700 mx-auto flex items-start justify-center p-1.5">
              <div className="w-1 h-2.5 rounded-full bg-zinc-500 animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="border-y border-white/[0.06] py-16 px-6 sm:px-10 lg:px-16">
        <FadeIn>
          <div className="w-full max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
            {[
              { value: "6+", label: "Core Modules", sub: "Tracker, Email, Resumes & more" },
              { value: "24/7", label: "Always Running", sub: "Celery background workers" },
              { value: "$0", label: "Per-Send Cost", sub: "Tags replace without AI calls" },
              { value: "2h", label: "Sync Interval", sub: "Automated inbox scanning" },
            ].map((s, i) => (
              <FadeIn key={s.label} delay={i * 100} className="text-center sm:text-left">
                <div className="text-4xl sm:text-5xl font-medium text-white tracking-tight mb-1">{s.value}</div>
                <div className="text-sm text-zinc-300 mb-0.5">{s.label}</div>
                <div className="text-xs text-zinc-600">{s.sub}</div>
              </FadeIn>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-28 sm:py-36 px-6 sm:px-10 lg:px-16">
        <div className="w-full max-w-7xl mx-auto">
          <FadeIn className="text-center mb-20">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-600 mb-4">Features</p>
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-5">
              Everything you need
            </h2>
            <p className="text-zinc-400 text-lg sm:text-xl max-w-xl mx-auto font-light">
              A complete toolkit for every stage of your job search — from discovery to offer.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <FadeIn key={f.title} delay={i * 80}>
                  <div className="group relative h-full p-7 sm:p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-500 cursor-default">
                    {/* Hover glow */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <div className="h-12 w-12 rounded-xl bg-white/[0.06] flex items-center justify-center border border-white/[0.08] mb-6 group-hover:bg-white/[0.1] group-hover:border-white/[0.15] transition-all duration-500">
                        <Icon className="h-5 w-5 text-zinc-300 group-hover:text-white transition-colors duration-500" />
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2.5">{f.title}</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors duration-500">{f.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-28 sm:py-36 px-6 sm:px-10 lg:px-16 border-t border-white/[0.06]">
        <div className="w-full max-w-5xl mx-auto">
          <FadeIn className="text-center mb-20">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-600 mb-4">How it works</p>
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-5">
              Three steps to autopilot
            </h2>
            <p className="text-zinc-400 text-lg sm:text-xl max-w-lg mx-auto font-light">
              Set up once. Let the system handle the rest.
            </p>
          </FadeIn>

          <div className="space-y-5">
            {workflow.map((item, i) => {
              const Icon = item.icon;
              return (
                <FadeIn key={item.step} delay={i * 120}>
                  <div className="group relative flex flex-col sm:flex-row items-start gap-6 sm:gap-8 p-7 sm:p-9 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-500 overflow-hidden">
                    {/* Gradient accent */}
                    <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${item.color} rounded-l-2xl`} />

                    <div className="flex items-center gap-5 sm:gap-6 shrink-0">
                      <span className="text-5xl sm:text-6xl font-medium text-zinc-800/80 tabular-nums leading-none">{item.step}</span>
                      <div className="h-12 w-12 rounded-xl bg-white/[0.06] flex items-center justify-center border border-white/[0.08] group-hover:bg-white/[0.1] transition-all duration-500">
                        <Icon className="h-5 w-5 text-zinc-400 group-hover:text-white transition-colors duration-500" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-medium text-white mb-2">{item.title}</h3>
                      <p className="text-sm sm:text-base text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors duration-500">{item.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Capabilities ─── */}
      <section className="py-28 sm:py-36 px-6 sm:px-10 lg:px-16 border-t border-white/[0.06]">
        <div className="w-full max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <FadeIn>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-600 mb-4">Capabilities</p>
              <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-5">
                Built for
                <br className="hidden sm:block" />
                job seekers
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed mb-10 max-w-md font-light">
                Not another job board. JobHunt is an automation layer that handles the operational overhead of your job search — so you can focus on interviews and preparation.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/login">
                  <Button className="bg-white text-black hover:bg-zinc-100 h-12 px-8 text-[15px] rounded-xl font-medium group transition-all duration-300 hover:scale-[1.02]">
                    Try it now
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
                <a href="https://github.com/Chai-B/JobHunt" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="h-12 px-8 text-[15px] rounded-xl border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 gap-2 transition-all duration-300">
                    <Github className="h-4 w-4" />
                    View on GitHub
                  </Button>
                </a>
              </div>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 gap-3">
            {capabilities.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <FadeIn key={cap.text} delay={i * 60}>
                  <div className="group flex items-center gap-4 py-4 px-5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/15 transition-colors duration-300">
                      <Icon className="h-3.5 w-3.5 text-emerald-400/80" />
                    </div>
                    <span className="text-[15px] text-zinc-300 group-hover:text-white transition-colors duration-300">{cap.text}</span>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Tech Stack ─── */}
      <section className="py-20 px-6 sm:px-10 lg:px-16 border-t border-white/[0.06]">
        <FadeIn className="w-full max-w-5xl mx-auto text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-600 mb-8">Tech Stack</p>
          <div className="flex flex-wrap justify-center gap-3">
            {techStack.map((t) => (
              <div key={t.name} className="flex items-center gap-2.5 px-5 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300">
                <span className="text-[15px] text-white">{t.name}</span>
                <span className="text-xs text-zinc-600">·</span>
                <span className="text-xs text-zinc-500">{t.desc}</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative py-32 sm:py-40 px-6 sm:px-10 lg:px-16 border-t border-white/[0.06]">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-br from-blue-600/[0.05] via-violet-600/[0.03] to-transparent rounded-full blur-[120px] animate-pulse-glow" />
        </div>

        <FadeIn className="w-full max-w-3xl mx-auto text-center relative z-10">
          <div className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-white/10 animate-float">
            <Briefcase className="h-7 w-7 text-black" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-5">
            Ready to automate?
          </h2>
          <p className="text-zinc-400 text-lg sm:text-xl max-w-lg mx-auto mb-12 font-light">
            Stop tracking applications in spreadsheets. Let JobHunt handle the grind while you focus on what matters.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button className="bg-white text-black hover:bg-zinc-100 h-14 px-12 text-base rounded-2xl font-medium group shadow-2xl shadow-white/[0.1] transition-all duration-300 hover:shadow-white/[0.2] hover:scale-[1.02]">
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
              </Button>
            </Link>
            <a href="https://github.com/Chai-B/JobHunt" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" className="h-14 px-8 text-base rounded-2xl text-zinc-400 hover:text-white hover:bg-white/[0.05] gap-2 transition-all duration-300">
                <Github className="h-5 w-5" />
                Star on GitHub
              </Button>
            </a>
          </div>
        </FadeIn>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.06] py-10 px-6 sm:px-10 lg:px-16">
        <div className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center">
              <Briefcase className="h-3 w-3 text-zinc-400" />
            </div>
            <span className="text-sm text-zinc-500 font-medium">JobHunt</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="https://github.com/Chai-B/JobHunt" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-300 transition-colors duration-300">
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <Link href="/login" className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-300 transition-colors duration-300">
              Dashboard
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="text-xs text-zinc-700">
            Built by Chaitanya Bansal
          </div>
        </div>
      </footer>
    </div>
  );
}
