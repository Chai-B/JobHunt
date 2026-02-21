"use client";
import { API_BASE_URL } from "@/lib/config";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Briefcase, FileText, Send, Mail, Settings, LogOut, UserCircle, Globe, TerminalSquare, Zap, Activity } from "lucide-react";
import { toast } from "sonner";

const navigation = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
    { name: "Scraper", href: "/dashboard/scraper", icon: Globe },
    { name: "Applications", href: "/dashboard/applications", icon: Send },
    { name: "Cold Mail", href: "/dashboard/cold-mail", icon: Zap },
    { name: "Templates", href: "/dashboard/templates", icon: Mail },
    { name: "Resumes", href: "/dashboard/resumes", icon: FileText },
    { name: "Profile", href: "/dashboard/profile", icon: UserCircle },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
    { name: "Logs", href: "/dashboard/logs", icon: TerminalSquare },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [runningProcesses, setRunningProcesses] = useState<any[]>([]);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem("token");
            if (!token) {
                router.push("/");
                return;
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) throw new Error("Auth failed");

                const userData = await res.json();
                setUser(userData);
            } catch (err) {
                localStorage.removeItem("token");
                router.push("/");
            }
        };
        checkAuth();
    }, [router]);

    // Poll for running background processes
    useEffect(() => {
        if (!user) return;

        const fetchRunning = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/v1/logs/?status=running`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setRunningProcesses(Array.isArray(data) ? data.filter((l: any) => l.status === "running") : []);
                }
            } catch { }
        };

        fetchRunning();
        const interval = setInterval(fetchRunning, 5000);
        return () => clearInterval(interval);
    }, [user]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        toast.info("Logged out successfully");
        router.push("/");
    };

    if (!user) return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <TerminalSquare className="h-6 w-6 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">Loading Workspace</p>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-background text-foreground font-sans selection:bg-secondary">
            {/* Sidebar */}
            <div className="w-64 border-r border-border bg-card px-4 py-8 flex flex-col justify-between relative z-10">
                <div>
                    <div className="flex items-center gap-3 px-2 mb-10">
                        <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center border border-border">
                            <TerminalSquare className="h-4 w-4 text-foreground" />
                        </div>
                        <h1 className="text-xl font-semibold tracking-tight text-foreground">JobHunt</h1>
                    </div>
                    <nav className="space-y-1">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            // Exact match for overview, otherwise prefix match
                            const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Background Process Indicator + User */}
                <div className="px-3 pb-2 pt-6 border-t border-border mt-8 space-y-3">
                    {runningProcesses.length > 0 && (
                        <Link href="/dashboard/logs" className="flex items-center gap-2.5 bg-secondary/80 py-2 px-3 rounded-md border border-border hover:bg-secondary transition-colors">
                            <Activity className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                            <span className="text-xs font-medium text-foreground truncate">
                                {runningProcesses.length} process{runningProcesses.length > 1 ? 'es' : ''} running
                            </span>
                        </Link>
                    )}
                    <div className="text-xs text-muted-foreground truncate font-medium bg-secondary py-2 px-3 rounded-md border border-border">{user.email}</div>
                    <button
                        onClick={handleLogout}
                        className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors"
                    >
                        <LogOut className="h-4 w-4 transition-colors" />
                        Log out
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto w-full p-10 bg-background relative">
                <div className="max-w-[1400px] mx-auto z-10 relative">
                    {children}
                </div>
            </main>
        </div>
    );
}
