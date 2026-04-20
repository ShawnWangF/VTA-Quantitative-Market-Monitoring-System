import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent text-sm font-semibold transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_18px_40px_-24px_rgba(14,116,144,0.75)] hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-[0_22px_45px_-24px_rgba(14,116,144,0.7)]",
        destructive:
          "bg-destructive text-white shadow-[0_18px_40px_-24px_rgba(220,38,38,0.6)] hover:-translate-y-0.5 hover:bg-destructive/92 focus-visible:ring-destructive/20 dark:bg-destructive/70",
        outline:
          "border-border/90 bg-white/88 text-foreground shadow-[0_12px_34px_-26px_rgba(15,23,42,0.38)] hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground dark:bg-transparent dark:border-input dark:hover:bg-input/50",
        secondary:
          "border-white/70 bg-secondary text-secondary-foreground shadow-[0_12px_30px_-24px_rgba(15,23,42,0.22)] hover:-translate-y-0.5 hover:bg-secondary/88",
        ghost:
          "border-transparent bg-transparent shadow-none hover:bg-accent/80 dark:hover:bg-accent/50",
        link: "border-transparent p-0 text-primary underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4.5",
        icon: "size-10",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
