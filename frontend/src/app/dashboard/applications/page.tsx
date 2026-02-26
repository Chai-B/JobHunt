"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronDown,
    ExternalLink,
    MapPin,
    Calendar,
    Settings,
    RefreshCw,
    Activity,
    Briefcase,
    Clock,
    XCircle,
    Search
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/config";
import { toast } from "sonner";

// --- Components ---

const TimelineNode = ({ date, sender, subject, status, id }: any) => (
    <div className="relative pl-8 pb-8 last:pb-0 group/node">
        <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-primary bg-background z-10 group-hover/node:scale-125 transition-transform duration-300" />
        <div className="absolute left-[5px] top-4 w-[2px] h-full bg-border group-last/node:hidden" />

        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest text-left">
                <Calendar className="w-3 h-3" /> {date}
                {id && <span className="opacity-0 group-hover/node:opacity-100 transition-opacity">ID: {id}</span>}
            </div>
            <div className="text-sm font-medium text-foreground leading-tight text-left">
                {sender} <span className="text-muted-foreground/60 font-normal ml-1">— {subject}</span>
            </div>
            <Badge variant="outline" className="w-fit text-[9px] h-4 px-1.5 border-border uppercase tracking-tighter mt-1 bg-secondary/30">
                {status}
            </Badge>
        </div>
    </div>
);

export default function ApplicationsPage() {
    const [applications, setApplications] = useState<any[]>([]);
    const [resumes, setResumes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showConfig, setShowConfig] = useState(false);
    const [defaultResume, setDefaultResume] = useState("");
    const [autoApplyMode, setAutoApplyMode] = useState("manual");
    const [searchQuery, setSearchQuery] = useState("");

    // Pagination
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    const fetchApplications = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const [appsRes, resumesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/v1/applications/?skip=${(page - 1) * pageSize}&limit=${pageSize}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_BASE_URL}/api/v1/resumes/`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            if (appsRes.ok) {
                const data = await appsRes.json();
                if (data.items) {
                    setApplications(data.items);
                    setTotal(data.total);
                } else {
                    setApplications(data);
                    setTotal(data.length);
                }
            }
            if (resumesRes.ok) {
                const data = await resumesRes.json();
                setResumes(data.items || data);
            }
        } catch (err) {
            toast.error("Failed to load application data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, [page, pageSize]);

    const syncInbox = async () => {
        const loadingToast = toast.loading("Syncing Intelligence...");
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/logs/inbox-sync`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("Intelligence Synchronized", { id: loadingToast });
                fetchApplications();
            } else {
                toast.error("Sync Failed", { id: loadingToast });
            }
        } catch (err) {
            toast.error("Network Error", { id: loadingToast });
        }
    };

    const onUpdateStatus = async (id: number, status: string) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/applications/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                toast.success(`Application marked as ${status}`);
                fetchApplications();
            }
        } catch (err) {
            toast.error("Update failed");
        }
    };

    const getStatusBadge = (status: string) => {
        const base = "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border shadow-sm";
        switch (status?.toLowerCase()) {
            case "applied": return <Badge className={`${base} bg-blue-500/10 text-blue-500 border-blue-500/20`}>Applied</Badge>;
            case "interviewed": return <Badge className={`${base} bg-purple-500/10 text-purple-500 border-purple-500/20`}>Interviewed</Badge>;
            case "assessment": return <Badge className={`${base} bg-amber-500/10 text-amber-500 border-amber-500/20`}>Assessment</Badge>;
            case "rejected": return <Badge className={`${base} bg-destructive/10 text-destructive border-destructive/20`}>Rejected</Badge>;
            case "selected": return <Badge className={`${base} bg-emerald-500/10 text-emerald-500 border-emerald-500/20`}>Selected</Badge>;
            default: return <Badge className={`${base} bg-secondary text-muted-foreground border-border`}>{status || "Unknown"}</Badge>;
        }
    };

    const filteredApplications = applications.filter(app =>
        app.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.contact_role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.job_title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const labelClass = "text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold mb-2 flex items-center";

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-left">
                <div>
                    <h1 className="text-4xl font-medium tracking-tight text-foreground flex items-center gap-4">
                        <Activity className="h-8 w-8 text-primary" />
                        Application
                    </h1>
                    <p className="text-muted-foreground mt-2 text-base max-w-lg leading-relaxed">
                        High-precision status tracking powered by LLM-powered inbox intelligence.
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
                            <CardHeader className="border-b border-border/50 pb-6 px-8 py-8 text-left">
                                <CardTitle className="text-foreground text-xl font-medium">Pipeline Configuration</CardTitle>
                                <CardDescription className="text-muted-foreground">Adjust your automation and synchronization parameters.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8">
                                <div className="grid md:grid-cols-3 gap-8">
                                    <div className="space-y-3 text-left">
                                        <Label className={labelClass}>Default Narrative Resume</Label>
                                        <Select value={defaultResume} onValueChange={setDefaultResume}>
                                            <SelectTrigger className="bg-background/50 border-border h-12 rounded-xl text-left">
                                                <SelectValue placeholder="Match resume..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {resumes.map((r: any) => (
                                                    <SelectItem key={r.id} value={String(r.id)}>{r.filename || `Resume #${r.id}`}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-3 text-left">
                                        <Label className={labelClass}>Execution Strategy</Label>
                                        <Select value={autoApplyMode} onValueChange={setAutoApplyMode}>
                                            <SelectTrigger className="bg-background/50 border-border h-12 rounded-xl text-left">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="manual">Manual Batching</SelectItem>
                                                <SelectItem value="auto_queue" disabled>Autonomous (Daily)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-end text-left">
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

            {/* Search & Stats */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <Input
                        placeholder="Search company, role..."
                        className="pl-12 h-12 rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" /> {total} Applications
                    </span>
                </div>
            </div>

            {/* Main Application Table */}
            <Card className="bg-card/30 backdrop-blur-xl border-border/50 shadow-xl rounded-3xl overflow-hidden mt-6">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-40 flex flex-col items-center justify-center text-muted-foreground gap-6">
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="p-4 bg-secondary/50 rounded-full border border-border">
                                <RefreshCw className="w-8 h-8 opacity-40" />
                            </motion.div>
                            <span className="text-sm font-medium tracking-widest uppercase opacity-40">Calculating Pipeline...</span>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-secondary/20 border-b border-border/50 text-left">
                                        <TableRow className="hover:bg-transparent text-foreground">
                                            <TableHead className="w-[80px] px-8">ID</TableHead>
                                            <TableHead>Company</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead className="text-right px-8">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredApplications.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="py-20 text-center text-muted-foreground">
                                                    No applications found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredApplications.map((app) => (
                                                <React.Fragment key={app.id}>
                                                    <TableRow
                                                        className={`hover:bg-primary/5 transition-colors cursor-pointer border-border/40 text-left ${expandedRow === app.id ? 'bg-primary/5 border-b-transparent' : ''}`}
                                                        onClick={() => setExpandedRow(expandedRow === app.id ? null : app.id)}
                                                    >
                                                        <TableCell className="px-8 font-mono text-xs text-muted-foreground/50">#{app.id}</TableCell>
                                                        <TableCell className="font-semibold">{app.company_name}</TableCell>
                                                        <TableCell className="text-sm text-foreground/80">{app.contact_role || app.job_title || "General Application"}</TableCell>
                                                        <TableCell>{getStatusBadge(app.status)}</TableCell>
                                                        <TableCell className="text-muted-foreground text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <MapPin className="w-3.5 h-3.5 opacity-50" /> {app.location || "N/A"}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right px-8">
                                                            <Button variant="ghost" size="icon" className="rounded-full">
                                                                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expandedRow === app.id ? 'rotate-180' : ''}`} />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                    <AnimatePresence>
                                                        {expandedRow === app.id && (
                                                            <TableRow className="bg-primary/5 hover:bg-primary/5 border-border/40 text-left">
                                                                <TableCell colSpan={6} className="p-0 border-t border-border/20">
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: "auto", opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        className="overflow-hidden bg-background/30"
                                                                    >
                                                                        <div className="p-12 grid lg:grid-cols-2 gap-16">
                                                                            <div className="space-y-10">
                                                                                <div className="space-y-4">
                                                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/80">
                                                                                        <Clock className="w-4 h-4" /> Interaction Timeline
                                                                                    </div>
                                                                                    <div className="mt-8 border-l border-border/50 ml-1.5">
                                                                                        {(app.notes?.match(/\[(.*?)\] (.*?): (.*?)  -> \(Status: (.*?)\) \[ID: (.*?)\]/g) || []).reverse().map((m: any, idx: number) => {
                                                                                            const parts = m.match(/\[(.*?)\] (.*?): (.*?)  -> \(Status: (.*?)\) \[ID: (.*?)\]/);
                                                                                            return <TimelineNode key={idx} date={parts[1]} sender={parts[2]} subject={parts[3]} status={parts[4]} id={parts[5]} />;
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="space-y-10">
                                                                                <div className="p-8 rounded-3xl bg-card border border-border/50 shadow-inner space-y-8">
                                                                                    <div className="space-y-4">
                                                                                        <h4 className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/40">Recruiter Profile</h4>
                                                                                        <div className="grid grid-cols-2 gap-8">
                                                                                            <div className="flex flex-col gap-1">
                                                                                                <span className="text-[10px] text-muted-foreground uppercase opacity-50">Name</span>
                                                                                                <span className="text-sm font-medium">{app.contact_name || "Automated"}</span>
                                                                                            </div>
                                                                                            <div className="flex flex-col gap-1">
                                                                                                <span className="text-[10px] text-muted-foreground uppercase opacity-50">Email</span>
                                                                                                <span className="text-sm font-medium truncate">{app.contact_email || "N/A"}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="pt-8 border-t border-border/50 flex justify-between items-center">
                                                                                        <div className="flex items-center gap-4">
                                                                                            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => onUpdateStatus(app.id, "rejected")}>
                                                                                                <XCircle className="w-4 h-4 mr-2" /> Archive
                                                                                            </Button>
                                                                                            {app.source_url && (
                                                                                                <a href={app.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-2 hover:underline">
                                                                                                    View Listing <ExternalLink className="w-4 h-4" />
                                                                                                </a>
                                                                                            )}
                                                                                        </div>
                                                                                        <Badge variant="outline" className="text-[10px] uppercase">{app.application_type || "Standard"}</Badge>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </AnimatePresence>
                                                </React.Fragment>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-6 border-t border-border/50">
                                <Pagination
                                    currentPage={page}
                                    totalCount={total}
                                    pageSize={pageSize}
                                    onPageChange={setPage}
                                    disabled={loading}
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
