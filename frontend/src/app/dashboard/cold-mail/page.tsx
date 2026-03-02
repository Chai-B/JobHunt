"use client";
import { API_BASE_URL } from "@/lib/config";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Send, Users, Activity, Info, RefreshCw, Zap, CheckCircle2, ChevronRight, MousePointer2, Search, Check, ChevronsUpDown, Eye, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Tip = ({ text }: { text: string }) => (
    <span className="relative inline-flex items-center ml-1.5 cursor-help group/tip">
        <Info className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/tip:text-foreground transition-colors" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 text-xs text-foreground bg-card border border-border/50 rounded-xl shadow-2xl opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed backdrop-blur-md">
            {text}
        </span>
    </span>
);

const ContactRow = React.memo(({ c, idx, isSelected, onToggle, onSend, sendingId, selectedTemplate, selectedResume, page, pageSize }: any) => {
    return (
        <TableRow
            className={`border-border/20 transition-all duration-300 group ${isSelected ? 'bg-primary/5 hover:bg-primary/[0.08]' : 'hover:bg-secondary/40'}`}
        >
            <TableCell className="px-4 text-center text-[10px] font-mono text-muted-foreground/40">
                {(page - 1) * pageSize + idx + 1}
            </TableCell>
            <TableCell className="px-6">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(c.id)}
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
                        <span className="text-xs font-medium text-foreground/90">{c.company}</span>
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
                    className="text-foreground border-border/50 hover:bg-primary hover:text-primary-foreground text-[11px] font-medium rounded-xl h-9 px-4 gap-2 transition-all hover:scale-105"
                    onClick={() => onSend(c.id)}
                    disabled={sendingId === c.id || !selectedTemplate || !selectedResume}
                >
                    {sendingId === c.id ? <Activity className="w-3 h-3 animate-pulse" /> : <Send className="w-3 h-3" />}
                    {sendingId === c.id ? "Working..." : "Dispatch"}
                </Button>
            </TableCell>
        </TableRow>
    );
});
ContactRow.displayName = "ContactRow";

export default function ColdMailPage() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [resumes, setResumes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [selectedResume, setSelectedResume] = useState("");
    const [templateOpen, setTemplateOpen] = useState(false);
    const [resumeOpen, setResumeOpen] = useState(false);
    const [sendingId, setSendingId] = useState<number | null>(null);
    const [batchSending, setBatchSending] = useState(false);
    const [contactScope, setContactScope] = useState("global");

    // Pagination state
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 50;

    // Selection state
    const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());

    // Search
    const [searchQuery, setSearchQuery] = useState("");

    // Validation & Profile
    const [userProfile, setUserProfile] = useState<any>(null);
    const [showValidationDialog, setShowValidationDialog] = useState(false);
    const [missingTags, setMissingTags] = useState<string[]>([]);
    const [attachResume, setAttachResume] = useState(true);
    const [manualTagValues, setManualTagValues] = useState<Record<string, string>>({});
    const [pendingDispatch, setPendingDispatch] = useState<{ type: 'single' | 'batch', id?: number } | null>(null);

    // Preview state
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewContactId, setPreviewContactId] = useState<number | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}` };

            const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
            const scopeParam = `&scope=${contactScope}`;

            const [contactsRes, templatesRes, resumesRes, profileRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/v1/contacts/?skip=${(page - 1) * pageSize}&limit=${pageSize}${searchParam}${scopeParam}`, { headers }),
                fetch(`${API_BASE_URL}/api/v1/templates/`, { headers }),
                fetch(`${API_BASE_URL}/api/v1/resumes/`, { headers }),
                fetch(`${API_BASE_URL}/api/v1/users/me`, { headers }),
            ]);

            if (contactsRes.ok) {
                const data = await contactsRes.json();
                setContacts(data.items || []);
                setTotal(data.total || 0);
            }
            if (templatesRes.ok) {
                const data = await templatesRes.json();
                setTemplates(Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []));
            }
            if (resumesRes.ok) {
                const data = await resumesRes.json();
                setResumes(Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []));
            }
            if (profileRes.ok) {
                const data = await profileRes.json();
                setUserProfile(data);
            }
        } catch (err) {
            toast.error("Failed to load outreach data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [page, searchQuery, contactScope]);

    const toggleSelectAll = useCallback(() => {
        setSelectedContactIds(prev => {
            if (prev.size === contacts.length && contacts.length > 0) {
                return new Set();
            }
            return new Set(contacts.map(c => c.id));
        });
    }, [contacts]);

    const toggleSelectContact = useCallback((id: number) => {
        setSelectedContactIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    // ── Preview & Dispatch Helpers ──

    const buildPayload = (contactId: number) => ({
        contact_id: contactId,
        template_id: parseInt(selectedTemplate),
        resume_id: parseInt(selectedResume),
        attach_resume: attachResume,
    });

    const fetchPreview = async (contactId: number) => {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/api/v1/scraper/preview-mail`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(buildPayload(contactId)),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Preview failed.");
        }
        return res.json();
    };

    const dispatchMail = async (contactId: number) => {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/api/v1/scraper/dispatch-mail`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(buildPayload(contactId)),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Dispatch failed.");
        }
        return res.json();
    };

    const sendColdMail = async (contactId: number) => {
        if (!selectedTemplate || !selectedResume) {
            toast.error("Select a template and resume first.");
            return;
        }

        // Show preview first for single sends
        setPreviewLoading(true);
        setPreviewContactId(contactId);
        try {
            const preview = await fetchPreview(contactId);
            setPreviewData(preview);

            // Check for critical warnings that block sending
            const criticalWarnings = (preview.warnings || []).filter((w: string) =>
                w.includes("Critical field empty") || w.includes("Unreplaced tags") || w.includes("unavailable")
            );

            if (criticalWarnings.length > 0) {
                // Extract missing tag names for the validation dialog
                const tags = (preview.tag_values || {});
                const emptyTags = Object.entries(tags)
                    .filter(([k, v]) => !v && !['experience_years', 'certifications', 'portfolio', 'github'].includes(k))
                    .map(([k]) => k);

                if (emptyTags.length > 0) {
                    setMissingTags(emptyTags);
                    setPendingDispatch({ type: 'single', id: contactId });
                    setShowValidationDialog(true);
                    setPreviewLoading(false);
                    return;
                }
            }

            // Show preview dialog
            setShowPreview(true);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setPreviewLoading(false);
        }
    };

    const confirmAndSend = async () => {
        if (!previewContactId) return;
        setShowPreview(false);
        setSendingId(previewContactId);
        try {
            await dispatchMail(previewContactId);
            toast.success("Outreach email dispatched.");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSendingId(null);
            setPreviewContactId(null);
            setPreviewData(null);
        }
    };

    const handleSaveMissingTags = async () => {
        if (!selectedResume || !pendingDispatch) return;

        const r = resumes.find(res => String(res.id) === selectedResume);
        if (!r) return;

        try {
            const token = localStorage.getItem("token");
            const newParsed = { ...(r.parsed_json || {}), ...manualTagValues };

            const updateRes = await fetch(`${API_BASE_URL}/api/v1/resumes/${r.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ parsed_json: newParsed }),
            });

            if (!updateRes.ok) throw new Error("Failed to update resume tags");

            setResumes(prev => prev.map(res => res.id === r.id ? { ...res, parsed_json: newParsed } : res));
            setShowValidationDialog(false);
            setManualTagValues({});

            // Resume dispatch
            if (pendingDispatch.type === 'single' && pendingDispatch.id) {
                sendColdMail(pendingDispatch.id);
            } else if (pendingDispatch.type === 'batch') {
                sendBatchMails();
            }
        } catch (err) {
            toast.error("Failed to save tags. Please try again.");
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

        // Quick preview check on the first contact to validate tags
        const firstId = Array.from(selectedContactIds)[0];
        try {
            const preview = await fetchPreview(firstId);
            const criticalWarnings = (preview.warnings || []).filter((w: string) =>
                w.includes("Critical field empty") || w.includes("Unreplaced tags") || w.includes("unavailable")
            );
            if (criticalWarnings.length > 0) {
                const tags = (preview.tag_values || {});
                const emptyTags = Object.entries(tags)
                    .filter(([k, v]) => !v && !['experience_years', 'certifications', 'portfolio', 'github'].includes(k))
                    .map(([k]) => k);
                if (emptyTags.length > 0) {
                    setMissingTags(emptyTags);
                    setPendingDispatch({ type: 'batch' });
                    setShowValidationDialog(true);
                    return;
                }
            }
        } catch (err: any) {
            toast.error(`Pre-flight check failed: ${err.message}`);
            return;
        }

        setBatchSending(true);
        let sent = 0;
        let failed = 0;

        for (const id of Array.from(selectedContactIds)) {
            try {
                await dispatchMail(id);
                sent++;
            } catch {
                failed++;
            }
        }
        setBatchSending(false);
        toast.success(`Batch Complete: ${sent} Sent, ${failed} Failed.`);
        setSelectedContactIds(new Set());
    };

    const labelClass = "text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60 font-medium mb-2 flex items-center";

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 relative pb-24">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-medium tracking-tight text-foreground flex items-center gap-3 font-sans">
                        <Mail className="h-8 w-8 text-primary" />
                        Cold Mail
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
                        <CardTitle className="text-lg font-medium">Campaign Presets</CardTitle>
                        <CardDescription className="text-xs">Define the assets for this outbound wave.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8 space-y-8">
                        <div className="space-y-6">
                            <div>
                                <Label className={labelClass}>
                                    Messaging Template <Tip text="Select the base template. The AI will weave in contact-specific nuances for maximum conversion." />
                                </Label>
                                <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={templateOpen}
                                            className="w-full justify-between bg-background/50 border-border/50 text-foreground h-12 rounded-xl focus:ring-primary/20 hover:bg-background/80"
                                        >
                                            {selectedTemplate
                                                ? templates.find((t) => String(t.id) === selectedTemplate)?.name
                                                : "Search framework..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] xl:w-[350px] p-0 bg-card border-border/50 shadow-2xl rounded-xl">
                                        <Command>
                                            <CommandInput placeholder="Search templates..." className="h-10 text-xs" />
                                            <CommandList className="max-h-[250px] overflow-y-auto custom-scrollbar">
                                                <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No templates found.</CommandEmpty>
                                                <CommandGroup>
                                                    {templates.map((t: any) => (
                                                        <CommandItem
                                                            key={t.id}
                                                            value={t.name}
                                                            onSelect={() => {
                                                                setSelectedTemplate(String(t.id));
                                                                setTemplateOpen(false);
                                                            }}
                                                            className="text-xs"
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4 text-primary",
                                                                    selectedTemplate === String(t.id) ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {t.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div>
                                <Label className={labelClass}>
                                    Strategic Resume <Tip text="This resume provides the skill-context for AI personality matching." />
                                </Label>
                                <Popover open={resumeOpen} onOpenChange={setResumeOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={resumeOpen}
                                            className="w-full justify-between bg-background/50 border-border/50 text-foreground h-12 rounded-xl focus:ring-primary/20 hover:bg-background/80"
                                        >
                                            {selectedResume
                                                ? resumes.find((r) => String(r.id) === selectedResume)?.filename || `Resume #${selectedResume}`
                                                : "Choose a resume..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] xl:w-[350px] p-0 bg-card border-border/50 shadow-2xl rounded-xl">
                                        <Command>
                                            <CommandInput placeholder="Search resumes..." className="h-10 text-xs" />
                                            <CommandList className="max-h-[250px] overflow-y-auto custom-scrollbar">
                                                <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No resumes found.</CommandEmpty>
                                                <CommandGroup>
                                                    {resumes.map((r: any) => (
                                                        <CommandItem
                                                            key={r.id}
                                                            value={r.filename || `Resume #${r.id}`}
                                                            onSelect={() => {
                                                                setSelectedResume(String(r.id));
                                                                setResumeOpen(false);
                                                            }}
                                                            className="text-xs"
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4 text-primary",
                                                                    selectedResume === String(r.id) ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {r.filename || `Resume #${r.id}`}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="pt-4">
                            <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-3">
                                <div className="flex items-center justify-between text-[11px] font-medium uppercase text-primary/70">
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

                            <div className="flex items-center space-x-3 pt-2">
                                <Checkbox
                                    id="attach-resume"
                                    checked={attachResume}
                                    onCheckedChange={(checked) => setAttachResume(checked === true)}
                                />
                                <Label htmlFor="attach-resume" className="text-sm font-medium text-foreground cursor-pointer">
                                    Attach Resume to Dispatched Emails
                                </Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Contacts Table */}
                <Card className="lg:col-span-8 bg-card/60 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-border/50 pb-4 bg-secondary/10">
                        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
                            <Tabs value={contactScope} onValueChange={setContactScope} className="w-[200px]">
                                <TabsList className="grid w-full grid-cols-2 h-9 border-border/50 bg-background/50 shadow-sm rounded-lg">
                                    <TabsTrigger value="global" className="text-xs">Global Leads</TabsTrigger>
                                    <TabsTrigger value="my" className="text-xs">My Contacts</TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <div className="relative w-full xl:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Filter attributes..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-10 bg-background/50 border-border/50 focus:border-primary/50 text-sm placeholder:text-muted-foreground/50 rounded-xl transition-all font-sans"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-secondary/20">
                                        <TableRow className="border-border/40 hover:bg-transparent">
                                            <TableHead className="w-12 px-4"></TableHead>
                                            <TableHead className="w-16 px-6"></TableHead>
                                            <TableHead className="py-4">Identity & Reach</TableHead>
                                            <TableHead className="py-4">Professional Context</TableHead>
                                            <TableHead className="py-4 pr-8 text-right">Precision Send</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...Array(5)].map((_, i) => (
                                            <TableRow key={i} className="border-border/20">
                                                <TableCell className="px-4"><Skeleton className="h-4 w-4 bg-secondary/40" /></TableCell>
                                                <TableCell className="px-6"><Skeleton className="h-4 w-4 bg-secondary/40" /></TableCell>
                                                <TableCell className="py-5">
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-4 w-[200px] bg-secondary/40" />
                                                        <Skeleton className="h-3 w-[150px] bg-secondary/20" />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-4 w-[150px] bg-secondary/40" />
                                                        <Skeleton className="h-4 w-[100px] bg-secondary/20" />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <div className="flex justify-end">
                                                        <Skeleton className="h-9 w-[100px] rounded-xl bg-secondary/40" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : contacts.length === 0 ? (
                            <div className="py-40 flex flex-col items-center justify-center text-muted-foreground text-center px-10">
                                <div className="h-20 w-20 bg-secondary/50 rounded-3xl flex items-center justify-center mb-6 border border-border/50 shadow-inner">
                                    <MousePointer2 className="w-8 h-8 text-muted-foreground/30" />
                                </div>
                                <h3 className="text-xl font-medium text-foreground mb-3 font-sans">No Leads Identified</h3>
                                <p className="text-sm text-balance max-w-sm opacity-60 leading-relaxed">
                                    Use the Universal Extractor to bridge external lists into your outbound pipeline.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-secondary/20">
                                        <TableRow className="border-border/40 hover:bg-transparent">
                                            <TableHead className="w-12 px-4 text-center text-[10px] font-medium text-muted-foreground/40">#</TableHead>
                                            <TableHead className="w-16 px-6">
                                                <Checkbox
                                                    checked={selectedContactIds.size === contacts.length && contacts.length > 0}
                                                    onCheckedChange={toggleSelectAll}
                                                    className="rounded-md border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                />
                                            </TableHead>
                                            <TableHead className="text-[10px] uppercase font-medium tracking-widest text-muted-foreground/60 py-4">Identity & Reach</TableHead>
                                            <TableHead className="text-[10px] uppercase font-medium tracking-widest text-muted-foreground/60 py-4">Professional Context</TableHead>
                                            <TableHead className="text-right text-[10px] uppercase font-medium tracking-widest text-muted-foreground/60 py-4 pr-8">Precision Send</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {contacts.map((c: any, idx: number) => (
                                            <ContactRow
                                                key={c.id}
                                                c={c}
                                                idx={idx}
                                                isSelected={selectedContactIds.has(c.id)}
                                                onToggle={toggleSelectContact}
                                                onSend={sendColdMail}
                                                sendingId={sendingId}
                                                selectedTemplate={selectedTemplate}
                                                selectedResume={selectedResume}
                                                page={page}
                                                pageSize={pageSize}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                                <Pagination
                                    currentPage={page}
                                    totalCount={total}
                                    pageSize={pageSize}
                                    onPageChange={setPage}
                                    disabled={loading}
                                />
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
                                <span className="text-lg font-medium leading-none">{selectedContactIds.size} Target{selectedContactIds.size > 1 ? 's' : ''}</span>
                                <span className="text-[10px] uppercase font-medium tracking-widest text-primary/70 mt-1">Batch Ready</span>
                            </div>
                        </div>
                        <Button
                            onClick={sendBatchMails}
                            disabled={batchSending || !selectedTemplate || !selectedResume}
                            className="bg-primary text-primary-foreground hover:opacity-90 rounded-xl px-8 py-6 h-auto font-medium text-base shadow-xl transition-all hover:scale-105 active:scale-95 gap-3"
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

            {/* Missing Tags Dialog */}
            <AlertDialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
                <AlertDialogContent className="bg-card border-border/50 shadow-2xl rounded-2xl max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Missing Information
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Your selected template requires context that isn&apos;t in your resume or profile. Add it below to continue.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-4">
                        {missingTags.map(tag => {
                            const isProfile = ['user_name', 'user_email', 'user_phone', 'linkedin', 'github', 'portfolio'].includes(tag);
                            return (
                                <div key={tag} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{tag.replace(/_/g, ' ')}</Label>
                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-sans tracking-wide">
                                            {isProfile ? "Profile Source" : "Resume Source"}
                                        </span>
                                    </div>
                                    <Input
                                        placeholder={`Enter ${tag.replace(/_/g, ' ')}...`}
                                        value={manualTagValues[tag] || ""}
                                        onChange={(e) => setManualTagValues(prev => ({ ...prev, [tag]: e.target.value }))}
                                        className="bg-background/50 border-border/50 h-10 rounded-xl focus:ring-primary/20"
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel onClick={() => {
                            setManualTagValues({});
                            setPendingDispatch(null);
                        }} className="rounded-xl border-border/50">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleSaveMissingTags();
                            }}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6"
                        >
                            Save & Dispatch
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Email Preview Dialog */}
            <AlertDialog open={showPreview} onOpenChange={setShowPreview}>
                <AlertDialogContent className="bg-card border-border/50 shadow-2xl rounded-2xl max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Eye className="w-5 h-5 text-primary" />
                            Email Preview
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Review the resolved email before sending.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {previewData && (
                        <div className="py-4 space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
                                <p className="text-sm font-mono text-foreground/80">{previewData.recipient}</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Subject</Label>
                                <p className="text-sm font-medium text-foreground">{previewData.subject}</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Body</Label>
                                <div className="p-3 bg-background/50 border border-border/30 rounded-xl max-h-[300px] overflow-y-auto">
                                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{previewData.body}</p>
                                </div>
                            </div>
                            {previewData.has_attachment && (
                                <div className="flex items-center gap-2 text-xs text-emerald-500">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Resume will be attached
                                </div>
                            )}
                            {previewData.warnings?.length > 0 && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                                    {previewData.warnings.map((w: string, i: number) => (
                                        <p key={i} className="text-xs text-amber-400 flex items-start gap-1.5">
                                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                            {w}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl border-border/50">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmAndSend();
                            }}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 gap-2"
                        >
                            <Send className="w-4 h-4" />
                            Confirm & Send
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
