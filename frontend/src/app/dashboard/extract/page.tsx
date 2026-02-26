"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Users, Briefcase, Save, Trash2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ExtractorPage() {
    const [rawText, setRawText] = useState("");
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState<any[]>([]);

    const handleExtract = async () => {
        if (!rawText.trim()) return;
        setProcessing(true);
        setResults([]);

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/extract/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ text: rawText })
            });

            if (!res.ok) throw new Error("Extraction failed.");
            const data = await res.json();

            if (data.entities && data.entities.length > 0) {
                setResults(data.entities);
                toast.success(`Found ${data.entities.length} items!`);
            } else {
                toast.info("No actionable data found in this text.");
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleSaveEntity = async (entity: any, index: number) => {
        try {
            const token = localStorage.getItem("token");
            let endpoint = "";
            let payload = {};

            if (entity.type === "contact") {
                endpoint = "/api/v1/contacts/";
                payload = { ...entity.data, is_verified: false, source_url: "Universal Extractor" };
            } else if (entity.type === "job") {
                endpoint = "/api/v1/jobs/ingest/manual";
                payload = {
                    title: entity.data.title || "Unknown Title",
                    company: entity.data.company || "Unknown Company",
                    description: entity.data.description || `Extracted role: ${entity.data.title || "Unknown"} at ${entity.data.company || "Unknown"}`,
                };
            }

            const res = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to save.");
            }

            toast.success("Saved successfully!");
            setResults(prev => prev.filter((_, i) => i !== index));
            if (results.length === 1) setRawText("");
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleDiscard = (index: number) => {
        setResults(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveAll = async () => {
        const contactsToSave = results
            .filter(r => r.type === "contact")
            .map(r => ({ ...r.data, is_verified: false, source_url: "Universal Extractor" }));

        if (contactsToSave.length === 0) {
            toast.info("No contacts to save.");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/contacts/bulk`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(contactsToSave)
            });

            if (!res.ok) throw new Error("Bulk save failed.");
            const data = await res.json();
            toast.success(`Successfully saved ${data.saved} new contacts!`);
            setResults(prev => prev.filter(r => r.type !== "contact"));
            if (results.length === contactsToSave.length) setRawText("");
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleDiscardAll = () => {
        setResults([]);
        setRawText("");
        toast.info("All results discarded.");
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 min-h-[80px]">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-3 font-sans">
                        <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                        Extractor
                    </h1>
                    <p className="text-muted-foreground mt-2 text-base max-w-2xl">
                        AI-powered parsing for structured and unstructured data. Paste spreadsheets, emails, or job descriptions to extract high-quality leads.
                    </p>
                </div>
                <div className="flex gap-3 justify-end">
                    <div className={`flex gap-3 transition-opacity duration-300 ${results.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={handleDiscardAll}
                            className="text-destructive border-destructive/20 hover:bg-destructive/10 rounded-xl px-6"
                        >
                            <Trash2 className="w-4 h-4 mr-2" /> Discard All
                        </Button>
                        <Button
                            size="lg"
                            onClick={handleSaveAll}
                            className="bg-primary text-primary-foreground hover:opacity-90 rounded-xl px-8 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95"
                        >
                            <Save className="w-4 h-4 mr-2" /> Save All Contacts
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Input Column */}
                <Card className="lg:col-span-4 bg-card/50 backdrop-blur-xl border-border/50 shadow-2xl flex flex-col h-full rounded-2xl overflow-hidden group">
                    <CardHeader className="pb-3 border-b border-border/50 bg-secondary/20">
                        <CardTitle className="text-xl font-semibold flex items-center gap-2">
                            Raw Input
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-tighter">Draft</Badge>
                        </CardTitle>
                        <CardDescription className="text-sm">We&apos;ll automatically identify Email, Company, Name, and Role.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 flex-grow flex flex-col gap-6">
                        <div className="relative group/textarea">
                            <Textarea
                                placeholder="Paste spreadsheet data or raw text here..."
                                className="flex-grow min-h-[450px] font-mono text-sm resize-none bg-background/30 border-border/50 focus:border-primary/50 rounded-xl transition-all p-4 leading-relaxed"
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                            />
                            <div className="absolute bottom-4 right-4 text-[10px] text-muted-foreground/50 font-mono">
                                {rawText.length} characters
                            </div>
                        </div>
                        <Button
                            className="w-full h-14 text-lg font-semibold gap-3 bg-foreground text-background hover:bg-foreground/90 rounded-xl shadow-xl transition-all hover:gap-5"
                            disabled={!rawText.trim() || processing}
                            onClick={handleExtract}
                        >
                            {processing ? "Analysing Text..." : "Begin Extraction"}
                            {!processing && <ArrowRight className="w-5 h-5" />}
                        </Button>
                    </CardContent>
                </Card>

                {/* Results Column */}
                <div className="lg:col-span-8 flex flex-col gap-4 h-full xl:max-h-[850px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-border">
                    {results.length === 0 && !processing && (
                        <div className="h-[450px] flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-2xl bg-card/20 backdrop-blur-sm animate-pulse">
                            <Sparkles className="w-12 h-12 opacity-10 mb-5" />
                            <p className="text-lg font-medium text-foreground/60">Awaiting Data Input</p>
                            <p className="text-sm text-center max-w-[280px] mt-2 leading-relaxed opacity-50 font-sans">
                                Once you provide raw text, our AI will generate structured contact and job blocks here.
                            </p>
                        </div>
                    )}

                    {results.map((r, i) => (
                        <Card key={i} className="bg-card/40 backdrop-blur-md border-border/50 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden rounded-2xl group/card">
                            {/* Accent indicator */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${r.type === 'contact' ? 'bg-blue-500/80' : 'bg-emerald-500/80'} group-hover/card:w-1.5 transition-all`} />

                            <CardHeader className="pb-4 pt-6 pl-6 pr-6 border-b border-border/20 bg-secondary/10">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${r.type === 'contact' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                            {r.type === 'contact' ? <Users className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                                        </div>
                                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
                                            {r.type === 'contact' ? 'Contact Found' : 'Job Inferred'}
                                        </CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] font-mono border-border/50 bg-background/50 backdrop-blur-sm px-3 py-1">
                                        {(r.confidence * 100).toFixed(0)}% MATCH
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pl-6 pt-6 pb-6 space-y-4">
                                {r.type === 'contact' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter block">Email Address</span>
                                            <strong className="text-base text-blue-400 font-mono break-all">{r.data.email}</strong>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter block">Current Company</span>
                                            <div className="flex items-center gap-2">
                                                <strong className="text-base text-primary">{r.data.company}</strong>
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/50" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter block">Lead Name</span>
                                            <strong className="text-base text-foreground/90">{r.data.name || "—"}</strong>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter block">Professional Role</span>
                                            <Badge variant="secondary" className="mt-0.5 rounded-md px-2 py-0.5 text-[11px] font-medium border-border/50">
                                                {r.data.role || "Not Identified"}
                                            </Badge>
                                        </div>
                                    </div>
                                )}
                                {r.type === 'job' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter block">Role Title</span>
                                            <strong className="text-base text-emerald-400">{r.data.title}</strong>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter block">Organisation</span>
                                            <strong className="text-base text-foreground/90">{r.data.company}</strong>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="pl-6 pt-4 pb-4 pr-6 flex gap-3 justify-end bg-secondary/5 border-t border-border/10">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDiscard(i)}
                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg px-4"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" /> Discard
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveEntity(r, i)}
                                    className="bg-foreground text-background rounded-lg px-5 font-semibold transition-all hover:px-7"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Confirm & Save
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
