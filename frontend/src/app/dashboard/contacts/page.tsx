"use client";
import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, Plus, Upload, Download, Trash2, Edit } from "lucide-react";

export default function ContactsPage() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedContactId, setSelectedContactId] = useState<number | null>(null);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("");
    const [company, setCompany] = useState("");

    const fetchContacts = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/contacts/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setContacts(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            toast.error("Network error fetching contacts.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, []);

    const handleOpenCreate = () => {
        setSelectedContactId(null);
        setName(""); setEmail(""); setRole(""); setCompany("");
        setIsOpen(true);
    };

    const handleEdit = (c: any) => {
        setSelectedContactId(c.id);
        setName(c.name || "");
        setEmail(c.email || "");
        setRole(c.role || "");
        setCompany(c.company || "");
        setIsOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("token");
            const method = selectedContactId ? "PUT" : "POST";
            const url = selectedContactId
                ? `${API_BASE_URL}/api/v1/contacts/${selectedContactId}`
                : `${API_BASE_URL}/api/v1/contacts/`;

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name, email, role, company })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to save contact.");
            }
            toast.success(selectedContactId ? "Contact updated." : "Contact added.");
            setIsOpen(false);
            fetchContacts();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Delete this contact?")) return;
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/contacts/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to delete.");
            toast.success("Contact deleted.");
            fetchContacts();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleExport = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/v1/contacts/export`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Export failed.");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `contacts_export_${new Date().toISOString().split("T")[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("file", file);

        try {
            const token = localStorage.getItem("token");
            toast.loading("Importing contacts...");
            const res = await fetch(`${API_BASE_URL}/api/v1/contacts/import`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            toast.dismiss();
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Import failed.");
            }
            const data = await res.json();
            toast.success(`Import complete: ${data.imported} added, ${data.skipped} skipped/duplicates.`);
            fetchContacts();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            if (e.target) e.target.value = "";
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                        <Users className="h-6 w-6" />
                        Contacts Directory
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Manage your networking contacts and scraped leads.</p>
                </div>

                <div className="flex items-center gap-2">
                    <Label htmlFor="import-csv" className="cursor-pointer">
                        <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2">
                            <Upload className="w-4 h-4" /> Import CSV
                        </div>
                        <input id="import-csv" type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleImport} />
                    </Label>

                    <Button variant="outline" onClick={handleExport} className="gap-2">
                        <Download className="w-4 h-4" /> Export
                    </Button>

                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleOpenCreate} className="gap-2 bg-foreground text-background">
                                <Plus className="w-4 h-4" /> Add Contact
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>{selectedContactId ? "Edit Contact" : "Add Contact"}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSave} className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Name</Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Email</Label>
                                    <Input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="jane@example.com" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Role</Label>
                                    <Input value={role} onChange={e => setRole(e.target.value)} placeholder="Recruiter" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Company</Label>
                                    <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp" />
                                </div>
                                <Button type="submit" className="mt-4">{selectedContactId ? "Save Changes" : "Create Contact"}</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="border-b border-border pb-5">
                    <CardTitle className="text-lg font-semibold">Saved Contacts</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-20 text-center text-muted-foreground"><span className="text-sm">Loading contacts...</span></div>
                    ) : contacts.length === 0 ? (
                        <div className="py-24 text-center text-muted-foreground flex flex-col items-center">
                            <Users className="w-8 h-8 opacity-20 mb-4" />
                            <p className="font-medium text-foreground">No Contacts Found</p>
                            <p className="text-sm">Import a CSV or add your first networking contact.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-secondary/30">
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {contacts.map((c: any) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-medium">{c.name || "—"}</TableCell>
                                            <TableCell>{c.email}</TableCell>
                                            <TableCell className="text-muted-foreground">{c.role || "—"}</TableCell>
                                            <TableCell className="text-muted-foreground">{c.company || "—"}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(c)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                    <Trash2 className="w-4 h-4" />
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
