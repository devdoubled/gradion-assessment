'use client';

import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ExternalLink, Download, FileText, ImageIcon } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptUrl: string;
  /** Shown in the dialog title for context */
  merchantName?: string;
}

function isPdf(url: string): boolean {
  return url.toLowerCase().split('?')[0].endsWith('.pdf');
}

export function ReceiptViewerDialog({
  open,
  onOpenChange,
  receiptUrl,
  merchantName,
}: Props) {
  const pdf = isPdf(receiptUrl);
  const title = merchantName ? `Receipt — ${merchantName}` : 'Receipt';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        flex flex-col + max-h-[90vh] keeps the dialog within the viewport.
        The receipt area uses flex-1 min-h-0 so it fills available space
        between header and footer without pushing either off-screen.
      */}
      <DialogContent
        className="sm:max-w-3xl p-0 gap-0 flex flex-col max-h-[90vh]"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted shrink-0">
            {pdf ? (
              <FileText className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <DialogTitle className="text-sm font-semibold truncate flex-1">
            {title}
          </DialogTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'h-8 gap-1.5 text-xs cursor-pointer',
              )}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in tab
            </a>
            <a
              href={receiptUrl}
              download
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'h-8 gap-1.5 text-xs cursor-pointer',
              )}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </div>
        </DialogHeader>

        {/* Receipt content — flex-1 min-h-0 fills remaining space */}
        <div className="flex-1 min-h-0 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
          {pdf ? (
            <iframe
              src={receiptUrl}
              title={title}
              className="w-full h-[70vh] border-0"
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptUrl}
                alt={title}
                className="max-w-full max-h-full object-contain p-4"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  const fallback = document.getElementById('receipt-viewer-fallback');
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div
                id="receipt-viewer-fallback"
                className="hidden flex-col items-center gap-3 text-muted-foreground p-8"
              >
                <ImageIcon className="h-10 w-10 opacity-30" />
                <p className="text-sm">Unable to load image</p>
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Open directly
                </a>
              </div>
            </>
          )}
        </div>

        {/* Footer — shrink-0 keeps it anchored at the bottom */}
        <div className="flex justify-end border-t border-border px-5 py-3 bg-muted/30 shrink-0">
          <DialogClose
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'cursor-pointer')}
          >
            Close
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
