"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Send, Users, Activity, Info, RefreshCw, Zap, CheckCircle2, ChevronRight, MousePointer2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 text-xs text-foreground bg-card border border-border/50 rounded-xl shadow-2xl opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed backdrop-blur-md">
            {text}
        </span>
    </span>
);

export default function ColdMailPage() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [resumes, setResumes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [selectedResume, setSelectedResume] = useState("");
    const [sendingId, setSendingId] = useState<number | null>(null);
    const [batchSending, setBatchSending] = useState(false);

    // Selection state
    const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}` };

            const [contactsRes, templatesRes, resumesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/v1/contacts/`, { headers }),
                fetch(`${API_BASE_URL}/api/v1/templates/`, { headers }),
                fetch(`${API_BASE_URL}/api/v1/resumes/`, { headers }),
            ]);

            if (contactsRes.ok) {
                const data = await contactsRes.json();
                setContacts(Array.isArray(data) ? data : []);
            }
            if (templatesRes.ok) {
                const data = await templatesRes.json();
                setTemplates(Array.isArray(data) ? data : []);
            }
            if (resumesRes.ok) {
                const data = await resumesRes.json();
                setResumes(Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []));
            }
        } catch (err) {
            toast.error("Failed to load outreach data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleSelectAll = () => {
        if (selectedContactIds.size === contacts.length) {
            setSelectedContactIds(new Set());
        } else {
            setSelectedContactIds(new Set(contacts.map(c => c.id)));
        }
    };

    const toggleSelectContact = (id: number) => {
        const newSet = new Set(selectedContactIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedContactIds(newSet);
    };

    const sendColdMail = async (contactId: number) => {
        if (!selectedTemplate || !selectedResume) {
            toast.error("Select a template and resume first.");
            return;
        }
        setSendingId(contactId);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/scraper/dispatch-mail`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    contact_id: contactId,
                    template_id: parseInt(selectedTemplate),
                    resume_id: parseInt(selectedResume)
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Cold mail failed.");
            }
            toast.success("Outreach email initiated.");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSendingId(null);
        }
    };

    const sendBatchMails = async () => {
        if (!selectedTemplate || !selectedResume) {
            toast.error("Select a template and resume first.");
            return;
        }
        if (selectedContactIds.size === 0) {
            toast.error("Select recipients first.");
            return;
        }

        setBatchSending(true);
        let sent = 0;
        let failed = 0;

        const idsToBatch = Array.from(selectedContactIds);
        for (const id of idsToBatch) {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/v1/scraper/dispatch-mail`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        contact_id: id,
                        template_id: parseInt(selectedTemplate),
                        resume_id: parseInt(selectedResume)
                    })
                });
                if (res.ok) sent++;
                else failed++;
            } catch {
                failed++;
            }
        }
        setBatchSending(false);
        toast.success(`Batch Complete: ${sent} Sent, ${failed} Failed.`);
        setSelectedContactIds(new Set()); // Clear selection after batch
    };

    const labelClass = "text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold mb-2 flex items-center";

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 relative pb-24">
            <div className="flex justify-between items-end">
                <div>
                    <Badge variant="outline" className="mb-3 border-primary/20 bg-primary/5 text-primary-foreground text-[10px] uppercase tracking-widest px-3">Engine Active</Badge>
                    <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-3 font-sans">
                        <Mail className="h-8 w-8 text-primary" />
                        Outreach Outbound
                    </h1>
                    <p className="text-muted-foreground mt-2 text-base max-w-xl">Scale your personal reach by targeting high-value contacts with AI-crafted communications.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading} className="gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Contacts
                </Button>
            </div>

            <div className="grid lg:grid-cols-12 gap-8 items-start">
                {/* Configuration Panel */}
                <Card className="lg:col-span-4 bg-card/60 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl overflow-hidden self-start sticky top-24">
                    <CardHeader className="border-b border-border/50 pb-6 bg-secondary/10">
                        <CardTitle className="text-lg font-bold">Campaign Presets</CardTitle>
                        <CardDescription className="text-xs">Define the assets for this outbound wave.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8 space-y-8">
                        <div className="space-y-6">
                            <div>
                                <Label className={labelClass}>
                                    Messaging Template <Tip text="Select the base template. The AI will weave in contact-specific nuances for maximum conversion." />
                                </Label>
                                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                                    <SelectTrigger className="bg-background/50 border-border/50 text-foreground h-12 rounded-xl focus:ring-primary/20">
                                        <SelectValue placeholder="Choose a template" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border/50 text-foreground rounded-xl shadow-2xl">
                                        {templates.map((t: any) => (
                                            <SelectItem key={t.id} value={String(t.id)} className="rounded-lg">{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className={labelClass}>
                                    Strategic Resume <Tip text="This resume provides the skill-context for AI personality matching." />
                                </Label>
                                <Select value={selectedResume} onValueChange={setSelectedResume}>
                                    <SelectTrigger className="bg-background/50 border-border/50 text-foreground h-12 rounded-xl focus:ring-primary/20">
                                        <SelectValue placeholder="Choose a resume" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border/50 text-foreground rounded-xl shadow-2xl">
                                        {resumes.map((r: any) => (
                                            <SelectItem key={r.id} value={String(r.id)} className="rounded-lg">{r.filename || `Resume #${r.id}`}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="pt-4">
                            <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-3">
                                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-primary/70">
                                    <span>Batch Ready</span>
                                    <span>{selectedContactIds.size} Leads</span>
                                </div>
                                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-500"
                                        style={{ width: `${contacts.length ? (selectedContactIds.size / contacts.length) * 100 : 0}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-snug">Ensure template variables match your contact data for optimal delivery.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Contacts Table */}
                <Card className="lg:col-span-8 bg-card/60 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-border/50 pb-6 bg-secondary/10">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-bold flex items-center gap-3">
                                <Users className="w-5 h-5 text-primary/70" />
                                Lead Collection
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-32 flex flex-col items-center justify-center text-muted-foreground">
                                <Activity className="w-8 h-8 animate-spin text-primary/40 mb-5" />
                                <span className="text-sm font-medium uppercase tracking-widest opacity-50">Syncing database...</span>
                            </div>
                        ) : contacts.length === 0 ? (
                            <div className="py-40 flex flex-col items-center justify-center text-muted-foreground text-center px-10">
                                <div className="h-20 w-20 bg-secondary/50 rounded-3xl flex items-center justify-center mb-6 border border-border/50 shadow-inner">
                                    <MousePointer2 className="w-8 h-8 text-muted-foreground/30" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-3 font-sans">No Leads Identified</h3>
                                <p className="text-sm text-balance max-w-sm opacity-60 leading-relaxed">
                                    Use the Universal Extractor to bridge external lists into your outbound pipeline.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-secondary/20">
                                        <TableRow className="border-border/40 hover:bg-transparent">
                                            <TableHead className="w-16 px-6">
                                                <Checkbox
                                                    checked={selectedContactIds.size === contacts.length && contacts.length > 0}
                                                    onCheckedChange={toggleSelectAll}
                                                    className="rounded-md border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                />
                                            </TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 py-4">Identity & Reach</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 py-4">Professional Context</TableHead>
                                            <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 py-4 pr-8">Precision Send</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {contacts.map((c: any) => (
                                            <TableRow
                                                key={c.id}
                                                className={`border-border/20 transition-all duration-300 group ${selectedContactIds.has(c.id) ? 'bg-primary/5 hover:bg-primary/[0.08]' : 'hover:bg-secondary/40'}`}
                                            >
                                                <TableCell className="px-6">
                                                    <Checkbox
                                                        checked={selectedContactIds.has(c.id)}
                                                        onCheckedChange={() => toggleSelectContact(c.id)}
                                                        className="rounded-md border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
                                                    />
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-mono text-[13px] text-foreground font-medium group-hover:text-primary transition-colors">{c.email}</span>
                                                        <span className="text-xs text-muted-foreground/70 font-sans">{c.name || "Unnamed Lead"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-foreground/90">{c.company}</span>
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-500/30" />
                                                        </div>
                                                        <Badge variant="outline" className="w-fit text-[10px] rounded-md px-1.5 py-0 border-border/30 bg-background/30 text-muted-foreground/80 font-normal">
                                                            {c.role || "Role Unmapped"}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-foreground border-border/50 hover:bg-primary hover:text-primary-foreground text-[11px] font-bold rounded-xl h-9 px-4 gap-2 transition-all opacity-0 group-hover:opacity-100 hover:scale-105"
                                                        onClick={() => sendColdMail(c.id)}
                                                        disabled={sendingId === c.id || !selectedTemplate || !selectedResume}
                                                    >
                                                        {sendingId === c.id ? <Activity className="w-3 h-3 animate-pulse" /> : <Send className="w-3 h-3" />}
                                                        {sendingId === c.id ? "Working..." : "Dispatch"}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Sticky Floating Action Bar for Selection */}
            {selectedContactIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-500">
                    <div className="flex items-center gap-6 px-8 py-4 bg-background/60 backdrop-blur-2xl border border-primary/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                        <div className="flex items-center gap-4 border-r border-border/50 pr-6">
                            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                <Zap className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-lg font-bold leading-none">{selectedContactIds.size} Target{selectedContactIds.size > 1 ? 's' : ''}</span>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-primary/70 mt-1">Batch Ready</span>
                            </div>
                        </div>
                        <Button
                            onClick={sendBatchMails}
                            disabled={batchSending || !selectedTemplate || !selectedResume}
                            className="bg-primary text-primary-foreground hover:opacity-90 rounded-xl px-8 py-6 h-auto font-bold text-base shadow-xl transition-all hover:scale-105 active:scale-95 gap-3"
                        >
                            {batchSending ? <Activity className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                            {batchSending ? "Processing wave..." : "Dispatch Batch Wave"}
                            {!batchSending && <ChevronRight className="w-4 h-4 opacity-50" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedContactIds(new Set())}
                            className="text-muted-foreground hover:text-foreground rounded-lg"
                        >
                            Cancel Selection
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
