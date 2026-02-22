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
                endpoint = "/api/v1/jobs/";
                payload = {
                    ...entity.data,
                    source: "manual",
                    source_url: "Universal Extractor",
                    is_active: true
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
            // Remove from list
            setResults(prev => prev.filter((_, i) => i !== index));
            if (results.length === 1) setRawText(""); // Cleared all
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleDiscard = (index: number) => {
        setResults(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                    <Sparkles className="h-6 w-6" />
                    Universal Extractor
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">Paste any raw text—emails, LinkedIn profiles, or job descriptions—and we&apos;ll instantly parse it.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Column */}
                <Card className="bg-card border-border shadow-sm flex flex-col h-full">
                    <CardHeader className="pb-3 border-b border-border">
                        <CardTitle className="text-lg">Raw Text Data</CardTitle>
                        <CardDescription>We&apos;ll look for names, emails, companies, and job titles.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 flex-grow flex flex-col gap-4">
                        <Textarea
                            placeholder="Paste text here..."
                            className="flex-grow min-h-[300px] font-mono text-sm resize-none bg-background border-border"
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

                {/* Results Column */}
                <div className="flex flex-col gap-4 h-full xl:max-h-[600px] overflow-y-auto pr-2">
                    {results.length === 0 && !processing && (
                        <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-card/50">
                            <Sparkles className="w-8 h-8 opacity-20 mb-3" />
                            <p className="text-sm font-medium text-foreground">Awaiting Input</p>
                            <p className="text-xs text-center max-w-[200px] mt-1">Paste something on the left to see the magic happen.</p>
                        </div>
                    )}

                    {results.map((r, i) => (
                        <Card key={i} className="bg-card border-border shadow-md animate-in slide-in-from-right-4 relative overflow-hidden">
                            {/* Color strip indicating type */}
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
                                        <div className="flex gap-2"><span className="text-muted-foreground w-16">Name:</span> <strong>{r.data.name || "—"}</strong></div>
                                        <div className="flex gap-2"><span className="text-muted-foreground w-16">Email:</span> <strong>{r.data.email}</strong></div>
                                        <div className="flex gap-2"><span className="text-muted-foreground w-16">Company:</span> <strong>{r.data.company || "—"}</strong></div>
                                        {r.data.phone && <div className="flex gap-2"><span className="text-muted-foreground w-16">Phone:</span> <strong>{r.data.phone}</strong></div>}
                                    </div>
                                )}
                                {r.type === 'job' && (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex gap-2"><span className="text-muted-foreground w-16">Title:</span> <strong>{r.data.title}</strong></div>
                                        <div className="flex gap-2"><span className="text-muted-foreground w-16">Company:</span> <strong>{r.data.company}</strong></div>
                                        <div className="flex gap-2"><span className="text-muted-foreground w-16">Location:</span> <strong>{r.data.location}</strong></div>
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
