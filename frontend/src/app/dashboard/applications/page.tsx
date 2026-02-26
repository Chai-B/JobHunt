"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PlayCircle, CheckCircle, Flag, XCircle, Mail, Send, Activity, Briefcase, Settings, Info, Zap, RefreshCw } from "lucide-react";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed">
            {text}
        </span>
    </span>
);

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

    const bulkAutoApply = async () => {
        const prepared = applications.filter((a: any) => a.status === "prepared");
        if (prepared.length === 0) {
            toast.error("No prepared applications to auto-apply.");
            return;
        }
        for (const app of prepared) {
            await autoApply(app.id);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "shortlisted": return <Badge variant="secondary" className="bg-secondary text-muted-foreground border-border">Awaiting Review</Badge>;
            case "prepared": return <Badge variant="outline" className="border-border text-foreground">Ready to Apply</Badge>;
            case "processing": return <Badge variant="outline" className="border-foreground text-foreground animate-pulse">Processing...</Badge>;
            case "applied":
            case "submitted": return <Badge variant="default" className="bg-foreground text-background">Applied</Badge>;
            case "interviewing": return <Badge variant="default" className="bg-primary text-primary-foreground border-primary">Interviewing</Badge>;
            case "offer": return <Badge variant="default" className="bg-green-600/90 hover:bg-green-600 text-white border-green-700">Offer Received</Badge>;
            case "rejected": return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">Rejected</Badge>;
            case "error": return <Badge variant="destructive" className="bg-destructive text-destructive-foreground">Error</Badge>;
            case "acknowledged": return <Badge variant="outline" className="border-border text-foreground font-medium">Acknowledged</Badge>;
            case "responded": return <Badge variant="default" className="bg-foreground text-background">Lead Captured</Badge>;
            case "closed": return <Badge variant="secondary" className="bg-secondary text-muted-foreground">Closed</Badge>;
            default: return <Badge variant="secondary" className="bg-secondary text-muted-foreground">{status}</Badge>;
        }
    };

    const preparedCount = applications.filter((a: any) => a.status === "prepared").length;
    const labelClass = "text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center";

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-medium tracking-tight text-foreground flex items-center gap-3">
                        <Send className="h-6 w-6" />
                        Applications
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Track and manage your application pipeline.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={syncInbox} className="gap-2 border-border text-foreground hover:bg-secondary rounded-lg">
                        <RefreshCw className="w-3.5 h-3.5" /> Sync Inbox
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)} className="gap-2 border-border text-foreground rounded-lg">
                        <Settings className="w-3.5 h-3.5" /> Config
                    </Button>
                    {preparedCount > 0 && (
                        <Button size="sm" onClick={bulkAutoApply} className="gap-2 bg-foreground text-background hover:opacity-90 rounded-lg shadow-md">
                            <Zap className="w-3.5 h-3.5" /> Auto ({preparedCount})
                        </Button>
                    )}
                </div>
            </div>

            {/* Auto-Apply Configuration */}
            {showConfig && (
                <Card className="bg-card border-border shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <CardHeader className="border-b border-border pb-5">
                        <CardTitle className="text-foreground text-lg font-medium">Auto-Apply Configuration</CardTitle>
                        <CardDescription className="text-muted-foreground">Configure how the AI handles applications on your behalf.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid md:grid-cols-3 gap-6">
                            <div>
                                <Label className={labelClass}>
                                    Default Resume <Tip text="When auto-applying, this resume will be used if no specific resume is selected for the application." />
                                </Label>
                                <Select value={defaultResume} onValueChange={setDefaultResume}>
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue placeholder="Select default resume" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground">
                                        {resumes.map((r: any) => (
                                            <SelectItem key={r.id} value={String(r.id)}>{r.filename || `Resume #${r.id}`}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className={labelClass}>
                                    Apply Mode <Tip text="'Manual' requires you to click the button per application. 'Auto-Queue' auto-applies to prepared jobs daily." />
                                </Label>
                                <Select value={autoApplyMode} onValueChange={setAutoApplyMode}>
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground">
                                        <SelectItem value="manual">Manual Dispatch</SelectItem>
                                        <SelectItem value="auto_queue" disabled>Auto-Queue (Daily) — Coming Soon</SelectItem>
                                        <SelectItem value="aggressive" disabled>Aggressive (Immediate) — Coming Soon</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <Button variant="outline" onClick={() => { toast.success("Auto-Apply configuration saved."); setShowConfig(false); }} className="w-full border-border text-foreground hover:bg-secondary">
                                    Save Configuration
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-5 mt-6">
                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center text-muted-foreground">
                        <Activity className="w-6 h-6 animate-pulse mb-4" />
                        <span className="text-sm">Loading applications...</span>
                    </div>
                ) : applications.length === 0 ? (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center bg-secondary/30 rounded-xl border border-dashed border-border">
                        <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4 border border-border">
                            <Briefcase className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-medium text-foreground mb-2">Pipeline Empty</h3>
                        <p className="text-sm text-muted-foreground text-center max-w-sm">Match a Job with a Resume in the Jobs page to start an application.</p>
                    </div>
                ) : (
                    applications.map((app: any) => (
                        <Card key={app.id} className="flex flex-col sm:flex-row justify-between items-center py-5 px-6 gap-6 bg-card border-border shadow-sm hover:shadow-md transition-shadow group overflow-hidden relative">
                            <div className="flex-1 w-full relative z-10">
                                <div className="flex items-center gap-4 mb-2">
                                    {getStatusBadge(app.status)}
                                    <span className="text-xs text-muted-foreground font-mono tracking-wider">APP-ID: #{app.id}</span>
                                    {app.status === "processing" && (
                                        <span className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
                                            <Activity className="w-3 h-3 animate-pulse" /> Running in background
                                        </span>
                                    )}
                                </div>
                                <div className="text-xl font-medium text-foreground mb-1">
                                    {app.job_title || `Job ID: ${app.job_id}`}
                                    {app.company_name && <span className="text-muted-foreground ml-2">@ {app.company_name}</span>}
                                </div>
                                <div className="text-sm flex gap-4 text-muted-foreground">
                                    <span>Type: <span className="text-foreground font-medium">{app.application_type || "Standard"}</span></span>
                                    <span>Resume: <span className="text-foreground font-medium">#{app.resume_id || 'NULL'}</span></span>
                                </div>
                                {app.status === "submitted" && app.notes && (
                                    <div className="mt-4 p-4 bg-secondary/50 rounded-md border border-border text-foreground font-mono text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                                        <span className="text-foreground font-medium mb-2 block">{'// AUTO-APPLY COVER LETTER'}</span>
                                        {app.notes}
                                    </div>
                                )}
                                {app.status === "error" && app.notes && (
                                    <div className="mt-4 p-4 bg-destructive/10 text-destructive text-xs rounded-md border border-destructive/20 font-mono flex flex-col gap-1">
                                        <span className="font-medium">Execution Error:</span>
                                        {app.notes}
                                    </div>
                                )}
                            </div>

                            {/* Action State Machine Controls */}
                            <div className="flex flex-wrap sm:flex-col lg:flex-row gap-3 w-full sm:w-auto relative z-10">
                                {app.status === "shortlisted" && (
                                    <Button size="sm" variant="outline" className="w-full sm:w-auto bg-transparent border-border text-foreground hover:bg-secondary transition-colors" onClick={() => updateStatus(app.id, "prepared")}>
                                        <PlayCircle className="w-4 h-4 mr-2" /> Prepare Application
                                    </Button>
                                )}
                                {app.status === "prepared" && (
                                    <Button size="sm" className="w-full sm:w-auto bg-foreground hover:opacity-90 text-background transition-opacity" onClick={() => autoApply(app.id)}>
                                        <Mail className="w-4 h-4 mr-2" /> Dispatch Auto-Apply
                                    </Button>
                                )}
                                {app.status === "submitted" && (
                                    <Button size="sm" variant="outline" className="w-full sm:w-auto bg-transparent border-border text-foreground hover:bg-secondary font-medium" onClick={() => updateStatus(app.id, "acknowledged")}>
                                        <CheckCircle className="w-4 h-4 mr-2" /> Mark Acknowledged
                                    </Button>
                                )}
                                {app.status === "acknowledged" && (
                                    <Button size="sm" className="w-full sm:w-auto bg-foreground hover:opacity-90 text-background transition-opacity" onClick={() => updateStatus(app.id, "responded")}>
                                        <Flag className="w-4 h-4 mr-2" /> Interview Request
                                    </Button>
                                )}
                                {app.status !== "closed" && (
                                    <Button size="sm" variant="ghost" className="w-full sm:w-auto text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" onClick={() => updateStatus(app.id, "closed")}>
                                        <XCircle className="w-4 h-4 mr-2 sm:mr-0 opacity-70" />
                                        <span className="sm:hidden">Close Application</span>
                                    </Button>
                                )}
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
