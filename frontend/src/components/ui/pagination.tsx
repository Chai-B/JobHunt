"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalCount: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    disabled?: boolean;
}

export function Pagination({
    currentPage,
    totalCount,
    pageSize,
    onPageChange,
    disabled = false,
}: PaginationProps) {
    const totalPages = Math.ceil(totalCount / pageSize);

    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-card/20 backdrop-blur-sm">
            <div className="text-xs text-muted-foreground font-medium">
                Showing <span className="text-foreground">{(currentPage - 1) * pageSize + 1}</span> - <span className="text-foreground">{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="text-foreground">{totalCount}</span> records
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
