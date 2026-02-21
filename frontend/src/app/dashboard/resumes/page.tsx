"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, Edit2, FileText, Activity, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function ResumesPage() {
    const [resumes, setResumes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [labelInput, setLabelInput] = useState("");
    const [selectedResume, setSelectedResume] = useState<any>(null);
    const [editRawText, setEditRawText] = useState("");
    const [editLabel, setEditLabel] = useState("");
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);

    const handleDeleteResume = async (resumeId: number) => {
        if (!confirm("Are you sure you want to delete this resume?")) return;
        setDeleting(resumeId);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/resumes/${resumeId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to delete resume.");
            toast.success("Resume deleted.");
            fetchResumes();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setDeleting(null);
        }
    };

    const fetchResumes = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/resumes/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setResumes(data.items || []);
            } else {
                toast.error("Failed to fetch resumes.");
            }
        } catch (err) {
            toast.error("Network error: Backend unreachable.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveResume = async () => {
        if (!selectedResume) return;
        setSaving(true);
        try {
            const token = localStorage.getItem("token");
            const payload = {
                raw_text: editRawText,
                label: editLabel
            };
            const res = await fetch(`${API_BASE_URL}/api/v1/resumes/${selectedResume.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to update resume.");
            }
            toast.success("Resume updated successfully.");
            setDialogOpen(false);
            fetchResumes();
        } catch (err: any) {
            toast.error(err.message || "Network error while saving.");
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        fetchResumes();
        // Poll every 5s for background task completion
        const interval = setInterval(fetchResumes, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        if (labelInput) formData.append("label", labelInput);

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/resumes/upload`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Upload failed");
            }

            toast.success("Resume uploaded and processing started.");
            fetchResumes();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setUploading(false);
            // Reset input
            event.target.value = '';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                        <FileText className="h-6 w-6" />
                        Resumes
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Upload and manage your tailored resumes.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Resume Label (e.g. Frontend)"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        className="flex h-11 w-full sm:w-64 rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus:border-ring focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                    />
                    <label htmlFor="resume-upload" className="w-full sm:w-auto">
                        <Button asChild disabled={uploading} className="w-full sm:w-auto h-11 bg-foreground hover:opacity-90 text-background transition-opacity font-medium">
                            <span className="cursor-pointer flex items-center gap-2">
                                <UploadCloud className="w-4 h-4" />
                                {uploading ? "Uploading..." : "Upload New Resume"}
                            </span>
                        </Button>
                    </label>
                    <input
                        id="resume-upload"
                        type="file"
                        accept=".pdf,.docx,.txt"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploading}
                    />
                </div>
            </div>

            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="border-b border-border pb-5">
                    <CardTitle className="text-foreground text-lg font-semibold">Saved Resumes</CardTitle>
                    <CardDescription className="text-muted-foreground">Your uploaded resumes, parsed and ready for job matching.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                            <Activity className="w-6 h-6 animate-pulse mb-4" />
                            <span className="text-sm">Loading resumes...</span>
                        </div>
                    ) : resumes.length === 0 ? (
                        <div className="py-32 text-center text-muted-foreground flex flex-col items-center justify-center">
                            <div className="h-16 w-16 bg-secondary/50 rounded-full flex items-center justify-center mb-4 border border-border">
                                <FileText className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="text-foreground font-semibold text-lg mb-1">No Resumes Found</p>
                            <p className="text-sm max-w-sm">Upload a PDF or DOCX resume to get started.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-secondary/30">
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground font-medium">Filename</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Label</TableHead>
                                        <TableHead className="text-muted-foreground font-medium text-xs">FORMAT</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                                        <TableHead className="text-right text-muted-foreground font-medium">Date Uploaded</TableHead>
                                        <TableHead className="text-right text-muted-foreground font-medium">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {resumes.map((r: any) => (
                                        <TableRow key={r.id} className="border-border hover:bg-secondary/50 transition-colors">
                                            <TableCell className="font-medium text-foreground">{r.filename}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{r.label || "General"}</TableCell>
                                            <TableCell className="uppercase text-muted-foreground font-mono text-xs font-medium">{r.format}</TableCell>
                                            <TableCell>
                                                {r.status === "completed" ? (
                                                    <Badge variant="outline" className="border-border text-foreground">Processed</Badge>
                                                ) : r.status === "error" ? (
                                                    <Badge variant="destructive" className="bg-destructive text-destructive-foreground">Error</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-border text-muted-foreground animate-pulse">Processing...</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground text-sm">
                                                {new Date(r.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="outline" size="sm" className="bg-transparent border-border text-foreground hover:bg-secondary" onClick={() => {
                                                        setSelectedResume(r);
                                                        setEditRawText(r.raw_text || "");
                                                        setEditLabel(r.label || "");
                                                        setDialogOpen(true);
                                                    }}>
                                                        <Edit2 className="w-3.5 h-3.5 mr-2" />
                                                        View / Edit
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="bg-transparent border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteResume(r.id)} disabled={deleting === r.id}>
                                                        <Trash2 className={`w-3.5 h-3.5 ${deleting === r.id ? 'animate-spin' : ''}`} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[800px] h-[85vh] flex flex-col bg-card border-border text-foreground shadow-lg rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                            <Edit2 className="w-4 h-4" /> Edit Resume Details
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm">
                            Review and correct the parsed text from your resume to ensure accurate job matching.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-5 py-4 flex-1 overflow-hidden">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Resume Label</label>
                            <input
                                className="col-span-3 flex h-11 w-full rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2 flex-1 min-h-0">
                            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium shrink-0">Parsed Resume Text</label>
                            <Textarea
                                className="flex-1 font-mono text-xs resize-y p-4 bg-background border-border focus-visible:ring-ring text-foreground rounded-md leading-relaxed shadow-sm transition-colors overflow-y-auto min-h-[300px]"
                                placeholder="Text extraction pending..."
                                value={editRawText}
                                onChange={(e) => setEditRawText(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-3">
                        <Button variant="outline" className="bg-transparent border-border text-foreground hover:bg-secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button disabled={saving} className="bg-foreground hover:opacity-90 text-background font-medium" onClick={handleSaveResume}>
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
