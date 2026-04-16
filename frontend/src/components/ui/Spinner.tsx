import * as React from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

export type SpinnerProps = React.SVGProps<SVGSVGElement>;

export function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <Loader2 className={cn("animate-spin", className)} {...props} />
  );
}
