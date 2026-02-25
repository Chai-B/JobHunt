"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Send, Users, Activity, Info, RefreshCw, Zap } from "lucide-react";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-foreground bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed">
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

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}` };

            const [contactsRes, templatesRes, resumesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/v1/scraper/contacts`, { headers }),
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
            toast.success("Cold mail dispatched successfully!");
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
        setBatchSending(true);
        let sent = 0;
        for (const contact of contacts.slice(0, 10)) {
            try {
                const token = localStorage.getItem("token");
                await fetch(`${API_BASE_URL}/api/v1/scraper/dispatch-mail`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        contact_id: contact.id,
                        template_id: parseInt(selectedTemplate),
                        resume_id: parseInt(selectedResume)
                    })
                });
                sent++;
            } catch { }
        }
        setBatchSending(false);
        toast.success(`Batch complete: ${sent} emails dispatched.`);
    };

    const labelClass = "text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1.5 flex items-center";

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                        <Mail className="h-6 w-6" />
                        Cold Mailing
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Configure and send personalized cold emails to scraped contacts.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2 border-border text-foreground">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {/* Configuration Panel */}
            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="border-b border-border pb-5">
                    <CardTitle className="text-foreground text-lg font-semibold">Outreach Configuration</CardTitle>
                    <CardDescription className="text-muted-foreground">Select a template and resume to personalize your cold emails.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid md:grid-cols-3 gap-6">
                        <div>
                            <Label className={labelClass}>
                                Email Template <Tip text="Choose which email template the AI will use. Variables like {{job_title}} will be auto-filled from contact data." />
                            </Label>
                            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue placeholder="Select a template" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground">
                                    {templates.map((t: any) => (
                                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className={labelClass}>
                                Source Resume <Tip text="The AI will extract your skills and experience from this resume to personalize the outreach email." />
                            </Label>
                            <Select value={selectedResume} onValueChange={setSelectedResume}>
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue placeholder="Select a resume" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground">
                                    {resumes.map((r: any) => (
                                        <SelectItem key={r.id} value={String(r.id)}>{r.filename || `Resume #${r.id}`}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button
                                onClick={sendBatchMails}
                                disabled={batchSending || !selectedTemplate || !selectedResume || contacts.length === 0}
                                className="w-full bg-foreground text-background hover:opacity-90 gap-2"
                            >
                                <Zap className="w-4 h-4" />
                                {batchSending ? "Sending..." : `Batch Send (${Math.min(contacts.length, 10)})`}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Contacts Table */}
            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="border-b border-border pb-5">
                    <CardTitle className="text-foreground flex items-center gap-2"><Users className="w-5 h-5" /> Scraped Contacts</CardTitle>
                    <CardDescription className="text-muted-foreground">{contacts.length} contacts available for outreach.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                            <Activity className="w-6 h-6 animate-pulse mb-4" />
                            <span className="text-sm">Loading contacts...</span>
                        </div>
                    ) : contacts.length === 0 ? (
                        <div className="py-32 flex flex-col items-center justify-center text-muted-foreground">
                            <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4 border border-border">
                                <Users className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-2">No Contacts Found</h3>
                            <p className="text-sm text-center max-w-sm">Run the Scraper to extract contacts first.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-secondary/30">
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground font-medium">Email</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Name</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Company</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Role</TableHead>
                                        <TableHead className="text-right text-muted-foreground font-medium">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {contacts.map((c: any) => (
                                        <TableRow key={c.id} className="border-border hover:bg-secondary/50 transition-colors group">
                                            <TableCell className="font-mono text-xs text-foreground">{c.email}</TableCell>
                                            <TableCell className="text-muted-foreground">{c.name || "—"}</TableCell>
                                            <TableCell className="text-muted-foreground">{c.company || "—"}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{c.role || "—"}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-foreground border-border hover:bg-secondary text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => sendColdMail(c.id)}
                                                    disabled={sendingId === c.id || !selectedTemplate || !selectedResume}
                                                >
                                                    <Send className={`w-3 h-3 ${sendingId === c.id ? 'animate-spin' : ''}`} />
                                                    {sendingId === c.id ? "Sending..." : "Send"}
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
    );
}
