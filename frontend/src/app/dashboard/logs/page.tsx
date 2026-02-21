"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Terminal, Activity, RefreshCw, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from 'date-fns';

export default function LogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stopping, setStopping] = useState(false);
    const [runningCount, setRunningCount] = useState(0);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const [logsRes, runningRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/v1/logs/`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_BASE_URL}/api/v1/logs/running`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            if (logsRes.ok) {
                const data = await logsRes.json();
                setLogs(Array.isArray(data) ? data : []);
            } else {
                toast.error("Failed to fetch system logs.");
            }
            if (runningRes.ok) {
                const data = await runningRes.json();
                setRunningCount(data.count || 0);
            }
        } catch (err) {
            toast.error("Network Error: Could not parse logs.");
        } finally {
            setLoading(false);
        }
    };

    const handleStopAll = async () => {
        setStopping(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/logs/stop-all`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                toast.success(data.message);
                fetchLogs();
            } else {
                toast.error("Failed to stop tasks.");
            }
        } catch (err) {
            toast.error("Network error.");
        } finally {
            setStopping(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000); // 5s auto-refresh
        return () => clearInterval(interval);
    }, []);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "running": return "border-blue-500/50 text-blue-500 bg-blue-500/10";
            case "success": return "border-green-500/50 text-green-500 bg-green-500/10";
            case "failed": return "border-red-500/50 text-red-500 bg-red-500/10";
            default: return "border-border text-muted-foreground bg-secondary";
        }
    };

    const getTypeIcon = (type: string) => {
        return <Terminal className="w-3.5 h-3.5 mr-2" />;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                        <Activity className="h-6 w-6" />
                        System Logs
                        {runningCount > 0 && (
                            <Badge variant="outline" className="border-blue-500/50 text-blue-500 bg-blue-500/10 animate-pulse ml-2">
                                {runningCount} running
                            </Badge>
                        )}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Monitor all background operations in real-time.</p>
                </div>
                <div className="flex gap-2">
                    {runningCount > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleStopAll} disabled={stopping} className="gap-2">
                            <StopCircle className={`w-4 h-4 ${stopping ? 'animate-spin' : ''}`} />
                            Stop All
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-2 border-border text-foreground">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
            </div>

            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="border-b border-border pb-5">
                    <CardTitle className="text-foreground">Activity Stream</CardTitle>
                    <CardDescription className="text-muted-foreground">Recent events from the Celery background queues.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading && logs.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                            <Activity className="w-6 h-6 animate-pulse mb-4" />
                            <span className="text-sm">Fetching telemetry...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground text-sm font-mono">
                            No telemetry found. Trigger an agent payload to start recording logs.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-secondary/30">
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground font-medium w-[150px]">Process Type</TableHead>
                                        <TableHead className="text-muted-foreground font-medium w-[100px]">Status</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Trace / Message</TableHead>
                                        <TableHead className="text-right text-muted-foreground font-medium w-[150px]">Timestamp</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log: any) => (
                                        <TableRow key={log.id} className="border-border hover:bg-secondary/50 transition-colors font-mono text-xs">
                                            <TableCell className="font-medium text-foreground flex items-center">
                                                {getTypeIcon(log.action_type)}
                                                {log.action_type}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`font-medium ${getStatusStyle(log.status)}`}>
                                                    {log.status.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground min-w-[300px]">
                                                {log.message || "—"}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
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
