"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronDown,
    ExternalLink,
    Globe,
    MapPin,
    User as UserIcon,
    Calendar,
    MessageSquare,
    Clock,
    Briefcase,
    Activity,
    PlayCircle,
    Mail,
    CheckCircle,
    XCircle,
    RefreshCw,
    Zap,
    Settings
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { API_BASE_URL } from "@/lib/config";
import { toast } from "sonner";

// --- Components ---

const TimelineNode = ({ date, sender, subject, status, id }: any) => (
    <div className="relative pl-8 pb-8 last:pb-0 group/node">
        <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-primary bg-background z-10 group-hover/node:scale-125 transition-transform duration-300" />
        <div className="absolute left-[5px] top-4 w-[2px] h-full bg-border group-last/node:hidden" />

        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                <Calendar className="w-3 h-3" /> {date}
                {id && <span className="opacity-0 group-hover/node:opacity-100 transition-opacity">ID: {id}</span>}
            </div>
            <div className="text-sm font-medium text-foreground leading-tight">
                {sender} <span className="text-muted-foreground/60 font-normal ml-1">— {subject}</span>
            </div>
            <Badge variant="outline" className="w-fit text-[9px] h-4 px-1.5 border-border uppercase tracking-tighter mt-1 bg-secondary/30">
                {status}
            </Badge>
        </div>
    </div>
);

const ApplicationCard = ({ app, getStatusBadge, onUpdateStatus, onAutoApply }: any) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Parse timeline from notes
    const timelineMatches = app.notes ? [...app.notes.matchAll(/\[(.*?)\] (.*?): (.*?)  -> \(Status: (.*?)\) \[ID: (.*?)\]/g)] : [];
    const timeline = timelineMatches.map(m => ({
        date: m[1],
        sender: m[2],
        subject: m[3],
        status: m[4],
        id: m[5]
    })).reverse(); // Newest first

    const rawNotes = app.notes ? app.notes.replace(/\[.*?\] .*? -> \(Status: .*?\) \[ID: .*?\]/g, '').trim() : '';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`group relative overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-md transition-all duration-500 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 ${isExpanded ? 'ring-1 ring-primary/20' : ''}`}
        >
            <div
                className="p-6 cursor-pointer flex flex-col md:flex-row items-center justify-between gap-6"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex-1 space-y-3 w-full">
                    <div className="flex items-center gap-3">
                        {getStatusBadge(app.status)}
                        <span className="text-[10px] font-mono text-muted-foreground/40 tracking-widest uppercase">#{app.id}</span>
                        {app.status === "processing" && (
                            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }} className="flex items-center gap-1.5 text-[10px] text-primary uppercase font-bold tracking-tighter">
                                <Activity className="w-3 h-3" /> Syncing...
                            </motion.div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-xl font-medium tracking-tight text-foreground flex items-center gap-2 group-hover:text-primary transition-colors duration-300">
                            {app.contact_role || app.job_title || "General Application"}
                            {app.source_url && (
                                <a href={app.source_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 hover:bg-secondary rounded-md transition-colors">
                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                </a>
                            )}
                        </h3>
                        <p className="text-muted-foreground text-sm flex items-center gap-2">
                            <Briefcase className="w-3.5 h-3.5 opacity-50" />
                            {app.company_name || "Unknown Company"}
                            {app.location && <><span className="opacity-30">|</span> <MapPin className="w-3.5 h-3.5 opacity-50 text-primary/60" /> {app.location}</>}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                    <div className="hidden lg:flex flex-col items-end gap-1">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">Primary Contact</span>
                        <div className="flex items-center gap-2 text-sm text-foreground">
                            {app.contact_name || "Automated System"}
                            <UserIcon className="w-3.5 h-3.5 text-primary opacity-60" />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`rounded-full transition-transform duration-500 ${isExpanded ? 'rotate-180 bg-secondary' : 'bg-secondary/20'}`}
                        >
                            <ChevronDown className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="border-t border-border/50 bg-secondary/5"
                    >
                        <div className="p-8 grid lg:grid-cols-[1fr_350px] gap-12">
                            {/* Left Col: Timeline & Notes */}
                            <div className="space-y-10">
                                {timeline.length > 0 && (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary/80">
                                            <Clock className="w-4 h-4" /> Interaction Timeline
                                        </div>
                                        <div className="mt-6">
                                            {timeline.map((node: any, idx: number) => (
                                                <TimelineNode key={idx} {...node} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {rawNotes && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                            <MessageSquare className="w-4 h-4" /> Correspondence
                                        </div>
                                        <div className="p-6 bg-card border border-border rounded-2xl text-xs font-mono leading-relaxed text-foreground/80 whitespace-pre-wrap shadow-inner">
                                            {rawNotes}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 flex flex-wrap gap-4">
                                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 rounded-full" onClick={() => onUpdateStatus(app.id, "rejected")}>
                                        <XCircle className="w-4 h-4 mr-2" /> Archive / Reject
                                    </Button>
                                </div>
                            </div>

                            {/* Right Col: Meta & Contact */}
                            <div className="space-y-8">
                                <div className="p-6 rounded-2xl bg-card border border-border space-y-6">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">Professional Contact</h4>
                                        <div className="space-y-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-muted-foreground">Name</span>
                                                <span className="text-sm font-medium">{app.contact_name || "N/A"}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs text-muted-foreground">Email</span>
                                                <span className="text-sm font-medium">{app.contact_email || "N/A"}</span>
                                            </div>
                                            {app.contact_role && (
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-muted-foreground">Role</span>
                                                    <span className="text-sm font-medium">{app.contact_role}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-border">
                                        <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">Application Info</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground text-xs">Type</span>
                                                <Badge variant="outline" className="text-[10px]">{app.application_type || "Standard"}</Badge>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground text-xs">Resume ID</span>
                                                <span className="font-mono text-xs">#{app.resume_id || "None"}</span>
                                            </div>
                                            {app.source_url && (
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground text-xs">Source</span>
                                                    <a href={app.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs">
                                                        View Job <Globe className="w-3 h-3" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default function ApplicationsPage() {
    const [applications, setApplications] = useState<any[]>([]);
    const [resumes, setResumes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showConfig, setShowConfig] = useState(false);
    const [defaultResume, setDefaultResume] = useState("");
    const [autoApplyMode, setAutoApplyMode] = useState("manual");

    const fetchApplications = async () => {
        try {
            const token = localStorage.getItem("token");
            const [appsRes, resumesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/v1/applications/`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_BASE_URL}/api/v1/resumes/`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            if (appsRes.ok) {
                const data = await appsRes.json();
                setApplications(Array.isArray(data) ? data : []);
            }
            if (resumesRes.ok) {
                const data = await resumesRes.json();
                setResumes(Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []));
            }
        } catch (err) {
            toast.error("Failed to load applications pipeline");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, []);

    const updateStatus = async (appId: number, status: string) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/applications/${appId}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to update status");
            }

            toast.success(`Application updated to ${status.toUpperCase()}`);
            fetchApplications();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const autoApply = async (appId: number) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/applications/${appId}/auto-apply`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Auto-Apply failed");
            }

            toast.success(`Auto-Apply dispatched for Application #${appId}. Check Logs for progress.`);
            fetchApplications();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const syncInbox = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/applications/sync-inbox`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to trigger inbox sync.");
            toast.success("Inbox Scanner dispatched. Updates will appear shortly.");
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const bulkSync = async () => {
        await syncInbox();
    };

    const getStatusBadge = (status: string) => {
        const s = status.toLowerCase();
        switch (s) {
            case "applied": return <Badge variant="secondary" className="bg-secondary/30 text-muted-foreground border-border uppercase tracking-tighter text-[10px]">Applied</Badge>;
            case "interviewed": return <Badge variant="default" className="bg-primary/20 text-primary border-primary/20 hover:bg-primary/30 uppercase tracking-tighter text-[10px]">Interviewed</Badge>;
            case "assessment": return <Badge variant="outline" className="border-indigo-500/50 text-indigo-500 bg-indigo-500/5 uppercase tracking-tighter text-[10px]">Assessment</Badge>;
            case "selected": return <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/20 uppercase tracking-tighter text-[10px]">Selected</Badge>;
            case "rejected": return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/10 uppercase tracking-tighter text-[10px]">Rejected</Badge>;
            default: return <Badge variant="secondary" className="uppercase tracking-tighter text-[10px]">{status}</Badge>;
        }
    };

    const preparedCount = applications.filter((a: any) => a.status === "prepared").length;
    const labelClass = "text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold mb-2 flex items-center";

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-medium tracking-tight text-foreground flex items-center gap-4">
                        <Activity className="h-8 w-8 text-primary" />
                        Application
                    </h1>
                    <p className="text-muted-foreground mt-2 text-base max-w-lg leading-relaxed">
                        High-precision status tracking powered by heuristic inbox intelligence.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button variant="outline" size="lg" onClick={() => setShowConfig(!showConfig)} className="rounded-2xl border-border px-6 transition-all duration-300">
                        <Settings className="w-4 h-4" />
                    </Button>
                    <Button size="lg" onClick={syncInbox} className="gap-3 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl px-8 shadow-xl shadow-primary/20 transition-all duration-300">
                        <RefreshCw className="w-4 h-4" /> Sync Now
                    </Button>
                </div>
            </div>

            {/* Config Panel */}
            <AnimatePresence>
                {showConfig && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <Card className="bg-card/30 backdrop-blur-xl border-border/50 shadow-2xl rounded-3xl">
                            <CardHeader className="border-b border-border/50 pb-6 px-8 py-8">
                                <CardTitle className="text-foreground text-xl font-medium">Pipeline Configuration</CardTitle>
                                <CardDescription className="text-muted-foreground">Adjust your automation and synchronization parameters.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8">
                                <div className="grid md:grid-cols-3 gap-8">
                                    <div className="space-y-3">
                                        <Label className={labelClass}>Default Narrative Resume</Label>
                                        <Select value={defaultResume} onValueChange={setDefaultResume}>
                                            <SelectTrigger className="bg-background/50 border-border h-12 rounded-xl">
                                                <SelectValue placeholder="Match resume..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {resumes.map((r: any) => (
                                                    <SelectItem key={r.id} value={String(r.id)}>{r.filename || `Resume #${r.id}`}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-3">
                                        <Label className={labelClass}>Execution Strategy</Label>
                                        <Select value={autoApplyMode} onValueChange={setAutoApplyMode}>
                                            <SelectTrigger className="bg-background/50 border-border h-12 rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="manual">Manual Batching</SelectItem>
                                                <SelectItem value="auto_queue" disabled>Autonomous (Daily)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-end">
                                        <Button
                                            className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 shadow-lg"
                                            onClick={() => { toast.success("Configuration Optimized"); setShowConfig(false); }}
                                        >
                                            Apply Optimization
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Pipeline Grid */}
            <div className="grid gap-6">
                {loading ? (
                    <div className="py-40 flex flex-col items-center justify-center text-muted-foreground gap-6">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                            className="p-4 bg-secondary/50 rounded-full border border-border"
                        >
                            <RefreshCw className="w-8 h-8 opacity-40" />
                        </motion.div>
                        <span className="text-sm font-medium tracking-widest uppercase opacity-40">Calculating Pipeline...</span>
                    </div>
                ) : applications.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-40 flex flex-col items-center justify-center bg-secondary/10 rounded-[3rem] border border-dashed border-border"
                    >
                        <div className="h-20 w-20 bg-card rounded-3xl flex items-center justify-center mb-6 border border-border/50 shadow-inner">
                            <Briefcase className="w-8 h-8 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-2xl font-medium text-foreground mb-3">Narrative Initialized</h3>
                        <p className="text-base text-muted-foreground text-center max-w-md leading-relaxed">
                            No active applications detected. Trigger a Sync or match a job from the <span className="text-primary font-medium">Scraper</span> tab to begin.
                        </p>
                    </motion.div>
                ) : (
                    <div className="grid gap-6">
                        <AnimatePresence mode="popLayout">
                            {applications.map((app: any) => (
                                <ApplicationCard
                                    key={app.id}
                                    app={app}
                                    getStatusBadge={getStatusBadge}
                                    onUpdateStatus={updateStatus}
                                    onAutoApply={autoApply}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
