"use client";

import { Bell, Gift } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const LIGHTNING_UPGRADE = (
  <svg
    viewBox="0 0 9 14"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className="relative -mb-0.5 size-4 fill-secondary-foreground drop-shadow-[0_0_8px_rgba(147,130,255,0.9)]"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.27195 8.59804e-05H7.9375C8.11112 8.59804e-05 8.25119 0.147303 8.25119 0.329803C8.25119 0.398096 8.23149 0.461353 8.1974 0.513979L5.9031 4.69104H8.68631C8.85939 4.69104 9 4.83826 9 5.02076C9 5.10696 8.96805 5.18589 8.91639 5.24467L2.51802 13.8738C2.4115 14.0171 2.21551 14.0417 2.07971 13.9303C1.98279 13.8508 1.94284 13.7232 1.96574 13.6045L3.08682 7.93224H0.313688C0.140606 7.93224 0 7.78502 0 7.60252C0 7.5639 0.00639082 7.52639 0.0181072 7.49224L1.96993 0.24071C2.00881 0.095169 2.13508 0.000644871 2.27195 8.59804e-05Z"
    />
  </svg>
);

export function CreditsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4 shrink-0", className)}
    >
      <path
        d="M5.23825 5.59052C5.75495 3.58298 7.57732 2.09961 9.74615 2.09961C12.3168 2.09961 14.4007 4.18352 14.4007 6.75415C14.4007 8.80363 13.0761 10.5437 11.2363 11.165M10.9087 10.2451C10.9087 12.8157 8.82479 14.8996 6.25415 14.8996C3.68352 14.8996 1.59961 12.8157 1.59961 10.2451C1.59961 7.67443 3.68352 5.59052 6.25415 5.59052C8.82479 5.59052 10.9087 7.67443 10.9087 10.2451Z"
        strokeWidth="1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DEFAULT_AVATAR =
  "https://lh3.googleusercontent.com/a/ACg8ocK-APRPfJDoOFuReaS7Hz-O-iYE55m6tp_iuEMpxq35WhPnL-ujLA=s96-c";

type MagicHourNavActionsProps = {
  credits: number;
  className?: string;
  avatarUrl?: string;
};

export function MagicHourNavActions({
  credits,
  className,
  avatarUrl = DEFAULT_AVATAR,
}: MagicHourNavActionsProps) {
  const [feedOpen, setFeedOpen] = useState(false);

  return (
    <div className={cn("flex justify-end", className)}>
      <div className="flex items-center md:gap-1">
        <div className="hidden md:block" aria-hidden />

        <div data-slot="popover-anchor" className="min-w-0">
          <div
            className={cn(
              "bg-muted mr-auto flex min-w-0 max-w-full items-center gap-0.5 overflow-hidden rounded-2xl p-1 px-1.5",
              "sm:gap-1.5",
              "md:ml-2 md:mr-0"
            )}
          >
            <div className="hidden min-[375px]:block">
              <div className="flex flex-col items-center gap-2">
                <Button
                  type="button"
                  data-slot="button"
                  variant="secondary"
                  className={cn(
                    "text-secondary-foreground flex h-8 w-full min-w-0 flex-row items-center justify-between gap-1.5 rounded-xl border",
                    "border-secondary-foreground/10 bg-card px-2.5 shadow-xs",
                    "whitespace-nowrap",
                    "hover:bg-secondary/80",
                    "md:mr-1"
                  )}
                >
                  {LIGHTNING_UPGRADE}
                  <span
                    className="relative bg-gradient-to-r from-violet-200 from-[30%] to-violet-100 bg-clip-text font-semibold text-transparent drop-shadow-[0_0_8px_rgba(147,130,255,0.9)]"
                  >
                    Upgrade
                  </span>
                </Button>
              </div>
            </div>

            <Popover open={feedOpen} onOpenChange={setFeedOpen}>
              <PopoverTrigger
                type="button"
                data-slot="popover-trigger"
                className="group text-foreground/90 hover:text-foreground inline-flex cursor-pointer items-center rounded-md p-1 text-base font-medium focus:outline-none"
                aria-haspopup="dialog"
                aria-expanded={feedOpen}
              >
                <div className="relative">
                  <Bell
                    className="text-muted-foreground size-5 stroke-[2]"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  />
                </div>
                <span className="sr-only">Feed</span>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end" side="bottom" sideOffset={6}>
                <p className="text-muted-foreground text-sm">Activity feed (placeholder).</p>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className="text-muted-foreground flex min-w-0 cursor-pointer items-center gap-1 truncate text-sm hover:cursor-pointer"
                id="credits-menu-trigger"
              >
                <CreditsIcon className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground tabular-nums">{credits}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>Buy credits (demo)</DropdownMenuItem>
                <DropdownMenuItem>View usage</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className="flex cursor-pointer items-center gap-1 p-1"
                aria-label="Account menu"
              >
                <div className="relative flex items-center">
                  <span
                    data-slot="avatar"
                    className="text-xs relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full"
                  >
                    <Image
                      data-slot="avatar-image"
                      src={avatarUrl}
                      alt="Account"
                      width={24}
                      height={24}
                      className="aspect-square size-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </span>
                  <div className="bg-primary absolute -top-1 -right-1.5 flex size-4 items-center justify-center rounded-full">
                    <Gift className="text-foreground size-3" strokeWidth={2} aria-hidden />
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>Profile (demo)</DropdownMenuItem>
                <DropdownMenuItem>Settings (demo)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
