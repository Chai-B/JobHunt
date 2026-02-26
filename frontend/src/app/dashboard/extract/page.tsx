"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Users, Briefcase, Save, Trash2, ArrowRight } from "lucide-react";
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                        <Sparkles className="h-6 w-6" />
                        Universal Extractor
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Paste any raw text—emails, LinkedIn profiles, or job descriptions—and we&apos;ll instantly parse it.</p>
                </div>
                {results.length > 0 && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleDiscardAll} className="text-destructive border-destructive/20 hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4 mr-2" /> Discard All
                        </Button>
                        <Button size="sm" onClick={handleSaveAll} className="bg-primary text-primary-foreground">
                            <Save className="w-4 h-4 mr-2" /> Save All Contacts
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="bg-card border-border shadow-sm flex flex-col h-full">
                    <CardHeader className="pb-3 border-b border-border">
                        <CardTitle className="text-lg">Raw Text Data</CardTitle>
                        <CardDescription>We&apos;ll look for names, emails, companies, and job titles.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 flex-grow flex flex-col gap-4">
                        <Textarea
                            placeholder="Paste text here..."
                            className="flex-grow min-h-[400px] font-mono text-sm resize-none bg-background border-border"
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />
                        <Button
                            className="w-full gap-2 bg-foreground text-background"
                            disabled={!rawText.trim() || processing}
                            onClick={handleExtract}
                        >
                            {processing ? "Extracting..." : "Extract Data"}
                            {!processing && <ArrowRight className="w-4 h-4" />}
                        </Button>
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-4 h-full xl:max-h-[700px] overflow-y-auto pr-2">
                    {results.length === 0 && !processing && (
                        <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-card/50">
                            <Sparkles className="w-8 h-8 opacity-20 mb-3" />
                            <p className="text-sm font-medium text-foreground">Awaiting Input</p>
                            <p className="text-xs text-center max-w-[200px] mt-1">Paste something on the left to see the magic happen.</p>
                        </div>
                    )}

                    {results.map((r, i) => (
                        <Card key={i} className="bg-card border-border shadow-md animate-in slide-in-from-right-4 relative overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${r.type === 'contact' ? 'bg-blue-500' : 'bg-emerald-500'}`} />

                            <CardHeader className="pb-3 pt-4 pl-6">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        {r.type === 'contact' ? <Users className="w-4 h-4 text-blue-500" /> : <Briefcase className="w-4 h-4 text-emerald-500" />}
                                        <CardTitle className="text-base uppercase tracking-wider text-muted-foreground">
                                            Found {r.type === 'contact' ? 'Contact' : 'Job Posting'}
                                        </CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] font-mono border-border bg-secondary">
                                        {(r.confidence * 100).toFixed(0)}% Match
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pl-6 pb-2">
                                {r.type === 'contact' && (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex gap-2"><span className="text-muted-foreground w-20">Email:</span> <strong className="text-blue-400">{r.data.email}</strong></div>
                                        <div className="flex gap-2"><span className="text-muted-foreground w-20">Company:</span> <strong className="text-primary">{r.data.company}</strong></div>
                                        <div className="flex gap-2"><span className="text-muted-foreground w-20">Name:</span> <strong>{r.data.name || "—"}</strong></div>
                                        <div className="flex gap-2"><span className="text-muted-foreground w-20">Role:</span> <strong className="text-muted-foreground">{r.data.role || "—"}</strong></div>
                                    </div>
                                )}
                                {r.type === 'job' && (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex gap-2"><span className="text-muted-foreground w-20">Title:</span> <strong>{r.data.title}</strong></div>
                                        <div className="flex gap-2"><span className="text-muted-foreground w-20">Company:</span> <strong>{r.data.company}</strong></div>
                                        <div className="flex gap-2"><span className="text-muted-foreground w-20">Location:</span> <strong>{r.data.location}</strong></div>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="pl-6 pt-2 pb-4 flex gap-2 justify-end bg-secondary/20">
                                <Button variant="ghost" size="sm" onClick={() => handleDiscard(i)} className="text-muted-foreground hover:text-destructive">
                                    <Trash2 className="w-4 h-4 mr-1" /> Discard
                                </Button>
                                <Button size="sm" onClick={() => handleSaveEntity(r, i)} className="bg-foreground text-background">
                                    <Save className="w-4 h-4 mr-1" /> Save {r.type === 'contact' ? 'Contact' : 'Job'}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
