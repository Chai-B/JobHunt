"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Mail, LayoutTemplate, Tag, X, Copy, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";

const DEFAULT_TAGS = [
    { tag: "{{job_title}}", label: "Job Title", desc: "Title of the target job position" },
    { tag: "{{company}}", label: "Company", desc: "Name of the target company" },
    { tag: "{{user_name}}", label: "Your Name", desc: "Your full name from your profile" },
    { tag: "{{user_email}}", label: "Your Email", desc: "Your registered email address" },
    { tag: "{{user_phone}}", label: "Phone", desc: "Your phone number from profile" },
    { tag: "{{user_location}}", label: "Location", desc: "Your location from profile" },
    { tag: "{{linkedin}}", label: "LinkedIn", desc: "Your LinkedIn profile URL" },
    { tag: "{{github}}", label: "GitHub", desc: "Your GitHub profile URL" },
    { tag: "{{portfolio}}", label: "Portfolio", desc: "Your portfolio/website URL" },
    { tag: "{{skills}}", label: "Skills", desc: "Key skills extracted from your resume" },
    { tag: "{{experience_years}}", label: "Experience", desc: "Estimated years of experience" },
    { tag: "{{education}}", label: "Education", desc: "Your highest/recent education" },
    { tag: "{{recent_role}}", label: "Recent Role", desc: "Your most recent job role/title" },
    { tag: "{{top_projects}}", label: "Top Projects", desc: "Key projects extracted from resume" },
    { tag: "{{certifications}}", label: "Certifications", desc: "Relevant certifications" },
    { tag: "{{contact_name}}", label: "Contact Name", desc: "Recipient's name (cold mail only)" },
];

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [pageSize, setPageSize] = useState(50);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(1);
    };

    const [name, setName] = useState("");
    const [subject, setSubject] = useState("");
    const [bodyText, setBodyText] = useState("");
    const [customTags, setCustomTags] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState("");

    const bodyRef = useRef<HTMLTextAreaElement>(null);
    const subjectRef = useRef<HTMLInputElement>(null);

    const [aiPurpose, setAiPurpose] = useState("cold_outreach");
    const [aiTone, setAiTone] = useState("professional");
    const [aiLength, setAiLength] = useState("short");
    const [aiFocus, setAiFocus] = useState("achievements");
    const [generating, setGenerating] = useState(false);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/templates/?skip=${(page - 1) * pageSize}&limit=${pageSize}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTemplates(data.items || []);
                setTotal(data.total || 0);
            } else {
                toast.error("Failed to load templates.");
            }
        } catch (err) {
            toast.error("Network Error: Backend services unreachable.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, [page, pageSize]);

    const insertTag = (tag: string, target: "subject" | "body") => {
        if (target === "body") {
            const el = bodyRef.current;
            if (el) {
                const start = el.selectionStart;
                const end = el.selectionEnd;
                const newText = bodyText.substring(0, start) + tag + bodyText.substring(end);
                setBodyText(newText);
                setTimeout(() => {
                    el.focus();
                    el.setSelectionRange(start + tag.length, start + tag.length);
                }, 0);
            } else {
                setBodyText(bodyText + tag);
            }
        } else {
            setSubject(subject + tag);
            subjectRef.current?.focus();
        }
    };

    const addCustomTag = () => {
        const cleaned = newTagInput.trim().replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
        if (!cleaned) return;
        const tagStr = `{{${cleaned}}}`;
        if (customTags.includes(tagStr) || DEFAULT_TAGS.some(t => t.tag === tagStr)) {
            toast.error("Tag already exists.");
            return;
        }
        setCustomTags([...customTags, tagStr]);
        setNewTagInput("");
        toast.success(`Custom tag ${tagStr} added.`);
    };

    const removeCustomTag = (tag: string) => {
        setCustomTags(customTags.filter(t => t !== tag));
    };

    const handleOpenCreate = () => {
        setSelectedTemplateId(null);
        setName("");
        setSubject("");
        setBodyText("");
        setIsOpen(true);
    };

    const handleEdit = (t: any) => {
        setSelectedTemplateId(t.id);
        setName(t.name);
        setSubject(t.subject);
        setBodyText(t.body_text);
        setIsOpen(true);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("token");
            const method = selectedTemplateId ? "PUT" : "POST";
            const url = selectedTemplateId
                ? `${API_BASE_URL}/api/v1/templates/${selectedTemplateId}`
                : `${API_BASE_URL}/api/v1/templates/`;

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name, subject, body_text: bodyText })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to save template.");
            }
            toast.success(selectedTemplateId ? "Template updated successfully." : "Template created successfully.");
            setIsOpen(false);
            setName(""); setSubject(""); setBodyText(""); setCustomTags([]);
            setSelectedTemplateId(null);
            fetchTemplates();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const allTags = [...DEFAULT_TAGS.map(t => t.tag), ...customTags];

    const generateWithAI = async () => {
        setGenerating(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/templates/generate-ai`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    purpose: aiPurpose,
                    tone: aiTone,
                    length: aiLength,
                    focus: aiFocus
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "AI generation failed.");
            }
            const data = await res.json();
            setName(data.name || "");
            setSubject(data.subject || "");
            setBodyText(data.body_text || "");
            toast.success("AI template generated! Review and save.");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                        <LayoutTemplate className="h-6 w-6" />
                        Templates
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Create dynamic templates with autofill variables for personalized emails.</p>
                </div>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleOpenCreate} className="flex items-center gap-2 bg-foreground text-background hover:opacity-90 transition-opacity rounded-md">
                            <Plus className="w-4 h-4" />
                            Create Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[900px] bg-card border-border text-foreground shadow-2xl rounded-xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                {selectedTemplateId ? "Edit Template" : "New Template"}
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-12 gap-6 py-4">

                            {/* Left Column: AI & Tags */}
                            <div className="md:col-span-5 space-y-5">
                                {/* AI Generation Section */}
                                <div className="bg-secondary/30 border border-border p-4 rounded-xl shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground uppercase tracking-wider">
                                        <div className="w-5 h-5 flex items-center justify-center rounded bg-primary/20 text-primary">
                                            <Sparkles className="w-3.5 h-3.5" />
                                        </div>
                                        Generate with AI
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <Select value={aiPurpose} onValueChange={setAiPurpose}>
                                                <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-card border-border text-foreground">
                                                    <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                                                    <SelectItem value="job_application">Job Application</SelectItem>
                                                    <SelectItem value="follow_up">Follow-Up</SelectItem>
                                                    <SelectItem value="networking">Networking</SelectItem>
                                                    <SelectItem value="referral_request">Referral Request</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Select value={aiTone} onValueChange={setAiTone}>
                                                <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-card border-border text-foreground">
                                                    <SelectItem value="professional">Professional</SelectItem>
                                                    <SelectItem value="casual">Casual</SelectItem>
                                                    <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                                                    <SelectItem value="concise">Concise & Direct</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Select value={aiLength} onValueChange={setAiLength}>
                                                <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-card border-border text-foreground">
                                                    <SelectItem value="short">Short</SelectItem>
                                                    <SelectItem value="medium">Medium</SelectItem>
                                                    <SelectItem value="long">Long</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Select value={aiFocus} onValueChange={setAiFocus}>
                                                <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-card border-border text-foreground">
                                                    <SelectItem value="achievements">Achievements</SelectItem>
                                                    <SelectItem value="skills">Skills</SelectItem>
                                                    <SelectItem value="culture">Culture Fit</SelectItem>
                                                    <SelectItem value="projects">Projects</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button type="button" onClick={generateWithAI} disabled={generating} className="h-9 w-full text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 shadow-sm transition-all rounded-md mt-1">
                                            <Sparkles className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                                            {generating ? "Crafting Message..." : "Generate Magic Template"}
                                        </Button>
                                    </div>
                                </div>

                                {/* Available Tags */}
                                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground uppercase tracking-wider">
                                        <div className="w-5 h-5 flex items-center justify-center rounded bg-blue-500/20 text-blue-500">
                                            <Tag className="w-3.5 h-3.5" />
                                        </div>
                                        Dynamic Variables
                                    </div>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed -mt-1">
                                        Click a variable to insert it at your cursor position in the template editor.
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto pr-1 pb-1 custom-scrollbar">
                                        {DEFAULT_TAGS.map((t) => (
                                            <button
                                                key={t.tag}
                                                type="button"
                                                onClick={() => insertTag(t.tag, "body")}
                                                className="text-foreground bg-secondary/80 hover:bg-muted px-2 py-1 rounded-md border border-border text-[10px] font-mono transition-colors cursor-pointer"
                                                title={t.desc}
                                            >
                                                {t.tag}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Tags */}
                                    {customTags.length > 0 && (
                                        <div className="pt-3 border-t border-border">
                                            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                                Custom Variables
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {customTags.map((tag) => (
                                                    <span key={tag} className="text-foreground bg-secondary/80 px-2 py-1 rounded-md border border-border text-[10px] font-mono flex items-center gap-1.5 group">
                                                        <button type="button" onClick={() => insertTag(tag, "body")} className="hover:text-primary transition-colors">{tag}</button>
                                                        <button type="button" onClick={() => removeCustomTag(tag)} className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"><X className="w-3 h-3" /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Add Custom Tag */}
                                    <div className="flex items-center gap-2 pt-3 border-t border-border mt-2">
                                        <Input
                                            value={newTagInput}
                                            onChange={(e) => setNewTagInput(e.target.value)}
                                            placeholder="custom_tag_name"
                                            className="bg-background border-border text-foreground h-8 text-xs font-mono flex-1 rounded-md"
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                                        />
                                        <Button type="button" size="sm" variant="outline" onClick={addCustomTag} className="h-8 text-xs border-border text-foreground hover:bg-secondary rounded-md shadow-sm">
                                            <Plus className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Editor */}
                            <div className="md:col-span-7 flex flex-col gap-4">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="name" className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider pl-1">Template Name</Label>
                                    <Input id="name" placeholder="e.g. Standard Cold Intro" required value={name} onChange={(e) => setName(e.target.value)} className="bg-background border-border focus-visible:ring-ring text-foreground h-10 rounded-lg shadow-sm font-medium" />
                                </div>
                                <div className="grid gap-1.5">
                                    <div className="flex justify-between items-center pl-1 r-1">
                                        <Label htmlFor="subject" className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Email Subject</Label>
                                        <div className="flex gap-1.5">
                                            {["{{job_title}}", "{{company}}"].map(tag => (
                                                <button key={tag} type="button" onClick={() => insertTag(tag, "subject")} className="text-[9px] text-muted-foreground hover:text-foreground hover:bg-secondary font-mono border border-border bg-card rounded px-1.5 py-0.5 transition-colors shadow-sm">{tag}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <Input ref={subjectRef} id="subject" placeholder="Application for {{job_title}} at {{company}}" required value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-background border-border focus-visible:ring-ring text-foreground h-10 rounded-lg shadow-sm font-mono text-sm" />
                                </div>
                                <div className="grid gap-1.5 flex-1 flex flex-col min-h-[300px]">
                                    <Label htmlFor="body" className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider pl-1">Email Body</Label>
                                    <Textarea
                                        ref={bodyRef}
                                        id="body"
                                        className="flex-1 font-mono text-sm leading-relaxed resize-none p-5 bg-background border-border focus-visible:ring-ring text-foreground rounded-xl transition-colors shadow-inner"
                                        placeholder={"Hi {{contact_name}},\n\nI'm {{user_name}}, and I'm reaching out about the {{job_title}} role at {{company}}.\n\nI bring {{experience_years}} of experience and expertise in {{skills}}.\n\nLet's connect:\n{{linkedin}} | {{github}} | {{portfolio}}\n\nBest,\n{{user_name}}\n{{user_email}} | {{user_phone}}"}
                                        required
                                        value={bodyText}
                                        onChange={(e) => setBodyText(e.target.value)}
                                    />
                                </div>
                                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:opacity-90 font-bold h-11 text-sm rounded-lg shadow-md mt-2">
                                    {selectedTemplateId ? "Save Changes" : "Create Template"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="border-b border-border pb-5">
                    <CardTitle className="text-foreground text-lg font-semibold">Saved Templates</CardTitle>
                    <CardDescription className="text-muted-foreground">Your templates ready for outreach. Click a tag in the editor to autofill.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                            <span className="text-sm">Loading templates...</span>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="py-32 text-center text-muted-foreground flex flex-col items-center justify-center">
                            <div className="h-16 w-16 bg-secondary/50 rounded-full flex items-center justify-center mb-4 border border-border">
                                <LayoutTemplate className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="text-foreground font-semibold text-lg mb-1">No Templates Found</p>
                            <p className="text-sm max-w-sm">Create a template to enable personalized automated outreach.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-secondary/30">
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="w-12 text-center text-[10px] uppercase font-bold text-muted-foreground/40">#</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Name</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Subject</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Variables Used</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Created</TableHead>
                                        <TableHead className="text-muted-foreground font-medium text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {templates.map((t: any, idx: number) => {
                                        // Count variables used in the template
                                        const usedVars = allTags.filter(tag => t.subject?.includes(tag) || t.body_text?.includes(tag));
                                        return (
                                            <TableRow key={t.id} className="border-border hover:bg-secondary/50 transition-colors">
                                                <TableCell className="text-center text-[10px] font-mono text-muted-foreground/40">{(page - 1) * pageSize + idx + 1}</TableCell>
                                                <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                                                <TableCell className="text-muted-foreground max-w-xs truncate font-mono text-xs">{t.subject}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {usedVars.length > 0 ? usedVars.slice(0, 4).map(v => (
                                                            <Badge key={v} variant="outline" className="text-[10px] font-mono border-border text-muted-foreground">{v}</Badge>
                                                        )) : <span className="text-xs text-muted-foreground">None</span>}
                                                        {usedVars.length > 4 && <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">+{usedVars.length - 4}</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {new Date(t.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(t)} className="h-8 text-xs px-2 hover:bg-secondary border border-transparent hover:border-border text-foreground transition-all">Edit</Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            <Pagination
                                currentPage={page}
                                totalCount={total}
                                pageSize={pageSize}
                                onPageChange={setPage}
                                onPageSizeChange={handlePageSizeChange}
                                disabled={loading}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
