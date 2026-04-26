"use client";

import type { ComponentType, SVGProps } from "react";
import {
  AudioLines,
  ChevronDown,
  Image as ImageIcon,
  Layers,
  Search,
  Telescope,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const MH_LOGO = (
  <svg
    className="size-8"
    width="29"
    height="26"
    viewBox="0 0 29 26"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g>
      <path
        d="M28.9376 17.7504L20.6061 0.179184C20.5245 0.00554876 20.2345 0.00554876 20.1529 0.179184L17.1524 6.50446C17.128 6.55304 17.128 6.60885 17.1512 6.65846L22.4639 17.9044C22.5017 17.983 22.5906 18.0347 22.6905 18.0347H28.7098C28.8828 18.0347 29.0021 17.8869 28.9376 17.7504ZM8.85138 0.179184L17.7286 18.938C17.7518 18.9876 17.7518 19.0434 17.7274 19.093L14.7269 25.4193C14.6441 25.593 14.3553 25.593 14.2725 25.4193L8.85016 13.9832C8.76854 13.8106 8.4786 13.8106 8.39698 13.9832L6.53674 17.9034C6.49897 17.9819 6.40882 18.0336 6.31015 18.0336L0.289647 18.0326C0.116659 18.0326 -0.00151013 17.8848 0.0630564 17.7484L8.39698 0.17815C8.47982 0.00554896 8.76854 0.00554876 8.85138 0.179184Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

export type NavActiveId = "create" | "video" | "image" | "audio" | "library";

const NAV: {
  id: NavActiveId;
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
}[] = [
  { id: "create", href: "/create", label: "Create", icon: Telescope },
  { id: "video", href: "/create#video", label: "Video", icon: Video },
  { id: "image", href: "/create#image", label: "Image", icon: ImageIcon },
  { id: "audio", href: "/create#audio", label: "Audio", icon: AudioLines },
  { id: "library", href: "/my-library", label: "Library", icon: Layers },
];

type MagicHourNavbarProps = {
  activeId: NavActiveId;
};

export function MagicHourNavbar({ activeId }: MagicHourNavbarProps) {
  const router = useRouter();

  return (
    <div className="flex min-w-0 flex-1 items-center justify-start gap-1">
      <Link href="/create" className="shrink-0 text-white" aria-label="Magic Hour home">
        {MH_LOGO}
      </Link>

      {/* Mobile: Create menu */}
      <div className="z-50 min-[925px]:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "group z-50 ml-0 flex h-10 w-fit min-w-0 max-w-full cursor-pointer items-center justify-center gap-0.5 rounded-2xl border-0! bg-transparent! px-2! font-medium",
              "whitespace-nowrap text-sm transition-all",
              "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:pointer-events-none disabled:opacity-25",
              "data-popup-open:bg-muted! sm:gap-2 sm:text-sm"
            )}
          >
            <div className="truncate text-xs font-normal leading-[130%] tracking-[0.005rem] min-[400px]:text-sm">Create</div>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-data-open:rotate-180"
              aria-hidden
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() => {
                    router.push(item.href);
                  }}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Icon className="size-4" />
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative z-0 min-[925px]:hidden" aria-hidden />

      {/* Desktop: pill + search */}
      <div className="relative z-50 hidden min-h-0 min-w-0 flex-1 items-center min-[925px]:flex">
        <div className="relative z-0 shrink-0" aria-hidden />
        <div
          className={cn(
            "bg-muted relative ml-0 flex h-fit min-h-10 shrink-0 items-stretch gap-0.5 rounded-2xl px-1",
            "min-[925px]:ml-2 min-[925px]:flex min-[925px]:gap-1",
            "xl:ml-4"
          )}
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeId;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "relative z-10 my-1 flex h-8 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl px-0 text-sm font-medium",
                  "transition-colors duration-100",
                  active
                    ? "text-background"
                    : "text-muted-foreground hover:bg-border/80 hover:text-foreground"
                )}
              >
                {active && (
                  <div
                    className="bg-foreground absolute inset-0 rounded-xl shadow-sm"
                    aria-hidden
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-2 px-2 py-2 lg:px-2.5 xl:px-3">
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span
                    className="truncate"
                    style={{ opacity: 1 }}
                  >
                    {item.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="text-muted-foreground mx-1 ml-2 h-fit border-0 bg-transparent! p-1.5! shadow-xs hover:bg-accent"
          aria-label="Search"
        >
          <Search className="size-[1.125rem]" strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}
