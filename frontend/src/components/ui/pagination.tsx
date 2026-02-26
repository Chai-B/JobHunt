"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PaginationProps {
    currentPage: number;
    totalCount: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    disabled?: boolean;
    pageSizeOptions?: number[];
}

export function Pagination({
    currentPage,
    totalCount,
    pageSize,
    onPageChange,
    onPageSizeChange,
    disabled = false,
    pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
    const totalPages = Math.ceil(totalCount / pageSize);

    if (totalCount === 0) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-border/40 bg-card/20 backdrop-blur-sm gap-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                <div>
                    Showing <span className="text-foreground">{totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> - <span className="text-foreground">{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="text-foreground">{totalCount}</span> records
                </div>
                {onPageSizeChange && (
                    <div className="flex items-center gap-2">
                        <span>Items per page:</span>
                        <Select
                            value={pageSize.toString()}
                            onValueChange={(v) => onPageSizeChange(Number(v))}
                            disabled={disabled}
                        >
                            <SelectTrigger className="h-8 w-[70px] text-xs">
                                <SelectValue placeholder={pageSize.toString()} />
                            </SelectTrigger>
                            <SelectContent>
                                {pageSizeOptions.map(opt => (
                                    <SelectItem key={opt} value={opt.toString()} className="text-xs">
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={disabled || currentPage === 1}
                    className="h-8 w-8 p-0 border-border/50 bg-background/50 hover:bg-secondary transition-all"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum = i + 1;
                        // Simple sliding window for pages if > 5
                        if (totalPages > 5 && currentPage > 3) {
                            pageNum = currentPage - 2 + i;
                            if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                        }

                        return (
                            <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => onPageChange(pageNum)}
                                disabled={disabled}
                                className={`h-8 w-8 p-0 text-xs font-medium transition-all ${currentPage === pageNum
                                    ? "bg-foreground text-background shadow-md"
                                    : "border-border/50 bg-background/50 hover:bg-secondary text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                {pageNum}
                            </Button>
                        );
                    })}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={disabled || currentPage === totalPages}
                    className="h-8 w-8 p-0 border-border/50 bg-background/50 hover:bg-secondary transition-all"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
