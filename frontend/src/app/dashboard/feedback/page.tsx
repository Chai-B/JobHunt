"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/config";
import { toast } from "sonner";
import {
    MessageSquare, Plus, ThumbsUp, MessageCircle, AlertCircle,
    CheckCircle2, Clock, X, Search, Lightbulb, User, Send
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";

export default function FeedbackHubPage() {
    const [feedbacks, setFeedbacks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("Active");
    const [sort, setSort] = useState("latest");

    // New Feedback Dialog
    const [showNewDialog, setShowNewDialog] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newType, setNewType] = useState("Feature Request");
    const [newMessage, setNewMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Thread View Dialog
    const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
    const [threadData, setThreadData] = useState<any | null>(null);
    const [threadLoading, setThreadLoading] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [isCommenting, setIsCommenting] = useState(false);

    // User data to check ownership for closing issues
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Fetch user info for UI rules
    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem("token");
            if (!token) return;
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    setCurrentUser(await res.json());
                }
            } catch (err) { }
        };
        fetchUser();
    }, []);

    const fetchFeedbacks = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/feedbacks/?status=${activeTab}&sort_by=${sort}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFeedbacks(data);
            }
        } catch (err) {
            toast.error("Failed to load feedback.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeedbacks();
    }, [activeTab, sort]);

    const submitNewFeedback = async () => {
        if (!newTitle.trim() || !newMessage.trim()) {
            toast.error("Title and message are required.");
            return;
        }
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/feedbacks/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: newTitle,
                    type: newType,
                    message: newMessage
                })
            });
            if (res.ok) {
                toast.success("Feedback posted successfully!");
                setShowNewDialog(false);
                setNewTitle("");
                setNewMessage("");
                fetchFeedbacks(); // Refresh
            } else {
                toast.error("Failed to post feedback.");
            }
        } catch (err) {
            toast.error("Network error.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchThread = async (id: number) => {
        setThreadLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/feedbacks/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setThreadData(await res.json());
            } else {
                toast.error("Failed to load thread.");
            }
        } catch (err) {
            toast.error("Network error.");
        } finally {
            setThreadLoading(false);
        }
    };

    const openThread = (item: any) => {
        setSelectedFeedback(item);
        fetchThread(item.id);
    };

    const submitComment = async () => {
        if (!newComment.trim() || !selectedFeedback) return;
        setIsCommenting(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/feedbacks/${selectedFeedback.id}/comments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ message: newComment })
            });
            if (res.ok) {
                toast.success("Comment posted.");
                setNewComment("");
                fetchThread(selectedFeedback.id); // Refresh thread
                fetchFeedbacks(); // Update parent comment count
            } else {
                toast.error("Failed to post comment.");
            }
        } catch (err) {
            toast.error("Network error.");
        } finally {
            setIsCommenting(false);
        }
    };

    const upvote = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation(); // prevent opening thread
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/feedbacks/${id}/upvote`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                // Optimistically update list
                setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, upvotes: f.upvotes + 1 } : f));
                // Optimistically update thread if open
                if (threadData && threadData.id === id) {
                    setThreadData({ ...threadData, upvotes: threadData.upvotes + 1 });
                }
            } else {
                toast.error("Failed to upvote.");
            }
        } catch (err) {
            toast.error("Network error.");
        }
    };

    const toggleStatus = async (id: number) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/feedbacks/${id}/status`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const updated = await res.json();
                toast.success(`Issue ${updated.status === "Closed" ? "Closed" : "Reopened"}`);
                setSelectedFeedback(null);
                setThreadData(null);
                fetchFeedbacks(); // refresh list
            } else {
                toast.error("Failed to change status. Note: Only OP can close.");
            }
        } catch (err) {
            toast.error("Network error.");
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case "Issue": return "bg-red-500/10 text-red-500 border-red-500/20";
            case "Feature Request": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            default: return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "Issue": return <AlertCircle className="w-3.5 h-3.5" />;
            case "Feature Request": return <Lightbulb className="w-3.5 h-3.5" />;
            default: return <MessageSquare className="w-3.5 h-3.5" />;
        }
    };

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-4 relative z-10">
                <div className="space-y-1.5 sm:space-y-2 max-w-2xl">
                    <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground flex items-center gap-3 font-sans">
                        <MessageSquare className="h-7 w-7 sm:h-8 sm:w-8 text-primary/80" />
                        Feedback Hub
                    </h1>
                    <p className="text-muted-foreground mt-1 text-base">Help shape JobHunt by sharing bugs, ideas, and feature requests.</p>
                </div>
                <Button onClick={() => setShowNewDialog(true)} className="rounded-xl px-5 gap-2 shadow-lg hover:shadow-primary/20 transition-all active:scale-95 bg-primary text-primary-foreground">
                    <Plus className="w-4 h-4" />
                    New Request
                </Button>
            </div>

            {/* Main Tabs and List */}
            <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                <Tabs defaultValue="Active" onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border/50 bg-secondary/10 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                        <TabsList className="bg-background/50 border border-border/40 p-1 w-full sm:w-auto flex">
                            <TabsTrigger value="Active" className="flex-1 sm:flex-none gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm px-4">
                                <AlertCircle className="w-4 h-4" /> Active
                            </TabsTrigger>
                            <TabsTrigger value="Closed" className="flex-1 sm:flex-none gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm px-4">
                                <CheckCircle2 className="w-4 h-4" /> Closed
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest hidden sm:inline-block">Sort by:</span>
                            <Select value={sort} onValueChange={setSort}>
                                <SelectTrigger className="w-[140px] h-9 bg-background/50 border-border/50 rounded-xl text-xs">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent className="bg-card rounded-xl border-border/50">
                                    <SelectItem value="latest">Latest</SelectItem>
                                    <SelectItem value="upvotes">Most Upvoted</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <TabsContent value={activeTab} className="flex-1 mt-0 p-0 outline-none">
                        {loading ? (
                            <div className="p-10 flex flex-col items-center justify-center text-muted-foreground gap-3">
                                <Search className="w-6 h-6 animate-pulse" />
                                <span className="text-sm font-medium">Loading discussions...</span>
                            </div>
                        ) : feedbacks.length === 0 ? (
                            <div className="p-10 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 border border-border">
                                    <MessageSquare className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground">No {activeTab.toLowerCase()} feedback</h3>
                                <p className="text-muted-foreground text-sm mt-1 max-w-sm">
                                    {activeTab === "Active" ? "Be the first to suggest a feature or report an issue!" : "No closed issues right now."}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {feedbacks.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => openThread(item)}
                                        className="p-5 hover:bg-secondary/30 transition-colors cursor-pointer group flex gap-4"
                                    >
                                        <div className="flex flex-col items-center shrink-0">
                                            <button
                                                onClick={(e) => upvote(item.id, e)}
                                                className="flex flex-col items-center justify-center w-12 py-2 rounded-xl border border-transparent hover:border-border/50 hover:bg-secondary/50 transition-colors group/vote"
                                            >
                                                <ThumbsUp className="w-4 h-4 text-muted-foreground group-hover/vote:text-primary transition-colors" />
                                                <span className="text-sm font-medium mt-1 text-foreground/80">{item.upvotes}</span>
                                            </button>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md ${getTypeColor(item.type)}`}>
                                                    <span className="flex items-center gap-1.5">
                                                        {getTypeIcon(item.type)}
                                                        {item.type}
                                                    </span>
                                                </Badge>
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                                {item.title}
                                            </h3>
                                            <p className="text-sm text-muted-foreground line-clamp-1 mt-1 font-sans">
                                                {item.message}
                                            </p>
                                            <div className="flex items-center gap-4 mt-3">
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                                    <User className="w-3.5 h-3.5" />
                                                    {item.user_name || "Anonymous User"}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-secondary/50 px-2 py-0.5 rounded-md">
                                                    <MessageCircle className="w-3.5 h-3.5" />
                                                    {item.comment_count}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* New Feedback Dialog */}
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogContent className="sm:max-w-xl bg-card border-border/50 rounded-2xl shadow-2xl p-0 overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-border/50 bg-secondary/10">
                        <DialogHeader>
                            <DialogTitle className="text-xl">Submit Feedback</DialogTitle>
                            <DialogDescription>
                                Post an issue, idea, or general thought for the community and developers.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="p-4 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="col-span-1 space-y-2">
                                <label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Type</label>
                                <Select value={newType} onValueChange={setNewType}>
                                    <SelectTrigger className="bg-background/50 border-border/50 rounded-xl h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border/50 rounded-xl">
                                        <SelectItem value="Feature Request">Feature Request</SelectItem>
                                        <SelectItem value="Issue">Issue / Bug</SelectItem>
                                        <SelectItem value="General">General</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Title</label>
                                <Input
                                    value={newTitle} onChange={e => setNewTitle(e.target.value)}
                                    placeholder="Short, descriptive title"
                                    className="bg-background/50 border-border/50 focus:border-primary/50 rounded-xl h-11 transition-all"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Details</label>
                            <Textarea
                                value={newMessage} onChange={e => setNewMessage(e.target.value)}
                                placeholder="Describe your request or issue in detail..."
                                className="bg-background/50 border-border/50 focus:border-primary/50 min-h-[150px] rounded-xl font-sans resize-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="p-4 sm:p-6 sm:pt-0 pt-0 flex flex-col-reverse sm:flex-row justify-end gap-3">
                        <Button variant="ghost" className="rounded-xl hover:bg-secondary/50" onClick={() => setShowNewDialog(false)}>Cancel</Button>
                        <Button onClick={submitNewFeedback} disabled={isSubmitting} className="rounded-xl px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-transform active:scale-95">
                            {isSubmitting ? "Posting..." : "Post Feedback"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Thread View Dialog */}
            <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
                <DialogContent className="sm:max-w-2xl bg-card border-border/50 rounded-2xl shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
                    {selectedFeedback && (
                        <>
                            {/* Thread Header */}
                            <div className="p-4 sm:p-6 border-b border-border/50 bg-secondary/10 shrink-0">
                                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md ${selectedFeedback.status === "Closed" ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                                {selectedFeedback.status}
                                            </Badge>
                                            <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md ${getTypeColor(selectedFeedback.type)}`}>
                                                {selectedFeedback.type}
                                            </Badge>
                                        </div>
                                        <DialogTitle className="text-xl leading-tight">{selectedFeedback.title}</DialogTitle>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                                            <span className="flex items-center gap-1.5 text-foreground/80"><User className="w-3.5 h-3.5" /> OP: {selectedFeedback.user_name}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatDistanceToNow(new Date(selectedFeedback.created_at))} ago</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons (Close/Reopen) - Only show if OP */}
                                    {currentUser && currentUser.id === selectedFeedback.user_id && (
                                        <Button
                                            variant="outline" size="sm"
                                            onClick={() => toggleStatus(selectedFeedback.id)}
                                            className="h-8 w-full sm:w-auto rounded-lg text-xs font-medium border-border/50 hover:bg-secondary"
                                        >
                                            {selectedFeedback.status === "Active" ? "Close Issue" : "Reopen Issue"}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Thread Body (Scrollable) */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6 bg-background">
                                {/* OP Post */}
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                                        <User className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1 bg-card border border-border/50 rounded-2xl rounded-tl-none p-4 shadow-sm relative">
                                        {/* Decorative caret */}
                                        <div className="absolute top-0 -left-2 w-0 h-0 border-t-8 border-r-8 border-transparent border-t-border/50 -rotate-90"></div>
                                        <div className="absolute top-[1.5px] -left-[6px] w-0 h-0 border-t-[7px] border-r-[7px] border-transparent border-t-card -rotate-90"></div>

                                        <p className="text-sm font-sans text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                            {selectedFeedback.message}
                                        </p>
                                    </div>
                                </div>

                                {/* Comments Divider */}
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 h-px bg-border/50"></div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Discussion</span>
                                    <div className="flex-1 h-px bg-border/50"></div>
                                </div>

                                {/* Comments List */}
                                {threadLoading ? (
                                    <div className="flex justify-center p-4"><Search className="w-5 h-5 text-muted-foreground animate-pulse" /></div>
                                ) : threadData?.comments?.length === 0 ? (
                                    <div className="text-center text-sm text-muted-foreground py-4">No comments yet.</div>
                                ) : (
                                    threadData?.comments?.map((comment: any) => (
                                        <div key={comment.id} className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border shrink-0 mt-1">
                                                <User className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-foreground">{comment.user_name}</span>
                                                    <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at))}</span>
                                                    {comment.user_id === selectedFeedback.user_id && (
                                                        <Badge variant="outline" className="text-[9px] uppercase tracking-wide bg-primary/5 text-primary border-primary/20 px-1.5 py-0 h-4">Author</Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm font-sans text-foreground/80 whitespace-pre-wrap leading-relaxed bg-secondary/20 p-3 rounded-xl border border-transparent">
                                                    {comment.message}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Reply Box Footer */}
                            {selectedFeedback.status === "Active" ? (
                                <div className="p-4 border-t border-border/50 bg-secondary/5 shrink-0">
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-secondary hidden sm:flex items-center justify-center border border-border shrink-0">
                                            <User className="w-4 h-4 text-foreground/60" />
                                        </div>
                                        <div className="flex-1 bg-background border border-border/50 rounded-xl focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all flex overflow-hidden">
                                            <Textarea
                                                placeholder="Add to the discussion..."
                                                value={newComment}
                                                onChange={e => setNewComment(e.target.value)}
                                                className="border-0 focus-visible:ring-0 min-h-[60px] resize-none pb-2 pt-3 px-3 shadow-none custom-scrollbar"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        submitComment();
                                                    }
                                                }}
                                            />
                                            <div className="flex items-end p-2 shrink-0">
                                                <Button
                                                    size="icon"
                                                    className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
                                                    onClick={submitComment}
                                                    disabled={isCommenting || !newComment.trim()}
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 border-t border-border/50 bg-secondary/10 shrink-0 text-center">
                                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> This thread has been locked because the issue is closed.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
