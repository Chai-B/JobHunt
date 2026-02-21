"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Briefcase, Globe, Activity, ExternalLink } from "lucide-react";

export default function JobsPage() {
    const [ingesting, setIngesting] = useState(false);
    const [matchingJobId, setMatchingJobId] = useState<number | null>(null);
    const [matchResult, setMatchResult] = useState<any>(null);
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [title, setTitle] = useState("");
    const [company, setCompany] = useState("");
    const [description, setDescription] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchJobs = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/jobs/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setJobs(Array.isArray(data) ? data : []);
            } else {
                toast.error("Failed to load jobs.");
            }
        } catch (err) {
            toast.error("Network Error: Could not reach the backend.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    const addToPipeline = async (jobId: number, resumeId: number) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/applications/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ job_id: jobId, resume_id: resumeId })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to add application");
            }
            toast.success("Application started successfully.");
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleManualIngest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIngesting(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/jobs/ingest/manual`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ title, company, description })
            });
            if (!res.ok) throw new Error("Failed to add job");
            toast.success("Job added to the global database.");
            setIsOpen(false);
            setTitle(""); setCompany(""); setDescription("");
            fetchJobs();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIngesting(false);
        }
    };

    const checkMatch = async (jobId: number) => {
        setMatchingJobId(jobId);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${jobId}/match`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to find match");
            }
            const data = await res.json();
            setMatchResult({ jobId, resumeId: data.best_resume_id, score: data.match_score });
            toast.success(`Matched Resume #${data.best_resume_id} with score: ${data.match_score}%`);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setMatchingJobId(null);
        }
    };

    const filteredJobs = jobs.filter((job) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (job.title?.toLowerCase().includes(q) || job.company?.toLowerCase().includes(q) || job.description?.toLowerCase().includes(q));
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                        <Briefcase className="h-6 w-6" />
                        Global Jobs Database
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">All auto-scraped and manually added jobs from the global pool.</p>
                </div>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="flex items-center gap-2 bg-foreground text-background hover:opacity-90 transition-opacity rounded-md">
                            <Plus className="w-4 h-4" />
                            Add Job
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] bg-card border-border text-foreground shadow-lg rounded-xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold">Add New Job</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleManualIngest} className="grid gap-5 py-6">
                            <div className="grid gap-2">
                                <Label htmlFor="title" className="text-muted-foreground text-xs uppercase tracking-wider">Job Title</Label>
                                <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} className="bg-background border-border focus-visible:ring-ring text-foreground" placeholder="e.g. Senior Software Engineer" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="company" className="text-muted-foreground text-xs uppercase tracking-wider">Company</Label>
                                <Input id="company" required value={company} onChange={(e) => setCompany(e.target.value)} className="bg-background border-border focus-visible:ring-ring text-foreground" placeholder="e.g. Acme Corp" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="desc" className="text-muted-foreground text-xs uppercase tracking-wider">Job Description</Label>
                                <textarea
                                    id="desc"
                                    className="flex min-h-[160px] w-full rounded-md border border-border bg-background px-3 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                                    placeholder="Paste the job description here."
                                    required
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                            <Button type="submit" disabled={ingesting} className="w-full bg-foreground text-background hover:opacity-90 mt-2 font-medium">
                                {ingesting ? "Adding Job..." : "Save Job"}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                    placeholder="Search jobs by title, company, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-card border-border focus-visible:ring-ring text-foreground h-11"
                />
            </div>

            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="border-b border-border pb-5">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-foreground flex items-center gap-2"><Globe className="w-5 h-5" /> All Jobs</CardTitle>
                            <CardDescription className="text-muted-foreground mt-1">
                                {filteredJobs.length} jobs in the global database.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                            <Activity className="w-6 h-6 animate-pulse mb-4" />
                            <span className="text-sm">Loading global jobs...</span>
                        </div>
                    ) : filteredJobs.length === 0 ? (
                        <div className="py-32 flex flex-col items-center justify-center text-muted-foreground">
                            <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4 border border-border">
                                <Briefcase className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-2">No jobs found</h3>
                            <p className="text-sm max-w-sm text-center">Add a job manually or run the scraper to populate the global database.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-secondary/30">
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground font-medium">Title</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Company</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Location</TableHead>
                                        <TableHead className="text-muted-foreground font-medium max-w-[300px]">Description</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Source</TableHead>
                                        <TableHead className="text-right text-muted-foreground font-medium">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredJobs.map((job) => (
                                        <TableRow key={job.id} className="border-border hover:bg-secondary/50 transition-colors group">
                                            <TableCell className="font-medium text-foreground">{job.title}</TableCell>
                                            <TableCell className="text-muted-foreground">{job.company}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{job.location || "—"}</TableCell>
                                            <TableCell className="text-muted-foreground text-xs max-w-[300px] truncate" title={job.description}>{job.description?.substring(0, 80)}...</TableCell>
                                            <TableCell>
                                                {job.source_url ? (
                                                    <a href={job.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                                        <ExternalLink className="w-3 h-3" /> Link
                                                    </a>
                                                ) : (
                                                    <Badge variant="outline" className="text-xs border-border text-muted-foreground">{job.source || "Manual"}</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {matchResult?.jobId === job.id ? (
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <span className="text-xs text-muted-foreground">{matchResult.score}%</span>
                                                        <Button size="sm" className="bg-foreground text-background hover:opacity-90 text-xs" onClick={() => addToPipeline(job.id, matchResult.resumeId)}>
                                                            Apply
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="outline" size="sm"
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-foreground border-border hover:bg-secondary text-xs"
                                                        onClick={() => checkMatch(job.id)}
                                                        disabled={matchingJobId === job.id}
                                                    >
                                                        <Search className={`w-3 h-3 mr-1 ${matchingJobId === job.id ? 'animate-spin' : ''}`} />
                                                        {matchingJobId === job.id ? "..." : "Match"}
                                                    </Button>
                                                )}
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
